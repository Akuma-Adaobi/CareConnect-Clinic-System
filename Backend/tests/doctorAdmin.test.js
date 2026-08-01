const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.mock('../db', () => ({ query: jest.fn(), on: jest.fn() }));
const pool = require('../db');
const app = require('../app');

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
});

afterEach(() => jest.clearAllMocks());

function adminToken() {
  return jwt.sign({ id: 'AM001', email: 'manager@test.com', role: 'admin' }, process.env.JWT_SECRET);
}

describe('Doctor login', () => {
  test('rejects an unknown email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/doctors/login').send({ email: 'nobody@test.com', password: 'x' });
    expect(res.status).toBe(401);
  });

  test('logs in with correct credentials', async () => {
    const hash = await bcrypt.hash('Doctor123!', 10);
    pool.query.mockResolvedValueOnce({
      rows: [{
        doctorid: 'D001', email: 'ifeoma@test.com', passwordhash: hash,
        firstname: 'Ifeoma', lastname: 'Nwosu', specialization: 'General Practice',
      }],
    });

    const res = await request(app).post('/api/doctors/login').send({ email: 'ifeoma@test.com', password: 'Doctor123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('Admin-only routes', () => {
  test('rejects a patient token trying to add a doctor', async () => {
    const patientTok = jwt.sign({ id: 'P001', role: 'patient' }, process.env.JWT_SECRET);
    const res = await request(app)
      .post('/api/admin/doctors')
      .set('Authorization', `Bearer ${patientTok}`)
      .send({ firstName: 'New', lastName: 'Doc', email: 'new@test.com', password: 'x' });

    expect(res.status).toBe(403);
  });

  test('lets an admin token add a doctor', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // no existing doctor with that email
      .mockResolvedValueOnce({
        rows: [{
          doctorid: 'D002', firstname: 'New', lastname: 'Doc',
          email: 'new@test.com', specialization: 'Cardiology',
        }],
      })
      .mockResolvedValueOnce({ rows: [] }); // audit log insert

    const res = await request(app)
      .post('/api/admin/doctors')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ firstName: 'New', lastName: 'Doc', email: 'new@test.com', password: 'secret123', specialization: 'Cardiology' });

    expect(res.status).toBe(201);
    expect(res.body.doctor.email).toBe('new@test.com');
  });
});
