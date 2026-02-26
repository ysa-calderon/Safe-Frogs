import request from 'supertest';
import express from 'express';
import projectRoutes from '../../routes/projectRoutes';
import authRoutes from '../../routes/authRoutes';
import pool from '../../config/database';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

describe('Project Controller', () => {
  let authToken: string;
  let userId: number;
  let projectId: number;

  beforeAll(async () => {
    // Register and login to get a token
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'projecttestuser',
        email: 'projecttest@test.com',
        password: 'password123',
      });

    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', ['projecttest@test.com']);
    await pool.end();
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Sweater',
          description: 'A test project',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toHaveProperty('name', 'Test Sweater');
      expect(res.body.project).toHaveProperty('description', 'A test project');
      expect(res.body.project).toHaveProperty('user_id', userId);
      
      // Save project ID for later tests
      projectId = res.body.project.id;
    });

    it('should create a project without description', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Project Without Description',
        });

      expect(res.status).toBe(201);
      expect(res.body.project).toHaveProperty('name', 'Project Without Description');
      expect(res.body.project.description).toBeNull();
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({
          name: 'Unauthorized Project',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access token required');
    });

    it('should return 400 without project name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'No name provided',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Project name is required');
    });
  });

  describe('GET /api/projects', () => {
    beforeAll(async () => {
      // Create some test projects
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Project 1', description: 'First project' });

      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Project 2', description: 'Second project' });
    });

    it('should get all projects for authenticated user', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.projects).toBeInstanceOf(Array);
      expect(res.body.projects.length).toBeGreaterThanOrEqual(3);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/projects');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access token required');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get a single project by id', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.project).toHaveProperty('id', projectId);
      expect(res.body.project).toHaveProperty('name', 'Test Sweater');
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .get('/api/projects/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Project not found');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update a project', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Sweater',
          description: 'Updated description',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project updated successfully');
      expect(res.body.project).toHaveProperty('name', 'Updated Sweater');
      expect(res.body.project).toHaveProperty('description', 'Updated description');
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .put('/api/projects/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Non-existent',
          description: 'Does not exist',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Project not found');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .send({
          name: 'Unauthorized Update',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .delete('/api/projects/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Project not found');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`);

      expect(res.status).toBe(401);
    });

    it('should delete a project', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');

      // Verify it's actually deleted
      const getRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});