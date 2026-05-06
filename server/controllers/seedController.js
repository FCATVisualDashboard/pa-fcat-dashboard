// server/controllers/seedController.js
// Real work orders from Maximo export + synthetic entries for untested color states.
// areas table is never touched, only work_order and grid arereseeded.

const { Pool } = require('@neondatabase/serverless');

function getPool() {
    return new Pool({ connectionString: process.env.DATABASE_URL });
}

exports.applySeed = async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Seed endpoint is disabled in production.' });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Wipe work orders and grid only — areas must not be touched
        await client.query('TRUNCATE work_order, grid');

        // -------------------------------------------------------------------
        // WORK ORDERS
        //
        // Real rows from Maximo export (WASSGN — yellow):
        //   TW-86, TW-89, TW-96, TW-102, TW-108
        //
        // Synthetic rows against real areas for full color coverage:
        //   TW-74, TW-75  → CONCL  (green)
        //   TW-76, TW-77  → APPR   (orange)
        //   TW-78         → APPR + past date = OVERDUE (red)
        //   TW-79         → no work order = INACTIVE (gray)
        //
        // To add more real rows: copy the pattern below and match pm_id
        // exactly to what's in your areas table (e.g. '86', '89', '96').
        // -------------------------------------------------------------------
        await client.query(`
            INSERT INTO work_order
              (work_order_id, pm_id, status, target_start_date, frequency, description)
            VALUES
              -- REAL: from Maximo export 06-May-2026 (WASSGN → YELLOW)
              ('3843517', '96',  'WASSGN', '2026-05-11', 'Monthly', 'BM*-[TW-96] TORQUE & CLEAN (48)'),
              ('3866915', '86',  'WASSGN', '2026-05-30', 'Monthly', 'BM-[TW-86] TORQUE & CLEAN (52)'),
              ('3866923', '89',  'WASSGN', '2026-05-07', 'Monthly', 'BM-[TW-89] TORQUE & CLEAN (46)'),
              ('3866945', '102', 'WASSGN', '2026-05-22', 'Monthly', 'BM-[TW-102] TORQUE & CLEAN (64)'),
              ('3866947', '108', 'WASSGN', '2026-05-13', 'Monthly', 'BM-[TW-108] TORQUE & CLEAN (38)'),

              -- SYNTHETIC: CONCL (GREEN) — replace with real WOs when available
              ('SYN-74-A', '74', 'CONCL', '2026-05-03', 'Monthly', 'BM-[TW-74] TORQUE & CLEAN'),
              ('SYN-75-A', '75', 'CONCL', '2026-05-03', 'Monthly', 'BM-[TW-75] TORQUE & CLEAN'),

              -- SYNTHETIC: APPR (ORANGE)
              ('SYN-76-A', '76', 'APPR', '2026-05-15', 'Monthly', 'BM-[TW-76] TORQUE & CLEAN'),
              ('SYN-77-A', '77', 'APPR', '2026-05-15', 'Monthly', 'BM-[TW-77] TORQUE & CLEAN'),

              -- SYNTHETIC: OVERDUE (RED) — past date + not CONCL
              ('SYN-78-A', '78', 'APPR', '2026-04-10', 'Monthly', 'BM-[TW-78] TORQUE & CLEAN')

              -- TW-79 intentionally has no work order → renders GRAY (INACTIVE)

            ON CONFLICT (work_order_id) DO UPDATE
              SET status            = EXCLUDED.status,
                  target_start_date = EXCLUDED.target_start_date,
                  frequency         = EXCLUDED.frequency,
                  description       = EXCLUDED.description
        `);

        // -------------------------------------------------------------------
        // GRID — 20x20 cell blocks (400 cells each = clearly visible)
        // Spread across canvas (854 x 480). Positions are test clusters only —
        // replace with real painted zones via /admin once zones are defined.
        // -------------------------------------------------------------------
        const zones = [
            ['96',  50,  30],   // YELLOW
            ['86',  170, 30],   // YELLOW
            ['89',  290, 30],   // YELLOW
            ['102', 410, 30],   // YELLOW
            ['108', 530, 30],   // YELLOW
            ['74',  50,  200],  // GREEN
            ['75',  170, 200],  // GREEN
            ['76',  290, 200],  // ORANGE
            ['77',  410, 200],  // ORANGE
            ['78',  530, 200],  // RED
            ['79',  650, 200],  // GRAY (inactive)
        ];

        for (const [pm_id, ox, oy] of zones) {
            const values = [];
            for (let dx = 0; dx < 20; dx++) {
                for (let dy = 0; dy < 20; dy++) {
                    values.push(`('${pm_id}', ${ox + dx}, ${oy + dy})`);
                }
            }
            await client.query(`
                INSERT INTO grid (pm_id, x_pos, y_pos)
                VALUES ${values.join(',')}
                ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING
            `);
        }

        await client.query('COMMIT');
        console.log('[SEED] Database seeded successfully.');
        res.status(200).json({
            message: 'Database seeded successfully.',
            real_work_orders: 5,
            synthetic_work_orders: 5,
            note: '34 rows from Excel unmatched — their zones (TW-22, TW-23, 13L_RSA etc.) are not yet in the areas table.',
            zones: [
                { pm_id: '96',  status: 'WASSGN  (YELLOW) — real' },
                { pm_id: '86',  status: 'WASSGN  (YELLOW) — real' },
                { pm_id: '89',  status: 'WASSGN  (YELLOW) — real' },
                { pm_id: '102', status: 'WASSGN  (YELLOW) — real' },
                { pm_id: '108', status: 'WASSGN  (YELLOW) — real' },
                { pm_id: '74',  status: 'CONCL   (GREEN)  — synthetic' },
                { pm_id: '75',  status: 'CONCL   (GREEN)  — synthetic' },
                { pm_id: '76',  status: 'APPR    (ORANGE) — synthetic' },
                { pm_id: '77',  status: 'APPR    (ORANGE) — synthetic' },
                { pm_id: '78',  status: 'OVERDUE (RED)    — synthetic' },
                { pm_id: '79',  status: 'INACTIVE (GRAY)  — no work order' },
            ]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[SEED] Error seeding database:', error);
        res.status(500).json({ error: 'Failed to apply seed data.', detail: error.message });
    } finally {
        client.release();
        await pool.end();
    }
};

