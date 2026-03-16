import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/authRoutes';
import projectRoutes from '../../routes/projectRoutes';
import sectionRoutes from '../../routes/sectionRoutes';
import lifelineRoutes from '../../routes/lifelineRoutes';
import pool from '../../config/database';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/lifelines', lifelineRoutes);

describe('Lifeline Controller', () => {
    let authToken: string;
    let userId: number;
    let projectId: number;
    let sectionId: number;
    let lifelineId: number;

    beforeAll(async () => {
        // Register and login
        const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
            username: 'lifelinetestuser',
            email: 'lifelinetest@test.com',
            password: 'password123',
        });

        authToken = registerRes.body.token;
        userId = registerRes.body.user.id;

        // Create test project
        const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
            name: 'Test Project for Lifelines',
            description: 'Test project',
        });

        projectId = projectRes.body.project.id;

        // Create test section
        const sectionRes = await request(app)
        .post(`/api/sections/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
            name: 'Test Section',
            pattern_type: 'decreasing',
            starting_stitches: 50,
            stitch_change_per_row: -2,
            total_rows: 25,
        });

        sectionId = sectionRes.body.section.id;

        // Increment section to row 5
        for (let i = 0; i < 5; i++) {
        await request(app)
            .post(`/api/sections/${sectionId}/increment`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ type: 'row' });
        }
    });

    afterAll(async () => {
        await pool.query('DELETE FROM users WHERE email = $1', ['lifelinetest@test.com']);
        await pool.end();
    });

    describe('POST /api/lifelines/section/:sectionId', () => {
        it('should create a lifeline with current section state', async () => {
        const res = await request(app)
            .post(`/api/lifelines/section/${sectionId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
            name: 'After ribbing',
            notes: 'Completed ribbing section',
            });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Lifeline created successfully');
        expect(res.body.lifeline).toHaveProperty('name', 'After ribbing');
        expect(res.body.lifeline).toHaveProperty('notes', 'Completed ribbing section');
        expect(res.body.lifeline).toHaveProperty('saved_row', 5);
        expect(res.body.lifeline).toHaveProperty('saved_stitches', 40); // 50 - (5 * 2)

        lifelineId = res.body.lifeline.id;
        });

        it('should create a lifeline with default name', async () => {
        const res = await request(app)
            .post(`/api/lifelines/section/${sectionId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({});

        expect(res.status).toBe(201);
        expect(res.body.lifeline.name).toContain('Lifeline at Row');
        expect(res.body.lifeline.notes).toBeNull();
        });

        it('should return 404 for non-existent section', async () => {
        const res = await request(app)
            .post('/api/lifelines/section/99999')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
            name: 'Invalid Lifeline',
            });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Section not found');
        });

        it('should return 401 without auth token', async () => {
        const res = await request(app)
            .post(`/api/lifelines/section/${sectionId}`)
            .send({
            name: 'Unauthorized Lifeline',
            });

        expect(res.status).toBe(401);
        });
    });

    describe('GET /api/lifelines/section/:sectionId', () => {
        it('should get all lifelines for a section', async () => {
        const res = await request(app)
            .get(`/api/lifelines/section/${sectionId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.lifelines).toBeInstanceOf(Array);
        expect(res.body.lifelines.length).toBeGreaterThanOrEqual(2);
        });

        it('should return 404 for non-existent section', async () => {
        const res = await request(app)
            .get('/api/lifelines/section/99999')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Section not found');
        });

        it('should return 401 without auth token', async () => {
        const res = await request(app)
            .get(`/api/lifelines/section/${sectionId}`);

        expect(res.status).toBe(401);
        });
    });

    describe('GET /api/lifelines/:id', () => {
        it('should get a single lifeline by id', async () => {
        const res = await request(app)
            .get(`/api/lifelines/${lifelineId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.lifeline).toHaveProperty('id', lifelineId);
        expect(res.body.lifeline).toHaveProperty('name', 'After ribbing');
        });

        it('should return 404 for non-existent lifeline', async () => {
        const res = await request(app)
            .get('/api/lifelines/99999')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Lifeline not found');
        });

        it('should return 401 without auth token', async () => {
        const res = await request(app)
            .get(`/api/lifelines/${lifelineId}`);

        expect(res.status).toBe(401);
        });
    });

    describe('PUT /api/lifelines/:id', () => {
        it('should update a lifeline', async () => {
        const res = await request(app)
            .put(`/api/lifelines/${lifelineId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
            name: 'Updated name',
            notes: 'Updated notes',
            });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Lifeline updated successfully');
        expect(res.body.lifeline).toHaveProperty('name', 'Updated name');
        expect(res.body.lifeline).toHaveProperty('notes', 'Updated notes');
        });

        it('should return 404 for non-existent lifeline', async () => {
        const res = await request(app)
            .put('/api/lifelines/99999')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
            name: 'Non-existent',
            notes: 'Does not exist',
            });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Lifeline not found');
        });

        it('should return 401 without auth token', async () => {
        const res = await request(app)
            .put(`/api/lifelines/${lifelineId}`)
            .send({
            name: 'Unauthorized Update',
            });

        expect(res.status).toBe(401);
        });
    });

    describe('POST /api/lifelines/:id/frog', () => {
        it('should restore section to lifeline state', async () => {
        // First, increment section beyond the lifeline
        await request(app)
            .post(`/api/sections/${sectionId}/increment`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ type: 'row' });

        await request(app)
            .post(`/api/sections/${sectionId}/increment`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ type: 'row' });

        // Section should now be at row 7

        // Frog back to lifeline (row 5)
        const res = await request(app)
            .post(`/api/lifelines/${lifelineId}/frog`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Frogged to lifeline successfully');
        expect(res.body.section.current_row).toBe(5);
        expect(res.body.lifeline).toHaveProperty('saved_row', 5);

        // Verify section was actually updated
        const sectionRes = await request(app)
            .get(`/api/sections/${sectionId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(sectionRes.body.section.current_row).toBe(5);
        });

        it('should return 404 for non-existent lifeline', async () => {
        const res = await request(app)
            .post('/api/lifelines/99999/frog')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Lifeline not found');
        });

        it('should return 401 without auth token', async () => {
        const res = await request(app)
            .post(`/api/lifelines/${lifelineId}/frog`);

        expect(res.status).toBe(401);
        });
    });

    describe('DELETE /api/lifelines/:id', () => {
        it('should return 404 for non-existent lifeline', async () => {
        const res = await request(app)
            .delete('/api/lifelines/99999')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Lifeline not found');
        });

        it('should return 401 without auth token', async () => {
        const res = await request(app)
            .delete(`/api/lifelines/${lifelineId}`);

        expect(res.status).toBe(401);
        });

        it('should delete a lifeline', async () => {
        const res = await request(app)
            .delete(`/api/lifelines/${lifelineId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Lifeline deleted successfully');

        // Verify it's actually deleted
        const getRes = await request(app)
            .get(`/api/lifelines/${lifelineId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(getRes.status).toBe(404);
        });
    });
});