/**
 * Integration tests for authentication endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { httpServer } from '@application/http/http-server';
import { database } from '@integration/database/connection-pool';
import { redisClient } from '@integration/cache/redis-client';

describe('Authentication API', () => {
  let app: Express;

  beforeAll(async () => {
    // Connect to test database
    await database.connect();
    // Redis client connects automatically on creation

    // Get Express app instance
    app = httpServer['app'];
  });

  afterAll(async () => {
    // Cleanup
    await database.disconnect();
    await redisClient.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await database.query('DELETE FROM messages');
    await database.query('DELETE FROM users');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Test123!@#',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.email).toBe(newUser.email);
      expect(response.body.data.name).toBe(newUser.name);
      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const newUser = {
        email: 'invalid-email',
        name: 'Test User',
        password: 'Test123!@#',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should reject registration with weak password', async () => {
      const newUser = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'weak',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject registration with duplicate email', async () => {
      const newUser = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Test123!@#',
      };

      // First registration
      await request(app).post('/api/auth/register').send(newUser).expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('already');
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await request(app).post('/api/auth/register').send({
        email: 'login@example.com',
        name: 'Login User',
        password: 'Test123!@#',
      });
    });

    it('should login with valid credentials', async () => {
      const credentials = {
        email: 'login@example.com',
        password: 'Test123!@#',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(credentials.email);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.expiresIn).toBe('15m');
    });

    it('should reject login with invalid email', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'Test123!@#',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const credentials = {
        email: 'login@example.com',
        password: 'WrongPassword!',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid credentials');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeEach(async () => {
      // Register and login a user
      await request(app).post('/api/auth/register').send({
        email: 'me@example.com',
        name: 'Me User',
        password: 'Test123!@#',
      });

      // Login to get token
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'me@example.com',
        password: 'Test123!@#',
      });

      authToken = loginResponse.body.data.token;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('me@example.com');
      expect(response.body.data.name).toBe('Me User');
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should reject request without authorization header', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authorization header missing');
    });

    it('should reject request with invalid token format', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