exports.resetSeed = async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Seed endpoint is disabled in production.' });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('TRUNCATE work_order, grid');
        await client.query('COMMIT');
        res.status(200).json({ message: 'work_order and grid cleared. areas untouched.' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Failed to reset.', detail: error.message });
    } finally {
        client.release();
        await pool.end();
    }
};

exports.getSeedStatus = async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Seed endpoint is disabled in production.' });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
        const areas  = (await client.query('SELECT * FROM areas ORDER BY pm_id')).rows;
        const orders = (await client.query('SELECT * FROM work_order ORDER BY pm_id')).rows;
        const grid   = (await client.query('SELECT pm_id, COUNT(*) AS cell_count FROM grid GROUP BY pm_id')).rows;

        const woByPm = {};
        orders.forEach(wo => {
            if (!woByPm[wo.pm_id]) woByPm[wo.pm_id] = [];
            woByPm[wo.pm_id].push(wo);
        });
        const gridByPm = {};
        grid.forEach(g => { gridByPm[g.pm_id] = parseInt(g.cell_count); });

        const now = new Date();
        const summary = areas.map(area => {
            const wos = woByPm[area.pm_id] || [];
            let resolved = 'INACTIVE';
            if (wos.length > 0) {
                const hasOverdue = wos.some(w => w.status !== 'CONCL' && new Date(w.target_start_date) < now);
                if (hasOverdue)                                resolved = 'OVERDUE';
                else if (wos.some(w => w.status === 'WASSGN')) resolved = 'WASSGN';
                else if (wos.some(w => w.status === 'APPR'))   resolved = 'APPR';
                else if (wos.every(w => w.status === 'CONCL')) resolved = 'CONCL';
            }
            return {
                pm_id:            area.pm_id,
                description:      area.description,
                cell_count:       gridByPm[area.pm_id] || 0,
                work_order_count: wos.length,
                resolved_status:  resolved,
            };
        }).filter(z => z.work_order_count > 0 || z.cell_count > 0);

        res.status(200).json({ seed_status: summary });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch status.', detail: error.message });
    } finally {
        client.release();
        await pool.end();
    }
};