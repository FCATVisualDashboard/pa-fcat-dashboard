const request = require('supertest');
const express = require('express');
const gridRoutes = require('../routes/gridRoutes');

// MOCK THE SQL DRIVER: replace neon sql tag with a jest function
jest.mock('../config/pool', () => {
  const mockSql = jest.fn();
  mockSql.mockResolvedValue([]);
  return mockSql;
});

const sql = require('../config/pool');

const app = express();
app.use(express.json());
app.use('/api/grid', gridRoutes);

describe('Grid API Routes', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    sql.mockResolvedValue([]); // default: return empty array
  });

  // --- TEST 1: GET ROUTE ---
  it('GET /api/grid/all - should successfully fetch coordinates', async () => {
    const fakeRows = [
      { pm_id: "TEST-01", x_pos: 10, y_pos: 15 },
      { pm_id: "TEST-01", x_pos: 11, y_pos: 15 }
    ];
    sql.mockResolvedValueOnce(fakeRows);

    const response = await request(app).get('/api/grid/all');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].pm_id).toBe("TEST-01");
  });

  // --- TEST 2: POST ROUTE ---
  it('POST /api/grid/save - should successfully save an area', async () => {
    sql.mockResolvedValue([]); // all queries succeed

    const payload = {
      pm_id: "HVAC-123",
      description: "Main Vent",
      coordinates: ["10,10", "10,11"]
    };

    const response = await request(app)
      .post('/api/grid/save')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Area successfully mapped and saved.");
    expect(sql).toHaveBeenCalled();
  });

  // --- TEST 3: DELETE ROUTE ---
  it('DELETE /api/grid/delete/:pm_id - should delete an area', async () => {
    sql.mockResolvedValue([]);

    const response = await request(app).delete('/api/grid/delete/HVAC-123');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Successfully deleted area HVAC-123");
    expect(sql).toHaveBeenCalledTimes(2); // DELETE grid + DELETE areas
  });

  // --- TEST 4: ERROR HANDLING ---
  it('POST /api/grid/save - should reject invalid payloads with a 400 error', async () => {
    const badPayload = { pm_id: "HVAC-123" };

    const response = await request(app)
      .post('/api/grid/save')
      .send(badPayload);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Missing or invalid PM ID and coordinates.");
    expect(sql).not.toHaveBeenCalled(); // DB shouldn't be touched
  });

});