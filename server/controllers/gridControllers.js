const pool = require('../config/pool');

exports.saveGridArea = async (req, res) => {
    const { pm_id, description, coordinates } = req.body;

    if (!pm_id || !coordinates || !Array.isArray(coordinates)) {
        return res.status(400).json({ error: "Missing or invalid PM ID and coordinates." });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ensure the PM ID exists in the areas table first
        await client.query(
    `INSERT INTO areas (pm_id, description) VALUES ($1, $2) ON CONFLICT (pm_id) DO UPDATE SET description = EXCLUDED.description`,
    [pm_id, description || `Mapped area for ${pm_id}`]
);

        // wipe the slate clean for this specific PM ID to prevent overlapping ghost data
        await client.query(`DELETE FROM grid WHERE pm_id = $1`, [pm_id]);

        // batch insert all the new coordinates
        if (coordinates.length > 0) {
            let queryText = 'INSERT INTO grid (pm_id, x_pos, y_pos) VALUES ';
            let values = [];
            let valueIndex = 1;

            coordinates.forEach((coord, i) => {
                const [x, y] = coord.split(',');
                queryText += `($${valueIndex++}, $${valueIndex++}, $${valueIndex++})`;
                if (i < coordinates.length - 1) queryText += ', ';
                values.push(pm_id, parseInt(x), parseInt(y));
            });

            // if a duplicate coordinate accidentally slips in, ignore it instead of crashing
            queryText += ' ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING';

            await client.query(queryText, values);
        }

        await client.query('COMMIT'); 
        console.log("Saved coordinates:", coordinates.length, "rows for PM:", pm_id);
        res.status(200).json({ message: "Area successfully mapped and saved." });

    } catch (error) {
        await client.query('ROLLBACK'); 
        console.error("Database error saving grid:", error);
        res.status(500).json({ error: "Internal server error while saving map." });
    } finally {
        client.release(); 
    }
};

// fetch all saved coordinates
exports.getAllGrids = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(`SELECT pm_id, x_pos, y_pos FROM grid`);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Database error fetching grids:", error);
        res.status(500).json({ error: "Internal server error." });
    } finally {
        client.release();
    }
};

exports.deleteGridArea = async (req, res) => {
    const { pm_id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); 

        // delete the individual pixels
        await client.query(`DELETE FROM grid WHERE pm_id = $1`, [pm_id]);

        // delete the parent record from the areas table
        await client.query(`DELETE FROM areas WHERE pm_id = $1`, [pm_id]);

        await client.query('COMMIT'); 
        res.status(200).json({ message: `Successfully deleted area ${pm_id}` });

    } catch (error) {
        await client.query('ROLLBACK'); 
        console.error("Database error deleting area:", error);
        res.status(500).json({ error: "Internal server error while deleting map area." });
    } finally {
        client.release(); 
    }
};