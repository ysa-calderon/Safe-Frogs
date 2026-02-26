import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/authRoutes';
import pool from '../../config/database';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Controller', () => {
    // Clean up test data after all tests
    afterAll(async () => {
        await pool.query('delete from users where email like $1', ['test%@test.com']);
        await pool.end();
    });

    describe('post /api/auth/register', () => {
        it('should register a new user', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser123',
                    email: 'test123@test.com',
                    password: 'password123',
                });
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user).toHaveProperty('username', 'testuser123');
            expect(res.body.user).toHaveProperty('email', 'test123@test.com');
        });

        it('should return 400 if email already exists', async () => {
            await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser456',
                    email: 'test456@test.com',
                    password: 'password123',
                });
            
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'differentuser',
                    email: 'test456@test.com',
                    password: 'password123',
                });
            
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Email or username already exists');
        });

        it('should return 400 if password is too short', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser789',
                    email: 'test789.com',
                    password: '123',
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Password must be at least 6 characters');
        });
    });

    describe('post /api/auth/login', () => {
        beforeAll(async () => {
            // Create test user
            await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'logintest',
                    email: 'logintest@test.com',
                    password: 'password123',
                });
        });

        it('should login with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'logintest@test.com',
                    password: 'password123',
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user).toHaveProperty('email', 'logintest@test.com');
        });

        it('should return 401 with invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'logintest@test.com',
                    password: 'wrongpassword',
                });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid credentials');
        });

        it('should return 401 with non-existent email', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@test.com',
                    password: 'password123',
                });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid credentials');
        });
    });
});