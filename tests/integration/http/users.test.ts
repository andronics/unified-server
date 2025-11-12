/**
 * Integration tests for users endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { httpServer } from '@protocols/http/http-server';
import { database } from '@infrastructure/database/connection-pool';
import { redisClient } from '@infrastructure/cache/redis-client';

describe('Users API', () => {
  let app: Express;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await database.connect();
    // Redis client connects automatically on creation
    app = httpServer['app'];
  });

  afterAll(async () => {
    await database.disconnect();
    await redisClient.disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await database.query('DELETE FROM messages');
    await database.query('DELETE FROM users');

    // Create test user
    const registerResponse = await request(app).post('/api/auth/register').send({
      email: 'testuser@example.com',
      name: 'Test User',
      password: 'Test123!@#',
    });

    userId = registerResponse.body.data.id;

    // Login to get auth token
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'testuser@example.com',
      password: 'Test123!@#',
    });

    authToken = loginResponse.body.data.token;
  });

  describe('GET /api/users/:id', () => {
    it('should get user by ID with authentication', async () => {
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(userId);
      expect(response.body.data.email).toBe('testuser@example.com');
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app).get(`/api/users/${userId}`).expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for nonexistent user', async () => {
      const response = await request(app)
        .get('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/users/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user name', async () => {
      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.email).toBe('testuser@example.com');
    });

    it('should update user email', async () => {
      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'newemail@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('newemail@example.com');
    });

    it('should update user password', async () => {
      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'NewPassword123!@#' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify new password works
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'testuser@example.com',
        password: 'NewPassword123!@#',
      });

      expect(loginResponse.status).toBe(200);
    });

    it('should reject update without authentication', async () => {
      const response = await request(app)
        .put(`/api/users/${userId}`)
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject update with invalid email', async () => {
      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject update with weak password', async () => {
      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'weak' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should update multiple fields at once', async () => {
      const response = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Name',
          email: 'newemail@example.com',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Name');
      expect(response.body.data.email).toBe('newemail@example.com');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user with authentication', async () => {
      await request(app)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify user is deleted
      const getResponse = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404); // User no longer exists
    });

    it('should reject delete without authentication', async () => {
      const response = await request(app).delete(`/api/users/${userId}`).expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 when deleting another user', async () => {
      const response = await request(app)
        .delete('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});
