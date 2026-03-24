-- server/src/db/seed.sql

-- PM Zones (areas)
INSERT INTO areas (pm_id, description) VALUES
  ('123001', 'Terminal 1 - Concourse A'),
  ('123002', 'Terminal 4 - Main Hall'),
  ('123003', 'Terminal 8 - Gate Area'),
  ('123004', 'Runway 13L Perimeter'),
  ('123005', 'Ground Support Equipment Yard')
ON CONFLICT (pm_id) DO NOTHING;

-- Grid cells (mapping zones to canvas coordinates)
INSERT INTO grid (grid_id, x_pos, y_pos, pm_id) VALUES
  ('x10_y20', 10, 20, '123001'),
  ('x11_y20', 11, 20, '123001'),
  ('x12_y20', 12, 20, '123001'),
  ('x50_y40', 50, 40, '123002'),
  ('x51_y40', 51, 40, '123002')
ON CONFLICT (grid_id) DO NOTHING;

-- Work orders
INSERT INTO work_order (work_order_id, pm_id, status, target_start_date, frequency, description) VALUES
  ('WO-10001', '123001', 'APPR',   '2026-03-01', 'Monthly', 'Torque check - Terminal 1 A gates'),
  ('WO-10002', '123002', 'WASSGN', '2026-03-05', 'Monthly', 'Clean PM - Terminal 4 main hall'),
  ('WO-10003', '123003', 'CONCL',  '2026-03-10', 'Monthly', 'Torque check - Terminal 8 gates'),
  ('WO-10004', '123004', 'APPR',   '2026-02-15', 'Monthly', 'Runway perimeter inspection'),
  ('WO-10005', '123005', 'WASSGN', '2026-03-20', 'Monthly', 'GSE yard clean PM')
ON CONFLICT (work_order_id) DO NOTHING;