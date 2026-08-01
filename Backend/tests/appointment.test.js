const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../db', () => ({ query: jest.fn(), on: jest.fn() }));
const pool = require('../db');
const app = require('../app');

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
});

afterEach(() => jest.clearAllMocks());

function patientToken() {
  return jwt.sign({ id: 'P001', email: 'ada@test.com', role: 'patient' }, process.env.JWT_SECRET);
}

describe('Appointment booking', () => {
  test('rejects booking without a token', async () => {
    const res = await request(app)
      .post('/api/appointments/book')
      .send({ doctorId: 'D001', date: '2026-08-10', time: '09:30' });
    expect(res.status).toBe(401);
  });

  test('rejects a slot that is already taken', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ doctorid: 'D001', firstname: 'Ifeoma', lastname: 'Nwosu' }] }) // doctor exists
      .mockResolvedValueOnce({ rows: [{ appointmentid: 'A001' }] }); // conflicting appointment found

    const res = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${patientToken()}`)
      .send({ doctorId: 'D001', date: '2026-08-10', time: '09:30', reason: 'Check-up' });

    expect(res.status).toBe(409);
  });

  test('books successfully when the slot is free', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ doctorid: 'D001' }] }) // doctor exists
      .mockResolvedValueOnce({ rows: [] }) // no conflict
      .mockResolvedValueOnce({
        rows: [{
          appointmentid: 'A002', patientid: 'P001', doctorid: 'D001',
          appointmentdate: '2026-08-10', appointmenttime: '09:30:00', status: 'Scheduled',
        }],
      });

    const res = await request(app)
      .post('/api/appointments/book')
      .set('Authorization', `Bearer ${patientToken()}`)
      .send({ doctorId: 'D001', date: '2026-08-10', time: '09:30', reason: 'Check-up' });

    expect(res.status).toBe(201);
    expect(res.body.appointment.status).toBe('Scheduled');
  });
});

describe('Appointment cancellation', () => {
  test('rejects cancelling someone else\'s appointment', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ appointmentid: 'A002', patientid: 'P999', status: 'Scheduled' }],
    });

    const res = await request(app)
      .put('/api/appointments/A002/cancel')
      .set('Authorization', `Bearer ${patientToken()}`);

    expect(res.status).toBe(403);
  });

  test('cancels your own scheduled appointment', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ appointmentid: 'A002', patientid: 'P001', status: 'Scheduled' }] })
      .mockResolvedValueOnce({ rows: [{ appointmentid: 'A002', status: 'Cancelled' }] });

    const res = await request(app)
      .put('/api/appointments/A002/cancel')
      .set('Authorization', `Bearer ${patientToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.appointment.status).toBe('Cancelled');
  });
});
