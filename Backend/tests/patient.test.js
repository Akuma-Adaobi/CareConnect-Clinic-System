const request = require('supertest');
const bcrypt = require('bcrypt');

jest.mock('../db', () => ({ query: jest.fn(), on: jest.fn() }));
const pool = require('../db');
const app = require('../app');

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
});

afterEach(() => jest.clearAllMocks());

describe('Patient registration', () => {
  test('rejects a request missing required fields', async () => {
    const res = await request(app).post('/api/patients/register').send({ email: 'a@test.com' });
    expect(res.status).toBe(400);
  });

  test('rejects a duplicate email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ patientid: 'P001', email: 'ada@test.com' }] });

    const res = await request(app).post('/api/patients/register').send({
      firstName: 'Ada', lastName: 'Obi', email: 'ada@test.com', password: 'secret123',
      phone: '08012345678', dateOfBirth: '1998-05-01', gender: 'Female',
    });

    expect(res.status).toBe(409);
  });

  test('registers successfully with valid, unique data', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // no existing patient with this email
      .mockResolvedValueOnce({
        rows: [{
          patientid: 'P001', firstname: 'Ada', lastname: 'Obi', email: 'ada@test.com',
          phone: '08012345678', dateofbirth: '1998-05-01', gender: 'Female', address: null,
        }],
      });

    const res = await request(app).post('/api/patients/register').send({
      firstName: 'Ada', lastName: 'Obi', email: 'ada@test.com', password: 'secret123',
      phone: '08012345678', dateOfBirth: '1998-05-01', gender: 'Female',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.patient.email).toBe('ada@test.com');
  });
});

describe('Patient login', () => {
  test('rejects an unknown email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/patients/login').send({ email: 'nobody@test.com', password: 'x' });
    expect(res.status).toBe(401);
  });

  test('rejects the wrong password', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    pool.query.mockResolvedValueOnce({ rows: [{ patientid: 'P001', email: 'ada@test.com', passwordhash: hash }] });

    const res = await request(app).post('/api/patients/login').send({ email: 'ada@test.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  test('logs in with the correct password', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    pool.query.mockResolvedValueOnce({ rows: [{ patientid: 'P001', email: 'ada@test.com', passwordhash: hash }] });

    const res = await request(app).post('/api/patients/login').send({ email: 'ada@test.com', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
