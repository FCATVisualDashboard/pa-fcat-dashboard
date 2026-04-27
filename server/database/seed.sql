-- =============================================================================
-- seed.sql — Full Development Seed for JFK PM Dashboard
-- Covers every status state: CONCL, APPR, WASSGN, OVERDUE, and INACTIVE
-- Work orders use the CURRENT month so the dashboard color logic fires live.
-- Run via: psql $DATABASE_URL -f seed.sql
--       or: POST /api/seed/apply  (dev endpoint)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- WIPE (safe re-seed: delete in FK-safe order)
-- -----------------------------------------------------------------------------
DELETE FROM work_order;
DELETE FROM grid;
DELETE FROM areas;

-- -----------------------------------------------------------------------------
-- 1. AREAS  (PM Zones)
-- -----------------------------------------------------------------------------
INSERT INTO areas (pm_id, description) VALUES
  ('667001', 'Terminal 1 – Concourse B'),
  ('667002', 'Terminal 4 – Main Hall'),
  ('667003', 'Terminal 8 – Gate Area'),
  ('667004', 'Runway 13L Perimeter'),
  ('667005', 'GSE Yard – South'),
  ('667006', 'Taxiway Alpha'),
  ('667007', 'Fuel Farm'),
  ('667008', 'Cargo Apron – North')
ON CONFLICT (pm_id) DO UPDATE SET description = EXCLUDED.description;

-- -----------------------------------------------------------------------------
-- 2. GRID  (20 × 20 px cells mapped to the 854 × 480 canvas grid)
-- Each zone gets a visible cluster of cells so every color shows on the map.
-- Coordinates are in grid-cell units (divide by CELL_SIZE=4 on the frontend).
-- -----------------------------------------------------------------------------

-- 667001 → GREEN (CONCL) — upper-left cluster
INSERT INTO grid (pm_id, x_pos, y_pos) VALUES
  ('667001', 60, 50), ('667001', 61, 50), ('667001', 62, 50),
  ('667001', 60, 51), ('667001', 61, 51), ('667001', 62, 51),
  ('667001', 60, 52), ('667001', 61, 52), ('667001', 62, 52)
ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING;

-- 667002 → ORANGE (APPR) — upper-center cluster
INSERT INTO grid (pm_id, x_pos, y_pos) VALUES
  ('667002', 200, 60), ('667002', 201, 60), ('667002', 202, 60),
  ('667002', 200, 61), ('667002', 201, 61), ('667002', 202, 61),
  ('667002', 200, 62), ('667002', 201, 62), ('667002', 202, 62)
ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING;

-- 667003 → YELLOW (WASSGN) — upper-right cluster
INSERT INTO grid (pm_id, x_pos, y_pos) VALUES
  ('667003', 380, 70), ('667003', 381, 70), ('667003', 382, 70),
  ('667003', 380, 71), ('667003', 381, 71), ('667003', 382, 71),
  ('667003', 380, 72), ('667003', 381, 72), ('667003', 382, 72)
ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING;

-- 667004 → RED (OVERDUE) — mid-left cluster
INSERT INTO grid (pm_id, x_pos, y_pos) VALUES
  ('667004', 80, 200), ('667004', 81, 200), ('667004', 82, 200),
  ('667004', 80, 201), ('667004', 81, 201), ('667004', 82, 201),
  ('667004', 80, 202), ('667004', 81, 202), ('667004', 82, 202)
ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING;

-- 667005 → GRAY (INACTIVE — no work orders this month) — mid-center cluster
INSERT INTO grid (pm_id, x_pos, y_pos) VALUES
  ('667005', 280, 220), ('667005', 281, 220), ('667005', 282, 220),
  ('667005', 280, 221), ('667005', 281, 221), ('667005', 282, 221),
  ('667005', 280, 222), ('667005', 281, 222), ('667005', 282, 222)
ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING;

