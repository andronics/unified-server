/**
 * User repository for database operations
 * Layer 3: Integration
 */

import { database } from '../connection-pool';
import { User, CreateUserInput, UpdateUserInput } from '@shared/types/common-types';
import { ApiError } from '@shared/errors/api-error';
import { logger } from '@infrastructure/logging/logger';

/**
 * Map database row to User object
 */
function mapRowToUser(row: any): User {
  const user: any = {
    id: row.id,
    email: row.email,
    name: row.name,
    password: row.password,
    createdAt: new Date(row.created_at),
  };

  if (row.updated_at) user.updatedAt = new Date(row.updated_at);

  return user as User;
}

/**
 * User repository
 */
export class UserRepository {
  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<User> {
    try {
      const result = await database.query<User>(
        `INSERT INTO users (email, name, password)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, password, created_at, updated_at`,
        [input.email, input.name, input.password]
      );

      if (result.rows.length === 0) {
        throw new Error('User creation returned no rows');
      }

      logger.info({ userId: result.rows[0].id, email: input.email }, 'User created');
      return mapRowToUser(result.rows[0]);
    } catch (error: any) {
      // Check for unique constraint violation (check originalError from connection pool)
      const dbError = error.originalError || error;
      if (dbError.code === '23505' && dbError.constraint === 'users_email_key') {
        throw ApiError.conflict('Email already exists');
      }

      logger.error({ error, input }, 'Failed to create user');
      throw ApiError.databaseError('Failed to create user');
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      const result = await database.query<User>(
        `SELECT id, email, name, password, created_at, updated_at
         FROM users
         WHERE id = $1`,
        [id]
      );

      return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to find user by ID');
      throw ApiError.databaseError('Failed to find user');
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await database.query<User>(
        `SELECT id, email, name, password, created_at, updated_at
         FROM users
         WHERE email = $1`,
        [email]
      );

      return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      logger.error({ error, email }, 'Failed to find user by email');
      throw ApiError.databaseError('Failed to find user');
    }
  }

  /**
   * Update user
   */
  async update(id: string, input: UpdateUserInput): Promise<User> {
    try {
      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (input.email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        values.push(input.email);
      }

      if (input.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(input.name);
      }

      if (input.password !== undefined) {
        updates.push(`password = $${paramIndex++}`);
        values.push(input.password);
      }

      if (updates.length === 0) {
        throw ApiError.invalidInput('No fields to update');
      }

      values.push(id);

      const result = await database.query<User>(
        `UPDATE users
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, email, name, password, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        throw ApiError.notFound('User', id);
      }

      logger.info({ userId: id, updates }, 'User updated');
      return mapRowToUser(result.rows[0]);
    } catch (error: any) {
      // Check for unique constraint violation (check originalError from connection pool)
      const dbError = error.originalError || error;
      if (dbError.code === '23505' && dbError.constraint === 'users_email_key') {
        throw ApiError.conflict('Email already exists');
      }

      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, userId: id, input }, 'Failed to update user');
      throw ApiError.databaseError('Failed to update user');
    }
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await database.query(
        `DELETE FROM users WHERE id = $1`,
        [id]
      );

      if (result.rowCount === 0) {
        throw ApiError.notFound('User', id);
      }

      logger.info({ userId: id }, 'User deleted');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.error({ error, userId: id }, 'Failed to delete user');
      throw ApiError.databaseError('Failed to delete user');
    }
  }

  /**
   * Check if user exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const result = await database.query(
        `SELECT 1 FROM users WHERE id = $1`,
        [id]
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to check user existence');
      throw ApiError.databaseError('Failed to check user existence');
    }
  }

  /**
   * Get user count
   */
  async count(): Promise<number> {
    try {
      const result = await database.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users`
      );

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error({ error }, 'Failed to count users');
      throw ApiError.databaseError('Failed to count users');
    }
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
