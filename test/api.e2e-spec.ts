import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp } from './e2e-app';

const hasDb = !!process.env.DATABASE_URL;

(hasDb ? describe : describe.skip)('API (e2e, real DB + seed)', () => {
  let app: INestApplication;
  let adminToken: string;
  let receptionistToken: string;

  beforeAll(async () => {
    app = await createE2eApp();
    const adminRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@zahro.dental', password: 'admin123' });
    if (![200, 201].includes(adminRes.status)) {
      throw new Error(
        `Seed kerak: admin login ${adminRes.status} — prisma migrate + prisma:seed`,
      );
    }
    adminToken = adminRes.body.access_token as string;

    const recRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'gulnora@zahro.dental', password: 'reception123' });
    if (![200, 201].includes(recRes.status) || !recRes.body.access_token) {
      throw new Error(`Receptionist login muvaffaqiyatsiz: ${recRes.status}`);
    }
    receptionistToken = recRes.body.access_token as string;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    it('POST /auth/login — 400 bo‘sh body', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });

    it('POST /auth/login — 400 noto‘g‘ri email format', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'bad', password: 'x' })
        .expect(400);
    });

    it('POST /auth/login — 401 noto‘g‘ri parol', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@zahro.dental', password: 'wrong' })
        .expect(401);
    });

    it('POST /auth/login — 200 yoki 201 admin (Nest POST default)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@zahro.dental', password: 'admin123' });
      expect([200, 201]).toContain(res.status);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.user).toMatchObject({
        email: 'admin@zahro.dental',
        role: 'admin',
      });
    });
  });

  describe('Patients + JWT', () => {
    it('GET /patients — 401 token yo‘q', () => {
      return request(app.getHttpServer()).get('/patients').expect(401);
    });

    it('GET /patients — 200 ro‘yxat', async () => {
      const res = await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /patients/p1 — 200', () => {
      return request(app.getHttpServer())
        .get('/patients/p1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((r) => {
          expect(r.body.id).toBe('p1');
        });
    });

    it('GET /patients/not-real-id-xyz — 404', () => {
      return request(app.getHttpServer())
        .get('/patients/not-real-id-xyz')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('POST /patients — 400 telefon format', () => {
      return request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'T',
          lastName: 'Test',
          age: 20,
          phone: '123',
          source: 'walk-in',
        })
        .expect(400);
    });

    it('POST /patients — 201 va DELETE tozalash', async () => {
      const phone = `+998901234${Date.now() % 10000}`;
      const create = await request(app.getHttpServer())
        .post('/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'E2E',
          lastName: 'Patient',
          age: 22,
          phone,
          source: 'phone',
        })
        .expect(201);
      const id = create.body.id as string;
      await request(app.getHttpServer())
        .delete(`/patients/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Doctors + RBAC', () => {
    it('GET /doctors — 200 receptionist', () => {
      return request(app.getHttpServer())
        .get('/doctors')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(200);
    });

    it('POST /doctors — 403 receptionist', () => {
      return request(app.getHttpServer())
        .post('/doctors')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          name: 'Dr. X',
          specialty: 'Test',
          phone: '+998901112233',
          workingHours: '9-17',
        })
        .expect(403);
    });

    it('POST /doctors — 201 admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/doctors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `E2E Doc ${Date.now()}`,
          specialty: 'Test',
          phone: '+998907776655',
          workingHours: 'Du-Ju 9-17',
        })
        .expect(201);
      const id = res.body.id as string;
      await request(app.getHttpServer())
        .delete(`/doctors/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Bookings', () => {
    it('GET /bookings — 200', () => {
      return request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((r) => expect(Array.isArray(r.body)).toBe(true));
    });

    it('GET /bookings?patientId=p1 — 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings')
        .query({ patientId: 'p1' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /bookings/nonexistent — 404', () => {
      return request(app.getHttpServer())
        .get('/bookings/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Visits', () => {
    it('GET /visits — 200', () => {
      return request(app.getHttpServer())
        .get('/visits')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Services', () => {
    it('GET /services — 200', () => {
      return request(app.getHttpServer())
        .get('/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('POST /services — 400 narx 0', () => {
      return request(app.getHttpServer())
        .post('/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'X',
          category: 'Y',
          price: 0,
          duration: 10,
        })
        .expect(400);
    });
  });

  describe('Payments', () => {
    it('GET /payments — 403 receptionist (faqat admin)', () => {
      return request(app.getHttpServer())
        .get('/payments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(403);
    });

    it('GET /payments — 200 admin', () => {
      return request(app.getHttpServer())
        .get('/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('POST /payments — 400 description qisqa', () => {
      return request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patientId: 'p1',
          amount: 1000,
          method: 'cash',
          status: 'unpaid',
          description: 'ab',
        })
        .expect(400);
    });
  });

  describe('Notifications', () => {
    it('GET /notifications — 200', () => {
      return request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('POST /notifications — 400 type noto‘g‘ri', () => {
      return request(app.getHttpServer())
        .post('/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patientId: 'p1',
          type: 'email',
          message: 'test',
        })
        .expect(400);
    });

    it('POST /notifications/send-reminders — 201 { created }', async () => {
      const res = await request(app.getHttpServer())
        .post('/notifications/send-reminders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(201);
      expect(res.body).toHaveProperty('created');
      expect(typeof res.body.created).toBe('number');
    });
  });
});