-- 667006 → RED via cascade (one WASSGN + one OVERDUE → worst-case = RED)
INSERT INTO grid (pm_id, x_pos, y_pos) VALUES
  ('667006', 480, 180), ('667006', 481, 180), ('667006', 482, 180),
  ('667006', 480, 181), ('667006', 481, 181), ('667006', 482, 181),
  ('667006', 480, 182), ('667006', 481, 182), ('667006', 482, 182)
ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING;

-- 667007 → GREEN (CONCL) — lower-left cluster
INSERT INTO grid (pm_id, x_pos, y_pos) VALUES
  ('667007', 100, 350), ('667007', 101, 350), ('667007', 102, 350),
  ('667007', 100, 351), ('667007', 101, 351), ('667007', 102, 351),
  ('667007', 100, 352), ('667007', 101, 352), ('667007', 102, 352)
ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING;

-- 667008 → ORANGE (APPR) — lower-right cluster
INSERT INTO grid (pm_id, x_pos, y_pos) VALUES
  ('667008', 650, 360), ('667008', 651, 360), ('667008', 652, 360),
  ('667008', 650, 361), ('667008', 651, 361), ('667008', 652, 361),
  ('667008', 650, 362), ('667008', 651, 362), ('667008', 652, 362)
ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. WORK ORDERS
-- target_start_date is set to the CURRENT calendar month so the backend
-- "current month filter" logic includes them immediately after seeding.
-- One row per scenario type. Zone 667006 gets two WOs to test aggregation.
-- -----------------------------------------------------------------------------

INSERT INTO work_order (work_order_id, pm_id, status, target_start_date, frequency, description) VALUES

  -- GREEN: completed this month
  ('WO-667001-A', '667001', 'CONCL',
   DATE_TRUNC('month', NOW()) + INTERVAL '2 days',
   'Monthly', 'Torque check – T1 Concourse B gates'),

  -- ORANGE: approved, not yet started
  ('WO-667002-A', '667002', 'APPR',
   DATE_TRUNC('month', NOW()) + INTERVAL '5 days',
   'Monthly', 'Clean PM – T4 Main Hall floor lighting'),

  -- YELLOW: waiting for supervisor approval
  ('WO-667003-A', '667003', 'WASSGN',
   DATE_TRUNC('month', NOW()) + INTERVAL '8 days',
   'Monthly', 'Torque check – T8 gate hold-room fixtures'),

  -- RED: overdue (target was last month, still not CONCL)
  ('WO-667004-A', '667004', 'APPR',
   DATE_TRUNC('month', NOW()) - INTERVAL '20 days',
   'Monthly', 'Runway 13L perimeter lighting inspection'),

  -- INACTIVE: no work order inserted for 667005 this month (will show GRAY)

  -- MULTI-WO AGGREGATION: one approved + one overdue → worst-case RED
  ('WO-667006-A', '667006', 'WASSGN',
   DATE_TRUNC('month', NOW()) + INTERVAL '3 days',
   'Monthly', 'Taxiway Alpha edge light torque check'),
  ('WO-667006-B', '667006', 'APPR',
   DATE_TRUNC('month', NOW()) - INTERVAL '25 days',
   'Monthly', 'Taxiway Alpha supplemental clean PM'),

  -- GREEN: second completed zone
  ('WO-667007-A', '667007', 'CONCL',
   DATE_TRUNC('month', NOW()) + INTERVAL '1 day',
   'Monthly', 'Fuel farm containment area torque check'),

  -- ORANGE: second approved zone
  ('WO-667008-A', '667008', 'APPR',
   DATE_TRUNC('month', NOW()) + INTERVAL '10 days',
   'Monthly', 'Cargo apron north floodlight clean PM')

ON CONFLICT (work_order_id) DO UPDATE
  SET pm_id             = EXCLUDED.pm_id,
      status            = EXCLUDED.status,
      target_start_date = EXCLUDED.target_start_date,
      frequency         = EXCLUDED.frequency,
      description       = EXCLUDED.description;