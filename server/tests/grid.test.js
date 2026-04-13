const request = require('supertest');
const express = require('express');
const gridRoutes = require('../routes/gridRoutes');
const pool = require('../config/pool'); // import your DB pool

// MOCK THE DATABASE: tell Jest to replace real pool with fake functions
jest.mock('../config/pool', () => ({
  connect: jest.fn()
}));

// setup miniature, fake Express app just for tests
const app = express();
app.use(express.json());
app.use('/api/grid', gridRoutes);

describe('Grid API Routes', () => {
  let mockClient;

  // before every single test, reset the fake database so tests don't pollute each other
  beforeEach(() => {
    jest.clearAllMocks();
    
    // create a fake Postgres client that just returns success when queried
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    // tell the pool to hand over fake client when pool.connect() is called
    pool.connect.mockResolvedValue(mockClient);
  });

  // --- TEST 1: GET ROUTE ---
  it('GET /api/grid/all - should successfully fetch coordinates', async () => {
    // setup the fake DB to return 2 fake coordinates
    const fakeRows = [
      { pm_id: "TEST-01", x_pos: 10, y_pos: 15 },
      { pm_id: "TEST-01", x_pos: 11, y_pos: 15 }
    ];
    mockClient.query.mockResolvedValueOnce({ rows: fakeRows });

    // fire a fake HTTP GET request at the route
    const response = await request(app).get('/api/grid/all');

    // assertions: did the server do exactly what we expected?
    expect(response.status).toBe(200);                 // did it return OK?
    expect(response.body).toHaveLength(2);             // did it send back 2 items?
    expect(response.body[0].pm_id).toBe("TEST-01");    // is the data correct?
    expect(mockClient.release).toHaveBeenCalledTimes(1); // did it safely close the DB connection?
  });

  // --- TEST 2: POST ROUTE ---
  it('POST /api/grid/save - should successfully save an area', async () => {
    // tell the fake DB to just say "Success" for every SQL query
    mockClient.query.mockResolvedValue();

    const payload = {
      pm_id: "HVAC-123",
      description: "Main Vent",
      coordinates: ["10,10", "10,11"]
    };

    // fire the POST request with our payload
    const response = await request(app)
      .post('/api/grid/save')
      .send(payload);

    // assertions
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Area successfully mapped and saved.");
    
    // the controller should run exactly 4 SQL queries: BEGIN, INSERT area, DELETE old grid, INSERT new grid, COMMIT
    // (check for at least 4 to ensure the transaction logic is running)
    expect(mockClient.query.mock.calls.length).toBeGreaterThanOrEqual(4); 
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  // --- TEST 3: DELETE ROUTE ---
  it('DELETE /api/grid/delete/:pm_id - should delete an area', async () => {
    mockClient.query.mockResolvedValue();

    // fire the DELETE request with a URL parameter
    const response = await request(app).delete('/api/grid/delete/HVAC-123');

    // assertions
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Successfully deleted area HVAC-123");
    
    // did it run the BEGIN, DELETE grid, DELETE area, and COMMIT queries?
    expect(mockClient.query.mock.calls.length).toBe(4);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  // --- TEST 4: ERROR HANDLING ---
  it('POST /api/grid/save - should reject invalid payloads with a 400 error', async () => {
    // send a payload missing the required 'coordinates' array
    const badPayload = { pm_id: "HVAC-123" };

    const response = await request(app)
      .post('/api/grid/save')
      .send(badPayload);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Missing or invalid PM ID and coordinates.");
    
    // the DB shouldn't even be touched if the data is bad
    expect(pool.connect).not.toHaveBeenCalled(); 
  });

});