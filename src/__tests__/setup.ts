/**
 * Test setup file
 * Runs before all tests
 */

import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';

// Set NODE_ENV to test BEFORE loading env
process.env.NODE_ENV = 'test';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Override LOG_LEVEL to prevent logging noise (use 'error' not 'silent')
process.env.LOG_LEVEL = 'error';

beforeAll(() => {
  // Global test setup
});

afterAll(() => {
  // Global test cleanup
});
