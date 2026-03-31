
CREATE TABLE areas (
    pm_id VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255)
);

CREATE TABLE grid (
    id SERIAL PRIMARY KEY,
    x_pos INTEGER,
    y_pos INTEGER,
    pm_id VARCHAR(50) REFERENCES areas(pm_id),
    UNIQUE (pm_id, x_pos, y_pos)
);

CREATE TABLE work_order (
    work_order_id VARCHAR(50) PRIMARY KEY,
    pm_id VARCHAR(50) REFERENCES areas(pm_id),
    status VARCHAR(50),
    target_start_date TIMESTAMP,
    frequency VARCHAR(50),
    description VARCHAR(255)
);