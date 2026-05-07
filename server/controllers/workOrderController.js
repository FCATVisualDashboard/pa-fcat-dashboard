const sql = require('../config/pool');
const XLSX = require('xlsx');

// ================= COLUMN MAPPING =================
const COLUMN_ALIASES = {
  work_order_id:    ['workorder', 'workorderid', 'woid', 'orderid'],
  pm_id:            ['pmid', 'pm'],
  status:           ['status'],
  target_start_date:['targetstart', 'targetstartdate', 'startdate', 'duedate', 'scheduleddate', 'scheduledstart'],
  frequency:        ['frequency', 'freq', 'recurrence', 'worktype'],
  description:      ['description', 'desc', 'notes', 'workdescription'],
};

function strip(str) {
  return String(str ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveHeaders(rawHeaders) {
  const mapping = {};
  rawHeaders.forEach((raw, idx) => {
    const key = strip(raw);
    if (!key) return;
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (mapping[field] != null) continue;
      if (aliases.some(alias => key === alias || key.startsWith(alias) || alias.startsWith(key))) {
        mapping[field] = idx;
        break;
      }
    }
  });
  return mapping;
}

function extractPmIdFromDescription(description) {
  if (!description) return null;
  const bracketMatch = String(description).match(/\[([^\]]+)\]/);
  if (!bracketMatch) return null;
  const inner = bracketMatch[1].trim(); // e.g. "TW-22", "TW-66A", "13R-6"
  // Extract just the part after the last dash — "TW-22" -> "22", "TW-66A" -> "66A"
  const parts = inner.split('-');
  return parts[parts.length - 1] || inner;
}

