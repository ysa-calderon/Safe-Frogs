import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/authRoutes';
import projectRoutes from '../../routes/projectRoutes';
import sectionRoutes from '../../routes/sectionRoutes';
import pool from '../../config/database';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/sections', sectionRoutes);

describe('Section Controller', () => {
  let authToken: string;
  let userId: number;
  let projectId: number;
  let sectionId: number;

  beforeAll(async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'sectiontestuser',
        email: 'sectiontest@test.com',
        password: 'password123',
      });

    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Knitting Project' });

    projectId = projectRes.body.project.id;
  });

  afterAll(async () => {
    await pool.query('delete from users where email = $1', ['sectiontest@test.com']);
    await pool.end();
  });

  describe('POST /api/sections/project/:projectId', () => {
    it('should create a new section', async () => {
      const res = await request(app)
        .post(`/api/sections/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Body',
          pattern_type: 'fixed',
          starting_stitches: 80,
          stitch_change_per_row: 0,
          total_rows: 40,
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Section created successfully');
      expect(res.body.section).toHaveProperty('name', 'Body');
      expect(res.body.section).toHaveProperty('pattern_type', 'fixed');
      expect(res.body.section).toHaveProperty('starting_stitches', 80);
      expect(res.body.section).toHaveProperty('total_rows', 40);
      expect(res.body.section).toHaveProperty('current_row', 0);
      expect(res.body.section).toHaveProperty('project_id', projectId);

      sectionId = res.body.section.id;
    });

    it('should create a section with defaults for optional fields', async () => {
      const res = await request(app)
        .post(`/api/sections/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Sleeve',
          starting_stitches: 50,
          total_rows: 20,
        });

      expect(res.status).toBe(201);
      expect(res.body.section).toHaveProperty('pattern_type', 'fixed');
      expect(res.body.section).toHaveProperty('stitch_change_per_row', 0);
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post(`/api/sections/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Incomplete Section' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name, starting_stitches, and total_rows are required');
    });

    it('should return 404 for a non-existent project', async () => {
      const res = await request(app)
        .post('/api/sections/project/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Body',
          starting_stitches: 80,
          total_rows: 40,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Project not found');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post(`/api/sections/project/${projectId}`)
        .send({
          name: 'Body',
          starting_stitches: 80,
          total_rows: 40,
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/sections/project/:projectId', () => {
    it('should get all sections for a project', async () => {
      const res = await request(app)
        .get(`/api/sections/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.sections).toBeInstanceOf(Array);
      expect(res.body.sections.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 404 for a non-existent project', async () => {
      const res = await request(app)
        .get('/api/sections/project/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Project not found');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .get(`/api/sections/project/${projectId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/sections/:id', () => {
    it('should get a single section by id', async () => {
      const res = await request(app)
        .get(`/api/sections/${sectionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.section).toHaveProperty('id', sectionId);
      expect(res.body.section).toHaveProperty('name', 'Body');
      expect(res.body.section).toHaveProperty('pattern_type', 'fixed');
    });

    it('should return 404 for a non-existent section', async () => {
      const res = await request(app)
        .get('/api/sections/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Section not found');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .get(`/api/sections/${sectionId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/sections/:id', () => {
    it('should update a section', async () => {
      const res = await request(app)
        .put(`/api/sections/${sectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Body',
          pattern_type: 'decrease',
          starting_stitches: 60,
          stitch_change_per_row: -2,
          total_rows: 50,
          current_row: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Section updated successfully');
      expect(res.body.section).toHaveProperty('name', 'Updated Body');
      expect(res.body.section).toHaveProperty('pattern_type', 'decrease');
      expect(res.body.section).toHaveProperty('current_row', 5);
      expect(res.body.section).toHaveProperty('total_rows', 50);
    });

    it('should return 404 for a non-existent section', async () => {
      const res = await request(app)
        .put('/api/sections/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Ghost',
          pattern_type: 'fixed',
          starting_stitches: 10,
          stitch_change_per_row: 0,
          total_rows: 10,
          current_row: 0,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Section not found');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .put(`/api/sections/${sectionId}`)
        .send({ name: 'Unauthorized Update' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/sections/:id/increment', () => {
    it('should increment the row counter', async () => {
      const res = await request(app)
        .post(`/api/sections/${sectionId}/increment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'row' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Row incremented');
      expect(res.body.section).toHaveProperty('current_row', 6);
    });

    it('should return 400 when exceeding total rows', async () => {
      // Set current_row to total_rows via update
      await request(app)
        .put(`/api/sections/${sectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Body',
          pattern_type: 'decrease',
          starting_stitches: 60,
          stitch_change_per_row: -2,
          total_rows: 50,
          current_row: 50,
        });

      const res = await request(app)
        .post(`/api/sections/${sectionId}/increment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'row' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Cannot exceed total rows');
    });

    it('should return 400 for invalid increment type', async () => {
      const res = await request(app)
        .post(`/api/sections/${sectionId}/increment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'stitch' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid increment type');
    });

    it('should return 404 for a non-existent section', async () => {
      const res = await request(app)
        .post('/api/sections/99999/increment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'row' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Section not found');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post(`/api/sections/${sectionId}/increment`)
        .send({ type: 'row' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/sections/:id', () => {
    it('should return 404 for a non-existent section', async () => {
      const res = await request(app)
        .delete('/api/sections/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Section not found');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .delete(`/api/sections/${sectionId}`);

      expect(res.status).toBe(401);
    });

    it('should delete a section', async () => {
      const res = await request(app)
        .delete(`/api/sections/${sectionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Section deleted successfully');

      // Verify it's actually deleted
      const getRes = await request(app)
        .get(`/api/sections/${sectionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});
