/**
 * Integration layer exports
 * Layer 3: Integration
 */

// Database
export * from './database/connection-pool';
export * from './database/repositories/user-repository';
export * from './database/repositories/message-repository';

// Cache
export * from './cache/redis-client';