// Excel stores dates as serial numbers (days since 1900-01-01, with a known
// off-by-one leap year bug). This converts without relying on XLSX.SSF.
function excelSerialToISO(serial) {
  // 25569 = days between 1900-01-01 and 1970-01-01 (accounting for the Excel leap year bug)
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return excelSerialToISO(value);
  // Already a JS Date (happens when cellDates:true is used)
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString();
  // String date
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ================= UPLOAD =================
exports.uploadWorkOrders = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (rows.length < 2) {
      return res.status(400).json({ error: 'Excel file appears to be empty or has no data rows.' });
    }

    // Scan first 5 rows to find the header row
    let headerRowIdx = 0;
    let colMap = {};
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const candidate = resolveHeaders(rows[i]);
      if (candidate.work_order_id != null) {
        headerRowIdx = i;
        colMap = candidate;
        break;
      }
    }

    if (colMap.work_order_id == null) {
      return res.status(400).json({
        error: 'Could not find a "Work Order" column in the first 5 rows.',
        scanned_rows: rows.slice(0, 5).map(r =>
          r.map(cell => (cell === null ? '(empty)' : String(cell)))
        ),
      });
    }

    // Pre-load areas so we can match by EITHER pm_id OR description (e.g. "TW-79")
    const areaRows = await sql`SELECT pm_id, description FROM areas`;
    const validPmIds = new Set(areaRows.map(r => r.pm_id));
    // description -> pm_id lookup (case-insensitive, trimmed)
    const descToPmId = new Map(
      areaRows
        .filter(r => r.description)
        .map(r => [r.description.trim().toLowerCase(), r.pm_id])
    );

    const dataRows = rows.slice(headerRowIdx + 1).filter(row =>
      row.some(cell => cell !== null && cell !== '')
    );

    const records = dataRows.map(row => {
      const rawDescription = colMap.description != null
        ? String(row[colMap.description] ?? '').trim()
        : null;

      // Always prefer bracket extraction from description (e.g. "[TW-22]" -> "22")
      // The explicit PM column contains work order system numbers (e.g. 6675772) which are not area IDs
      const rawPmId = extractPmIdFromDescription(rawDescription) || null;

      // Match strategy (in order):
      // 1. rawPmId is already a valid pm_id
      // 2. rawPmId matches an area's description (e.g. "TW-79" -> pm_id)
      // 3. No match -> use rawPmId as-is and auto-create the area during upsert
      let pm_id = null;
      let needsAreaCreate = false;
      if (rawPmId) {
        if (validPmIds.has(rawPmId)) {
          pm_id = rawPmId;
        } else {
          const byDesc = descToPmId.get(rawPmId.toLowerCase());
          if (byDesc) {
            pm_id = byDesc;
          } else {
            // Area doesn't exist yet — use the extracted value as the pm_id
            // and flag it for auto-creation
            pm_id = rawPmId;
            needsAreaCreate = true;
          }
        }
      }

      return {
        work_order_id:     String(row[colMap.work_order_id] ?? '').trim(),
        pm_id,
        needsAreaCreate,
        status:            colMap.status            != null ? String(row[colMap.status]            ?? '').trim().toUpperCase() : null,
        target_start_date: colMap.target_start_date != null ? parseDate(row[colMap.target_start_date]) : null,
        frequency:         colMap.frequency         != null ? String(row[colMap.frequency]         ?? '').trim() : null,
        description:       rawDescription?.slice(0, 255) ?? null,
      };
    }).filter(r => r.work_order_id);

    if (records.length === 0) {
      return res.status(400).json({ error: 'No valid rows found after parsing.' });
    }

    // Debug log so the mismatch is visible in the server terminal
    console.log('[WO Upload] Area descriptions in DB (first 10):', [...descToPmId.keys()].slice(0, 10));
    const sampleExtracted = dataRows.slice(0, 5).map(row => {
      const desc = colMap.description != null ? String(row[colMap.description] ?? '') : '(no desc col)';
      return { raw_description: desc.slice(0, 80), extracted: extractPmIdFromDescription(desc) };
    });
    console.log('[WO Upload] Sample extracted values:', JSON.stringify(sampleExtracted, null, 2));

    // Preview mode — return parsed data without touching the DB
    if (req.query.preview === 'true') {
      const unlinked = records.filter(r => !r.pm_id).length;

      // Diagnostic: show what was extracted vs what areas exist, to surface mismatches
      const extractedSample = [...new Set(
        dataRows.slice(0, 20).map(row => {
          const desc = colMap.description != null ? String(row[colMap.description] ?? '') : '';
          const explicit = colMap.pm_id != null ? String(row[colMap.pm_id] ?? '').trim() : '';
          const fromBrackets = extractPmIdFromDescription(desc);
          return { explicit: explicit || null, from_brackets: fromBrackets, description_sample: desc.slice(0, 60) };
        })
      )];

      return res.json({
        preview: true,
        count: records.length,
        unlinked,
        records: records.slice(0, 50),
        column_mapping: Object.fromEntries(
          Object.entries(colMap).map(([field, idx]) => [field, rows[headerRowIdx][idx]])
        ),
        debug: {
          valid_area_ids: [...validPmIds].slice(0, 20),
          extracted_sample: extractedSample,
        },
      });
    }

    // Auto-create any areas that don't exist yet (no grid cells, just the areas row)
    const toCreate = [...new Map(
      records
        .filter(r => r.needsAreaCreate && r.pm_id)
        .map(r => [r.pm_id, r])
    ).values()];

    for (const r of toCreate) {
      await sql`
        INSERT INTO areas (pm_id, description)
        VALUES (${r.pm_id}, ${r.pm_id})
        ON CONFLICT (pm_id) DO NOTHING
      `;
    }

    // Upsert work orders
    let inserted = 0;
    let updated  = 0;

    for (const r of records) {
      const result = await sql`
        INSERT INTO work_order (work_order_id, pm_id, status, target_start_date, frequency, description)
        VALUES (
          ${r.work_order_id},
          ${r.pm_id             || null},
          ${r.status            || null},
          ${r.target_start_date || null},
          ${r.frequency         || null},
          ${r.description       || null}
        )
        ON CONFLICT (work_order_id)
        DO UPDATE SET
          pm_id             = EXCLUDED.pm_id,
          status            = EXCLUDED.status,
          target_start_date = EXCLUDED.target_start_date,
          frequency         = EXCLUDED.frequency,
          description       = EXCLUDED.description
        RETURNING (xmax = 0) AS is_insert
      `;
      if (result[0]?.is_insert) inserted++;
      else updated++;
    }

    res.json({
      message: `Import complete. ${inserted} inserted, ${updated} updated. ${toCreate.length} new areas auto-created (unmapped).`,
      inserted,
      updated,
      areas_created: toCreate.length,
      total: records.length,
    });

  } catch (err) {
    console.error('Work order upload error:', err);
    // Return the full error message to the client so it's visible in the UI
    res.status(500).json({
      error: 'Failed to parse or save work orders.',
      detail: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });
  }
};

// ================= GET ALL =================
exports.getAllWorkOrders = async (req, res) => {
  try {
    const result = await sql`
      SELECT work_order_id, pm_id, status, target_start_date, frequency, description,
             CASE WHEN status <> 'CONCL' AND target_start_date < NOW() THEN true ELSE false END AS is_overdue
      FROM work_order
      ORDER BY target_start_date DESC NULLS LAST
    `;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= DELETE ONE =================
exports.deleteWorkOrder = async (req, res) => {
  const { work_order_id } = req.params;
  try {
    await sql`DELETE FROM work_order WHERE work_order_id = ${work_order_id}`;
    res.json({ message: `Deleted work order ${work_order_id}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================= CLEAR ALL =================
exports.clearAllWorkOrders = async (req, res) => {
  try {
    await sql`DELETE FROM work_order`;
    res.json({ message: 'All work orders cleared.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};