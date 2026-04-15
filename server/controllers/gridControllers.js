const sql = require('../config/pool');

// ================= SAVE AREA =================
exports.saveGridArea = async (req, res) => {
    const { pm_id, description, coordinates } = req.body;

    console.log("Coords length:", coordinates?.length);

    if (!pm_id || !coordinates || !Array.isArray(coordinates)) {
        return res.status(400).json({ error: "Missing or invalid PM ID and coordinates." });
    }

    try {
        // ensure area exists
        await sql`
            INSERT INTO areas (pm_id, description)
            VALUES (${pm_id}, ${description || `Mapped area for ${pm_id}`})
            ON CONFLICT (pm_id)
            DO UPDATE SET description = EXCLUDED.description
        `;

        // clear old grid
        await sql`DELETE FROM grid WHERE pm_id = ${pm_id}`;

        // 🔥 safe per-row insert
        for (let coord of coordinates) {
            const [x, y] = coord.split(',').map(Number);
            if (isNaN(x) || isNaN(y)) continue;

            await sql`
                INSERT INTO grid (pm_id, x_pos, y_pos)
                VALUES (${pm_id}, ${x}, ${y})
                ON CONFLICT (pm_id, x_pos, y_pos) DO NOTHING
            `;
        }

        console.log("Saved coordinates:", coordinates.length, "rows for PM:", pm_id);
        res.status(200).json({ message: "Area successfully mapped and saved." });

    } catch (error) {
        console.error("Database error saving grid:", error);
        res.status(500).json({ error: "Internal server error while saving map." });
    }
};


// ================= GET ALL =================
exports.getAllGrids = async (req, res) => {
    try {
        const result = await sql`SELECT pm_id, x_pos, y_pos FROM grid`;
        res.status(200).json(result);
    } catch (error) {
        console.error("Database error fetching grids:", error);
        res.status(500).json({ error: "Internal server error." });
    }
};


// ================= DELETE =================
exports.deleteGridArea = async (req, res) => {
    const { pm_id } = req.params;

    try {
        await sql`DELETE FROM grid WHERE pm_id = ${pm_id}`;
        await sql`DELETE FROM areas WHERE pm_id = ${pm_id}`;

        res.status(200).json({ message: `Successfully deleted area ${pm_id}` });

    } catch (error) {
        console.error("Database error deleting area:", error);
        res.status(500).json({ error: "Internal server error while deleting map area." });
    }
};


// ================= UPDATE =================
exports.updateGridArea = async (req, res) => {
    const targetPmId = req.params.pm_id;
    const { pm_id, description, coordinates } = req.body;

    try {
        await sql`DELETE FROM grid WHERE pm_id = ${targetPmId}`;

        for (let coord of coordinates) {
            const [x, y] = coord.split(',').map(Number);
            if (isNaN(x) || isNaN(y)) continue;

            await sql`
                INSERT INTO grid (pm_id, x_pos, y_pos)
                VALUES (${pm_id}, ${x}, ${y})
            `;
        }

        res.status(200).json({ message: "Area successfully updated!" });

    } catch (error) {
        console.error("Error updating area:", error);
        res.status(500).json({ error: "Failed to update area" });
    }
};