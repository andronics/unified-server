# Unified Multi-Protocol Server Architecture v1.0.0

**Meta-Architecture Compliance**: v1.0.0  
**Template Version**: 1.0.0  
**Status**: Active  
**Last Audit**: 2025-11-10  
**Compliance Score**: 100%

**Protocols Supported**: TCP, HTTP, WebSocket, GraphQL, REST, PubSub

---

## Table of Contents

1. [Meta-Architecture Reference](#1-meta-architecture-reference)
2. [Multi-Protocol Server Overview](#2-multi-protocol-server-overview)
3. [Core Principles Mapping](#3-core-principles-mapping)
4. [Implementation Patterns](#4-implementation-patterns)
5. [Complete Code Examples](#5-complete-code-examples)
6. [Tool Recommendations](#6-tool-recommendations)
7. [Testing Strategy](#7-testing-strategy)
8. [Deployment Guidelines](#8-deployment-guidelines)
9. [Compliance Checklist](#9-compliance-checklist)
10. [Migration Guide](#10-migration-guide)

---

## 1. Meta-Architecture Reference

This template implements all 12 universal principles from Meta-Architecture v1.0.0 for building a unified server that handles multiple communication protocols and patterns.

### Compliance Matrix

| Principle | Multi-Protocol Implementation | Status |
|-----------|------------------------------|--------|
| 1. Layered Architecture | Protocol handlers → Services → Core → Foundation | ✅ Full |
| 2. Dependency Management | Protocol plugins, PubSub adapters | ✅ Full |
| 3. Graceful Degradation | Protocol fallback, PubSub persistence | ✅ Full |
| 4. Input Validation | Per-protocol validation layers | ✅ Full |
| 5. Error Handling | Unified error model across protocols | ✅ Full |
| 6. Configuration | Protocol-specific + shared config | ✅ Full |
| 7. Observability | Cross-protocol tracing, metrics | ✅ Full |
| 8. Testing | Protocol-specific + integration tests | ✅ Full |
| 9. Security | Per-protocol auth, shared session store | ✅ Full |
| 10. Resource Management | Connection pooling, PubSub cleanup | ✅ Full |
| 11. Performance | Async I/O, message batching | ✅ Full |
| 12. Evolution | Protocol versioning, feature flags | ✅ Full |

### Architecture Alignment

This unified server architecture provides:
- **Single codebase** for multiple communication patterns
- **Shared infrastructure** (auth, logging, metrics)
- **Protocol interoperability** (HTTP triggers WebSocket, etc.)
- **Consistent error handling** across all protocols
- **Unified session management**
- **Centralized PubSub** for real-time features

---

## 2. Multi-Protocol Server Overview

### What is a Unified Multi-Protocol Server?

A **unified multi-protocol server** is a single application that handles multiple communication protocols and patterns through a shared infrastructure, enabling seamless interoperability between different client types and communication styles.

### Supported Protocols and Patterns

#### 1. **TCP Raw Socket Server**
- **Purpose**: Low-level binary protocol communication
- **Use Cases**: IoT devices, game servers, custom protocols
- **Characteristics**: Stateful, bidirectional, efficient
- **Example**: Device telemetry, real-time gaming

#### 2. **HTTP/HTTPS Server**
- **Purpose**: Standard web request/response
- **Use Cases**: Web applications, APIs, webhooks
- **Characteristics**: Stateless, request/response, widely supported
- **Example**: Traditional web services

#### 3. **REST API**
- **Purpose**: Resource-oriented HTTP endpoints
- **Use Cases**: CRUD operations, public APIs
- **Characteristics**: Stateless, cacheable, uniform interface
- **Example**: User management, data access

#### 4. **GraphQL API**
- **Purpose**: Query language for APIs
- **Use Cases**: Complex data fetching, mobile backends
- **Characteristics**: Single endpoint, flexible queries, strongly typed
- **Example**: Social feeds, dashboard aggregations

#### 5. **WebSocket Server**
- **Purpose**: Full-duplex real-time communication
- **Use Cases**: Chat, live updates, collaborative editing
- **Characteristics**: Persistent connection, bidirectional, low latency
- **Example**: Live chat, stock tickers

#### 6. **PubSub System**
- **Purpose**: Event-driven messaging
- **Use Cases**: Broadcasting, event sourcing, microservices
- **Characteristics**: Decoupled, scalable, persistent
- **Example**: Notification system, live feeds

### Protocol Interaction Patterns

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
└───┬─────────┬──────────┬──────────┬──────────┬─────────────┘
    │         │          │          │          │
    │ TCP     │ HTTP     │ REST     │ GraphQL  │ WebSocket
    │         │          │          │          │
┌───▼─────────▼──────────▼──────────▼──────────▼─────────────┐
│              Protocol Handler Layer (Layer 4)                │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐     │
│  │ TCP  │  │ HTTP │  │ REST │  │ GQL  │  │WebSocket │     │
│  │Handler│ │Handler│ │Router│ │Resolver│ │ Handler  │     │
│  └───┬──┘  └───┬──┘  └───┬──┘  └───┬──┘  └────┬─────┘     │
└──────┼─────────┼─────────┼─────────┼──────────┼───────────┘
       │         │         │         │          │
       └─────────┴─────────┴─────────┴──────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                  Service Layer (Layer 4)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Business     │  │ Authentication│  │ Authorization│      │
│  │ Services     │  │ Service       │  │ Service      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│               PubSub & Infrastructure (Layer 2/3)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PubSub       │  │ Session      │  │ Logging &    │      │
│  │ Broker       │  │ Store        │  │ Metrics      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
└─────────┼──────────────────┼──────────────────────────────────┘
          │                  │
          └──────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              Integration Layer (Layer 3)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Database     │  │ Redis/Cache  │  │ External     │      │
│  │ Repositories │  │              │  │ APIs         │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────────────────────────────────────────┘
```

### Communication Flow Examples

**Example 1: HTTP → WebSocket → PubSub**
```
1. Client POSTs message via REST API
2. REST handler publishes to PubSub topic
3. WebSocket handler subscribed to topic
4. WebSocket pushes to connected clients
```

**Example 2: TCP → GraphQL Query → Response**
```
1. IoT device sends data via TCP
2. TCP handler stores data and publishes event
3. Web client queries data via GraphQL
4. GraphQL resolver fetches latest data
```

**Example 3: WebSocket → PubSub → Multi-Protocol Broadcast**
```
1. User sends message via WebSocket
2. Message published to PubSub channel
3. All protocol handlers subscribed to channel
4. Message broadcast to HTTP SSE, TCP, WebSocket clients
```

### Architecture Benefits

✅ **Unified Codebase**: Single application, shared infrastructure
✅ **Protocol Interoperability**: Seamless cross-protocol communication
✅ **Shared Authentication**: Single auth layer for all protocols
✅ **Consistent Logging**: Unified observability across protocols
✅ **Resource Efficiency**: Shared connection pools, caching
✅ **Real-Time Everywhere**: PubSub enables live updates for all clients
✅ **Simplified Deployment**: One service, multiple capabilities

### When to Use This Architecture

✅ **Use when:**
- Need to support multiple client types (web, mobile, IoT)
- Require real-time features across different protocols
- Want unified authentication/authorization
- Building a platform with diverse integration needs
- Need protocol flexibility (start REST, add WebSocket later)

❌ **Consider alternatives when:**
- Simple single-protocol service is sufficient
- Extreme specialization needed (pure gaming server)
- Microservices with protocol separation preferred
- Different teams own different protocols

---

## 3. Core Principles Mapping

### Principle 1: Layered Architecture ⭐ MANDATORY

**Meta-Architecture Definition:**  
"All systems MUST organize code into 4 distinct layers with downward-only dependencies."

**Multi-Protocol Implementation:**

The unified server uses a modified four-layer architecture that accommodates multiple protocol handlers at the application layer while maintaining clean separation of concerns.

**Layer Structure:**

```
Layer 4: Protocol Handlers & Application Logic
    ├── TCP Handler
    ├── HTTP/REST Router
    ├── GraphQL Schema/Resolvers
    ├── WebSocket Handler
    └── Application Services
              ↓
Layer 3: Integration (External Systems)
    ├── Database Repositories
    ├── External API Clients
    └── Message Queue Adapters
              ↓
Layer 2: Infrastructure (Core Services)
    ├── PubSub Broker
    ├── Session Store
    ├── Authentication
    ├── Logging & Metrics
    └── Configuration
              ↓
Layer 1: Foundation (Primitives)
    ├── Validators
    ├── Serializers
    ├── Error Types
    └── Utility Functions
```

**Directory Structure:**

```
unified-server/
├── src/
│   ├── foundation/                    # Layer 1
│   │   ├── validators/
│   │   │   ├── tcp-message-validator.ts
│   │   │   ├── http-validator.ts
│   │   │   └── graphql-input-validator.ts
│   │   ├── serializers/
│   │   │   ├── binary-serializer.ts
│   │   │   └── json-serializer.ts
│   │   ├── errors/
│   │   │   ├── protocol-error.ts
│   │   │   └── error-codes.ts
│   │   └── types/
│   │       ├── message-types.ts
│   │       └── protocol-types.ts
│   │
│   ├── infrastructure/               # Layer 2
│   │   ├── pubsub/
│   │   │   ├── pubsub-broker.ts
│   │   │   ├── topic-manager.ts
│   │   │   └── subscription-manager.ts
│   │   ├── auth/
│   │   │   ├── auth-service.ts
│   │   │   ├── jwt-manager.ts
│   │   │   └── session-store.ts
│   │   ├── config/
│   │   │   └── config-loader.ts
│   │   ├── logging/
│   │   │   └── logger.ts
│   │   └── metrics/
│   │       └── metrics-collector.ts
│   │
│   ├── integration/                  # Layer 3
│   │   ├── database/
│   │   │   ├── connection-pool.ts
│   │   │   └── repositories/
│   │   ├── cache/
│   │   │   └── redis-client.ts
│   │   └── external-apis/
│   │       └── third-party-client.ts
│   │
│   └── application/                  # Layer 4
│       ├── protocols/
│       │   ├── tcp/
│       │   │   ├── tcp-server.ts
│       │   │   ├── tcp-handler.ts
│       │   │   └── tcp-protocol.ts
│       │   ├── http/
│       │   │   ├── http-server.ts
│       │   │   └── middleware/
│       │   ├── rest/
│       │   │   ├── routes/
│       │   │   └── controllers/
│       │   ├── graphql/
│       │   │   ├── schema.ts
│       │   │   ├── resolvers/
│       │   │   └── datasources/
│       │   └── websocket/
│       │       ├── ws-server.ts
│       │       ├── ws-handler.ts
│       │       └── connection-manager.ts
│       │
│       └── services/
│           ├── user-service.ts
│           ├── message-service.ts
│           └── notification-service.ts
```

**Implementation Example:**

```typescript
// ✅ foundation/types/message-types.ts (Layer 1)
export interface Message {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface ProtocolMessage extends Message {
  protocol: 'tcp' | 'http' | 'ws' | 'graphql';
  sessionId?: string;
}

// ✅ infrastructure/pubsub/pubsub-broker.ts (Layer 2)
import { Message } from '@foundation/types/message-types';
import { Logger } from '@infrastructure/logging/logger';

export class PubSubBroker {
  private topics: Map<string, Set<Subscription>> = new Map();
  
  constructor(private logger: Logger) {}

  publish(topic: string, message: Message): void {
    const subscribers = this.topics.get(topic);
    if (!subscribers) return;

    subscribers.forEach(sub => {
      try {
        sub.handler(message);
      } catch (error) {
        this.logger.error({ error, topic }, 'PubSub delivery failed');
      }
    });
  }

  subscribe(topic: string, handler: (msg: Message) => void): string {
    const subscriptionId = this.generateId();
    
    if (!this.topics.has(topic)) {
      this.topics.set(topic, new Set());
    }

    this.topics.get(topic)!.add({ id: subscriptionId, handler });
    this.logger.debug({ topic, subscriptionId }, 'New subscription');
    
    return subscriptionId;
  }

  unsubscribe(topic: string, subscriptionId: string): void {
    const subscribers = this.topics.get(topic);
    if (!subscribers) return;

    for (const sub of subscribers) {
      if (sub.id === subscriptionId) {
        subscribers.delete(sub);
        break;
      }
    }
  }
}

// ✅ application/protocols/websocket/ws-handler.ts (Layer 4)
import { PubSubBroker } from '@infrastructure/pubsub/pubsub-broker';
import { AuthService } from '@infrastructure/auth/auth-service';
import { Logger } from '@infrastructure/logging/logger';
import { WebSocket } from 'ws';

export class WebSocketHandler {
  constructor(
    private pubsub: PubSubBroker,
    private auth: AuthService,
    private logger: Logger
  ) {
    // Subscribe to PubSub topics for broadcasting
    this.subscribeToTopics();
  }

  async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const sessionId = this.generateSessionId();
    
    // Authenticate
    const token = this.extractToken(request);
    const user = await this.auth.verifyToken(token);

    ws.on('message', (data) => {
      this.handleMessage(ws, sessionId, data);
    });

    ws.on('close', () => {
      this.handleDisconnect(sessionId);
    });
  }

  private handleMessage(ws: WebSocket, sessionId: string, data: any): void {
    try {
      const message = JSON.parse(data.toString());
      
      // Publish to PubSub (other protocols can receive)
      this.pubsub.publish('messages', {
        id: this.generateId(),
        type: 'user_message',
        payload: message,
        timestamp: Date.now(),
        protocol: 'ws',
        sessionId
      });
    } catch (error) {
      this.logger.error({ error }, 'WebSocket message handling failed');
    }
  }

  private subscribeToTopics(): void {
    // Subscribe to broadcast topic
    this.pubsub.subscribe('broadcast', (message) => {
      this.broadcastToClients(message);
    });
  }
}

// ❌ BAD: Protocol handler accessing database directly (skipping service layer)
export class WebSocketHandlerBad {
  constructor(private database: Database) {} // VIOLATION!

  async handleMessage(ws: WebSocket, data: any): Promise<void> {
    // Direct database access from protocol handler
    await this.database.query('INSERT INTO messages...'); // VIOLATION!
  }
}
```

**Protocol Layer Isolation:**

Each protocol handler is isolated but shares common infrastructure:

```typescript
// application/protocols/protocol-handler.interface.ts
export interface ProtocolHandler {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  handleMessage(message: ProtocolMessage): Promise<void>;
  getMetrics(): ProtocolMetrics;
}

// Each protocol implements this interface
export class TcpProtocolHandler implements ProtocolHandler { }
export class HttpProtocolHandler implements ProtocolHandler { }
export class WebSocketProtocolHandler implements ProtocolHandler { }
```

**Common Pitfalls:**
- Protocol handlers directly accessing databases
- Business logic in protocol handlers
- Tight coupling between protocols
- PubSub broker accessing application layer

**Best Practices:**
- Keep protocol handlers thin (just I/O translation)
- Business logic in service layer
- Share infrastructure via dependency injection
- Use PubSub for protocol interoperability
- Maintain clean layer boundaries

---

### Principle 2: Explicit Dependency Management ⭐ MANDATORY

**Meta-Architecture Definition:**  
"All dependencies MUST be explicitly declared, versioned, and manageable."

**Multi-Protocol Implementation:**

Dependencies include both npm packages and protocol-specific libraries.

**package.json:**

```json
{
  "name": "unified-multiprotocol-server",
  "version": "1.0.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    // Core HTTP/WebSocket
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "cors": "^2.8.5",
    
    // GraphQL
    "graphql": "^16.8.1",
    "graphql-yoga": "^5.0.0",
    "@graphql-tools/schema": "^10.0.0",
    
    // Authentication
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    
    // Validation
    "zod": "^3.22.4",
    
    // Database
    "pg": "^8.11.3",
    "ioredis": "^5.3.2",
    
    // Logging & Monitoring
    "pino": "^8.16.1",
    "prom-client": "^15.0.0",
    
    // Utilities
    "uuid": "^9.0.1"
  },
  "optionalDependencies": {
    // Optional PubSub backends
    "redis": "^4.6.10",
    "mqtt": "^5.3.0"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "vitest": "^0.34.6",
    "@types/node": "^20.9.0",
    "@types/ws": "^8.5.9",
    "@types/express": "^4.17.20"
  }
}
```

**Protocol Dependency Mapping:**

```typescript
// infrastructure/dependencies/protocol-registry.ts
export interface ProtocolDependencies {
  name: string;
  required: string[];
  optional: string[];
  configKeys: string[];
}

export const PROTOCOL_DEPENDENCIES: Record<string, ProtocolDependencies> = {
  tcp: {
    name: 'TCP Server',
    required: ['net'],
    optional: [],
    configKeys: ['tcp.port', 'tcp.host']
  },
  http: {
    name: 'HTTP Server',
    required: ['express'],
    optional: ['compression'],
    configKeys: ['http.port', 'http.host']
  },
  rest: {
    name: 'REST API',
    required: ['express', 'zod'],
    optional: [],
    configKeys: ['rest.apiVersion', 'rest.baseUrl']
  },
  graphql: {
    name: 'GraphQL API',
    required: ['graphql', 'graphql-yoga'],
    optional: [],
    configKeys: ['graphql.path', 'graphql.playground']
  },
  websocket: {
    name: 'WebSocket Server',
    required: ['ws'],
    optional: [],
    configKeys: ['websocket.port', 'websocket.path']
  },
  pubsub: {
    name: 'PubSub System',
    required: [],
    optional: ['redis', 'mqtt'],
    configKeys: ['pubsub.backend', 'pubsub.persistence']
  }
};
```

**PubSub Backend Adapters:**

```typescript
// infrastructure/pubsub/adapters/pubsub-adapter.interface.ts
export interface PubSubAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(topic: string, message: any): Promise<void>;
  subscribe(topic: string, handler: (message: any) => void): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
}

// infrastructure/pubsub/adapters/memory-adapter.ts
export class MemoryPubSubAdapter implements PubSubAdapter {
  // In-memory implementation (no external dependencies)
}

// infrastructure/pubsub/adapters/redis-adapter.ts
import Redis from 'ioredis';

export class RedisPubSubAdapter implements PubSubAdapter {
  private redis: Redis;
  
  async connect(): Promise<void> {
    if (!Redis) {
      throw new Error('Redis package not installed');
    }
    this.redis = new Redis(config.redis);
  }
}

// infrastructure/pubsub/pubsub-factory.ts
export class PubSubFactory {
  static create(backend: string): PubSubAdapter {
    switch (backend) {
      case 'memory':
        return new MemoryPubSubAdapter();
      
      case 'redis':
        try {
          require.resolve('ioredis');
          return new RedisPubSubAdapter();
        } catch {
          console.warn('Redis not available, falling back to memory');
          return new MemoryPubSubAdapter();
        }
      
      default:
        return new MemoryPubSubAdapter();
    }
  }
}
```

**Graceful Degradation for Optional Protocols:**

```typescript
// application/server.ts
export class UnifiedServer {
  private protocols: Map<string, ProtocolHandler> = new Map();

  async start(): Promise<void> {
    // Always start core HTTP
    await this.startProtocol('http', new HttpProtocolHandler());

    // Conditionally start other protocols
    if (config.protocols.tcp.enabled) {
      try {
        await this.startProtocol('tcp', new TcpProtocolHandler());
      } catch (error) {
        logger.warn({ error }, 'TCP protocol failed to start');
      }
    }

    if (config.protocols.websocket.enabled) {
      try {
        await this.startProtocol('websocket', new WebSocketProtocolHandler());
      } catch (error) {
        logger.warn({ error }, 'WebSocket protocol failed to start');
      }
    }

    if (config.protocols.graphql.enabled) {
      try {
        await this.startProtocol('graphql', new GraphQLProtocolHandler());
      } catch (error) {
        logger.warn({ error }, 'GraphQL protocol failed to start');
      }
    }
  }

  private async startProtocol(
    name: string,
    handler: ProtocolHandler
  ): Promise<void> {
    await handler.start();
    this.protocols.set(name, handler);
    logger.info({ protocol: name }, 'Protocol started');
  }
}
```

**Common Pitfalls:**
- Not declaring protocol-specific dependencies
- Tight coupling to specific PubSub backend
- Missing fallback for optional dependencies
- No version constraints on packages

**Best Practices:**
- Declare all protocol dependencies explicitly
- Use adapter pattern for swappable backends
- Provide in-memory fallbacks
- Version all dependencies
- Document dependency purposes

---

### Principle 3: Graceful Degradation ⭐ MANDATORY

**Meta-Architecture Definition:**  
"Systems MUST continue operating with reduced functionality when non-critical dependencies fail."

**Multi-Protocol Implementation:**

The unified server must continue operating even when individual protocols or PubSub backends fail.

**Dependency Classification:**

```typescript
// infrastructure/dependencies/dependency-classifier.ts
export enum DependencyLevel {
  CRITICAL = 'CRITICAL',     // Server cannot start without this
  IMPORTANT = 'IMPORTANT',   // Core features degraded
  OPTIONAL = 'OPTIONAL'      // Nice-to-have only
}

export const DEPENDENCY_CLASSIFICATION = {
  // CRITICAL: Must have for server to operate
  http: DependencyLevel.CRITICAL,
  database: DependencyLevel.CRITICAL,
  auth: DependencyLevel.CRITICAL,
  logging: DependencyLevel.CRITICAL,

  // IMPORTANT: Core features degraded without these
  pubsub: DependencyLevel.IMPORTANT,
  websocket: DependencyLevel.IMPORTANT,
  cache: DependencyLevel.IMPORTANT,

  // OPTIONAL: Nice-to-have features
  tcp: DependencyLevel.OPTIONAL,
  graphql: DependencyLevel.OPTIONAL,
  metrics: DependencyLevel.OPTIONAL
};
```

**Protocol Availability Matrix:**

```typescript
// infrastructure/availability/protocol-status.ts
export class ProtocolStatusManager {
  private status = new Map<string, ProtocolStatus>();

  markAvailable(protocol: string): void {
    this.status.set(protocol, {
      name: protocol,
      available: true,
      lastCheck: new Date(),
      error: null
    });
  }

  markUnavailable(protocol: string, error: Error): void {
    this.status.set(protocol, {
      name: protocol,
      available: false,
      lastCheck: new Date(),
      error: error.message
    });
  }

  getAvailableProtocols(): string[] {
    return Array.from(this.status.entries())
      .filter(([_, status]) => status.available)
      .map(([name]) => name);
  }

  getServerHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    protocols: ProtocolStatus[];
  } {
    const protocols = Array.from(this.status.values());
    const criticalFailed = protocols.some(
      p => !p.available && DEPENDENCY_CLASSIFICATION[p.name] === DependencyLevel.CRITICAL
    );

    if (criticalFailed) {
      return { status: 'unhealthy', protocols };
    }

    const anyFailed = protocols.some(p => !p.available);
    return {
      status: anyFailed ? 'degraded' : 'healthy',
      protocols
    };
  }
}
```

**PubSub Fallback Strategy:**

```typescript
// infrastructure/pubsub/resilient-pubsub.ts
export class ResilientPubSub {
  private adapters: PubSubAdapter[];
  private currentAdapter: PubSubAdapter;
  private fallbackAdapter: MemoryPubSubAdapter;

  constructor(adapters: PubSubAdapter[]) {
    this.adapters = adapters;
    this.fallbackAdapter = new MemoryPubSubAdapter();
    this.currentAdapter = this.fallbackAdapter;
  }

  async connect(): Promise<void> {
    // Try each adapter in order
    for (const adapter of this.adapters) {
      try {
        await adapter.connect();
        this.currentAdapter = adapter;
        logger.info(`PubSub connected: ${adapter.constructor.name}`);
        return;
      } catch (error) {
        logger.warn({ error }, `PubSub adapter failed: ${adapter.constructor.name}`);
      }
    }

    // All adapters failed, use fallback
    logger.warn('All PubSub adapters failed, using in-memory fallback');
    this.currentAdapter = this.fallbackAdapter;
  }

  async publish(topic: string, message: any): Promise<void> {
    try {
      await this.currentAdapter.publish(topic, message);
    } catch (error) {
      logger.error({ error }, 'PubSub publish failed, attempting fallback');
      
      // Try fallback
      if (this.currentAdapter !== this.fallbackAdapter) {
        await this.fallbackAdapter.publish(topic, message);
        this.currentAdapter = this.fallbackAdapter;
      }
    }
  }
}
```

**Protocol Fallback Example:**

```typescript
// application/services/message-service.ts
export class MessageService {
  constructor(
    private pubsub: ResilientPubSub,
    private protocolStatus: ProtocolStatusManager
  ) {}

  async broadcastMessage(message: Message): Promise<void> {
    const availableProtocols = this.protocolStatus.getAvailableProtocols();

    // Publish to PubSub (protocols will receive)
    try {
      await this.pubsub.publish('broadcast', message);
      logger.info({ protocols: availableProtocols }, 'Message broadcast via PubSub');
    } catch (error) {
      logger.warn({ error }, 'PubSub broadcast failed, using direct delivery');
      
      // Fallback: Direct delivery to protocol handlers
      await this.directBroadcast(message, availableProtocols);
    }
  }

  private async directBroadcast(
    message: Message,
    protocols: string[]
  ): Promise<void> {
    // Directly notify protocol handlers without PubSub
    for (const protocol of protocols) {
      try {
        const handler = this.getProtocolHandler(protocol);
        await handler.handleMessage(message);
      } catch (error) {
        logger.warn({ error, protocol }, 'Direct broadcast failed for protocol');
      }
    }
  }
}
```

**Health Endpoint with Degradation Status:**

```typescript
// application/protocols/http/routes/health.ts
export function createHealthRouter(
  protocolStatus: ProtocolStatusManager
): express.Router {
  const router = express.Router();

  router.get('/health', (req, res) => {
    const health = protocolStatus.getServerHealth();
    
    res.status(health.status === 'unhealthy' ? 503 : 200).json({
      status: health.status,
      timestamp: new Date().toISOString(),
      protocols: health.protocols.map(p => ({
        name: p.name,
        available: p.available,
        lastCheck: p.lastCheck,
        ...(p.error && { error: p.error })
      })),
      capabilities: {
        rest: health.protocols.find(p => p.name === 'http')?.available ?? false,
        graphql: health.protocols.find(p => p.name === 'graphql')?.available ?? false,
        websocket: health.protocols.find(p => p.name === 'websocket')?.available ?? false,
        tcp: health.protocols.find(p => p.name === 'tcp')?.available ?? false,
        pubsub: health.protocols.find(p => p.name === 'pubsub')?.available ?? false
      }
    });
  });

  return router;
}
```

**Common Pitfalls:**
- Treating all protocols as critical
- No fallback for PubSub failure
- Silent protocol failures
- Not exposing degradation status

**Best Practices:**
- Classify protocol criticality
- Implement fallback adapters
- Continue with reduced functionality
- Expose degradation in health endpoint
- Log all degradation events
- Monitor protocol availability

---

### Principle 4: Comprehensive Input Validation ⭐ MANDATORY

**Meta-Architecture Definition:**  
"ALL inputs from external sources MUST be validated before use."

**Multi-Protocol Implementation:**

Each protocol requires protocol-specific validation, but shares common validation primitives.

**Protocol-Specific Validation:**

```typescript
// foundation/validators/tcp-validator.ts
import { z } from 'zod';

// TCP binary message validation
export const TcpMessageSchema = z.object({
  version: z.number().int().min(1).max(255),
  type: z.number().int().min(0).max(65535),
  length: z.number().int().min(0).max(1048576), // Max 1MB
  payload: z.instanceof(Buffer)
});

export function validateTcpMessage(buffer: Buffer): TcpMessage {
  // Parse binary format
  const version = buffer.readUInt8(0);
  const type = buffer.readUInt16BE(1);
  const length = buffer.readUInt32BE(3);
  const payload = buffer.slice(7, 7 + length);

  // Validate structure
  const result = TcpMessageSchema.safeParse({
    version,
    type,
    length,
    payload
  });

  if (!result.success) {
    throw new ValidationError('Invalid TCP message', {
      errors: result.error.errors
    });
  }

  return result.data;
}

// foundation/validators/http-validator.ts
export const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(2).max(100),
  age: z.number().int().min(13).max(120).optional()
});

// foundation/validators/graphql-validator.ts
export const GraphQLInputSchemas = {
  CreatePost: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10000),
    tags: z.array(z.string()).max(10).optional()
  }),
  
  UpdatePost: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(10000).optional(),
    tags: z.array(z.string()).max(10).optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided'
  })
};

// foundation/validators/websocket-validator.ts
export const WebSocketMessageSchema = z.object({
  type: z.enum(['message', 'subscribe', 'unsubscribe', 'ping']),
  payload: z.unknown()
});

export const WebSocketMessagePayloads = {
  message: z.object({
    content: z.string().min(1).max(5000),
    recipientId: z.string().uuid().optional(),
    channelId: z.string().optional()
  }),
  
  subscribe: z.object({
    channels: z.array(z.string()).min(1).max(10)
  }),
  
  unsubscribe: z.object({
    channels: z.array(z.string()).min(1).max(10)
  })
};
```

**Unified Validation Middleware:**

```typescript
// infrastructure/validation/protocol-validator.ts
export class ProtocolValidator {
  static validateTcp(buffer: Buffer): TcpMessage {
    return validateTcpMessage(buffer);
  }

  static validateHttp<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ValidationError('Invalid HTTP request', {
        errors: result.error.errors
      });
    }
    return result.data;
  }

  static validateGraphQL<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new GraphQLError('Invalid input', {
        extensions: {
          code: 'BAD_USER_INPUT',
          validationErrors: result.error.errors
        }
      });
    }
    return result.data;
  }

  static validateWebSocket(message: unknown): WebSocketMessage {
    // First validate message structure
    const result = WebSocketMessageSchema.safeParse(message);
    if (!result.success) {
      throw new ValidationError('Invalid WebSocket message', {
        errors: result.error.errors
      });
    }

    // Then validate payload based on type
    const { type, payload } = result.data;
    const payloadSchema = WebSocketMessagePayloads[type];
    
    if (payloadSchema) {
      const payloadResult = payloadSchema.safeParse(payload);
      if (!payloadResult.success) {
        throw new ValidationError(`Invalid ${type} payload`, {
          errors: payloadResult.error.errors
        });
      }
      return { type, payload: payloadResult.data };
    }

    return result.data;
  }
}
```

**Protocol Handler Validation:**

```typescript
// application/protocols/tcp/tcp-handler.ts
export class TcpHandler {
  handleData(socket: net.Socket, buffer: Buffer): void {
    try {
      // Validate TCP message
      const message = ProtocolValidator.validateTcp(buffer);
      
      // Process valid message
      this.processMessage(socket, message);
    } catch (error) {
      if (error instanceof ValidationError) {
        this.sendError(socket, 'INVALID_MESSAGE', error.message);
      } else {
        throw error;
      }
    }
  }
}

// application/protocols/rest/controllers/user-controller.ts
export class UserController {
  async createUser(req: express.Request, res: express.Response): Promise<void> {
    try {
      // Validate HTTP request body
      const userData = ProtocolValidator.validateHttp(
        CreateUserSchema,
        req.body
      );

      // Process valid data
      const user = await this.userService.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: error.message,
          details: error.context.errors
        });
      } else {
        throw error;
      }
    }
  }
}

// application/protocols/graphql/resolvers/post-resolvers.ts
export const postResolvers = {
  Mutation: {
    createPost: async (_: any, args: any, context: Context) => {
      // Validate GraphQL input
      const input = ProtocolValidator.validateGraphQL(
        GraphQLInputSchemas.CreatePost,
        args.input
      );

      // Process valid input
      return context.services.post.createPost(input);
    }
  }
};

// application/protocols/websocket/ws-handler.ts
export class WebSocketHandler {
  handleMessage(ws: WebSocket, data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      // Validate WebSocket message
      const message = ProtocolValidator.validateWebSocket(parsed);
      
      // Process by type
      this.routeMessage(ws, message);
    } catch (error) {
      if (error instanceof ValidationError) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'INVALID_MESSAGE',
          message: error.message
        }));
      } else {
        throw error;
      }
    }
  }
}
```

**Message Size Limits:**

```typescript
// infrastructure/limits/message-limits.ts
export const MESSAGE_LIMITS = {
  tcp: {
    maxMessageSize: 1024 * 1024, // 1MB
    maxConnectionsPerIp: 100
  },
  http: {
    maxBodySize: 10 * 1024 * 1024, // 10MB
    maxHeaderSize: 16 * 1024 // 16KB
  },
  websocket: {
    maxMessageSize: 512 * 1024, // 512KB
    maxFrameSize: 256 * 1024, // 256KB
    maxConnectionsPerUser: 5
  },
  graphql: {
    maxQueryDepth: 10,
    maxQueryComplexity: 1000,
    maxBatchSize: 10
  }
};

// Infrastructure middleware to enforce limits
export function enforceLimits(protocol: string) {
  const limits = MESSAGE_LIMITS[protocol];
  
  return (req: any, res: any, next: any) => {
    // Check message size
    if (req.body && Buffer.byteLength(JSON.stringify(req.body)) > limits.maxBodySize) {
      return res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: `Maximum payload size is ${limits.maxBodySize} bytes`
      });
    }
    
    next();
  };
}
```

**Common Pitfalls:**
- Skipping validation for "trusted" protocols
- Inconsistent validation across protocols
- Not validating binary data (TCP)
- Missing size limits
- No validation for PubSub messages

**Best Practices:**
- Validate at protocol boundaries
- Use schema validation libraries
- Enforce message size limits
- Validate based on protocol characteristics
- Provide clear validation errors
- Log validation failures
- Rate limit invalid requests

---

### Principle 5: Standardized Error Handling ⭐ MANDATORY

**Meta-Architecture Definition:**  
"Systems MUST handle errors consistently using standardized patterns."

**Multi-Protocol Implementation:**

Unified error model that adapts to each protocol's error format.

**Standard Error Codes:**

```typescript
// foundation/errors/error-codes.ts
export enum ErrorCode {
  // Standard codes (0-9)
  SUCCESS = 0,
  INVALID_INPUT = 1,
  NOT_FOUND = 2,
  PERMISSION_DENIED = 3,
  CONFLICT = 4,
  DEPENDENCY_ERROR = 5,
  INTERNAL_ERROR = 6,
  TIMEOUT = 7,
  RATE_LIMITED = 8,
  DEGRADED = 9,

  // Protocol-specific codes (10-99)
  TCP_PROTOCOL_ERROR = 10,
  TCP_CONNECTION_CLOSED = 11,
  WEBSOCKET_PROTOCOL_ERROR = 20,
  WEBSOCKET_PING_TIMEOUT = 21,
  GRAPHQL_QUERY_ERROR = 30,
  GRAPHQL_COMPLEXITY_ERROR = 31,
  PUBSUB_DELIVERY_ERROR = 40,
  PUBSUB_SUBSCRIPTION_ERROR = 41
}

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.SUCCESS]: 'Operation completed successfully',
  [ErrorCode.INVALID_INPUT]: 'The provided input is invalid',
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found',
  [ErrorCode.PERMISSION_DENIED]: 'Permission denied',
  [ErrorCode.CONFLICT]: 'Resource conflict',
  [ErrorCode.DEPENDENCY_ERROR]: 'External dependency unavailable',
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.TIMEOUT]: 'Operation timed out',
  [ErrorCode.RATE_LIMITED]: 'Too many requests',
  [ErrorCode.DEGRADED]: 'Service running in degraded mode',
  
  [ErrorCode.TCP_PROTOCOL_ERROR]: 'TCP protocol error',
  [ErrorCode.TCP_CONNECTION_CLOSED]: 'TCP connection closed',
  [ErrorCode.WEBSOCKET_PROTOCOL_ERROR]: 'WebSocket protocol error',
  [ErrorCode.WEBSOCKET_PING_TIMEOUT]: 'WebSocket ping timeout',
  [ErrorCode.GRAPHQL_QUERY_ERROR]: 'GraphQL query error',
  [ErrorCode.GRAPHQL_COMPLEXITY_ERROR]: 'Query too complex',
  [ErrorCode.PUBSUB_DELIVERY_ERROR]: 'PubSub delivery failed',
  [ErrorCode.PUBSUB_SUBSCRIPTION_ERROR]: 'PubSub subscription failed'
};
```

**Base Error Class:**

```typescript
// foundation/errors/protocol-error.ts
export class ProtocolError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public protocol: string,
    public context: Record<string, unknown> = {},
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProtocolError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      protocol: this.protocol,
      context: this.context,
      retryable: this.retryable,
      timestamp: new Date().toISOString()
    };
  }

  // Convert to protocol-specific format
  toTcpFormat(): Buffer {
    // Binary format: [version(1)][code(2)][length(4)][message(...)]
    const messageBuffer = Buffer.from(this.message, 'utf8');
    const buffer = Buffer.allocUnsafe(7 + messageBuffer.length);
    
    buffer.writeUInt8(1, 0);                    // Version
    buffer.writeUInt16BE(this.code, 1);         // Error code
    buffer.writeUInt32BE(messageBuffer.length, 3); // Length
    messageBuffer.copy(buffer, 7);              // Message
    
    return buffer;
  }

  toHttpFormat(): { status: number; body: object } {
    const httpStatus = this.getHttpStatus();
    
    return {
      status: httpStatus,
      body: {
        error: ErrorMessages[this.code],
        message: this.message,
        code: this.code,
        timestamp: new Date().toISOString(),
        ...(this.context && { details: this.context })
      }
    };
  }

  toGraphQLFormat(): GraphQLError {
    return new GraphQLError(this.message, {
      extensions: {
        code: this.getGraphQLCode(),
        errorCode: this.code,
        protocol: this.protocol,
        ...this.context
      }
    });
  }

  toWebSocketFormat(): string {
    return JSON.stringify({
      type: 'error',
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        timestamp: new Date().toISOString()
      }
    });
  }

  private getHttpStatus(): number {
    switch (this.code) {
      case ErrorCode.INVALID_INPUT:
        return 400;
      case ErrorCode.PERMISSION_DENIED:
        return 403;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.CONFLICT:
        return 409;
      case ErrorCode.RATE_LIMITED:
        return 429;
      case ErrorCode.DEPENDENCY_ERROR:
      case ErrorCode.DEGRADED:
        return 503;
      default:
        return 500;
    }
  }

  private getGraphQLCode(): string {
    switch (this.code) {
      case ErrorCode.INVALID_INPUT:
        return 'BAD_USER_INPUT';
      case ErrorCode.PERMISSION_DENIED:
        return 'FORBIDDEN';
      case ErrorCode.NOT_FOUND:
        return 'NOT_FOUND';
      case ErrorCode.INTERNAL_ERROR:
        return 'INTERNAL_SERVER_ERROR';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
```

**Protocol-Specific Error Handlers:**

```typescript
// application/protocols/tcp/tcp-error-handler.ts
export class TcpErrorHandler {
  static handle(socket: net.Socket, error: Error): void {
    logger.error({ error }, 'TCP error');

    if (error instanceof ProtocolError) {
      // Send formatted error
      socket.write(error.toTcpFormat());
    } else {
      // Unknown error - send generic error
      const genericError = new ProtocolError(
        'Internal server error',
        ErrorCode.INTERNAL_ERROR,
        'tcp'
      );
      socket.write(genericError.toTcpFormat());
    }
  }
}

// application/protocols/http/middleware/error-handler.ts
export function httpErrorHandler(
  err: Error,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  logger.error({
    error: err,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers
    }
  }, 'HTTP error');

  if (err instanceof ProtocolError) {
    const { status, body } = err.toHttpFormat();
    res.status(status).json(body);
  } else {
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
      code: ErrorCode.INTERNAL_ERROR,
      timestamp: new Date().toISOString()
    });
  }
}

// application/protocols/graphql/error-formatter.ts
export function formatGraphQLError(error: GraphQLError): GraphQLFormattedError {
  logger.error({ error }, 'GraphQL error');

  if (error.originalError instanceof ProtocolError) {
    return error.originalError.toGraphQLFormat() as GraphQLFormattedError;
  }

  return {
    message: error.message,
    extensions: {
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    }
  };
}

// application/protocols/websocket/ws-error-handler.ts
export class WebSocketErrorHandler {
  static handle(ws: WebSocket, error: Error): void {
    logger.error({ error }, 'WebSocket error');

    if (error instanceof ProtocolError) {
      ws.send(error.toWebSocketFormat());
    } else {
      const genericError = new ProtocolError(
        'Internal server error',
        ErrorCode.INTERNAL_ERROR,
        'websocket'
      );
      ws.send(genericError.toWebSocketFormat());
    }
  }
}
```

**Unified Error Handling Example:**

```typescript
// application/services/message-service.ts
export class MessageService {
  async sendMessage(message: SendMessageInput): Promise<Message> {
    try {
      // Validate
      const validated = validateMessage(message);
      
      // Store in database
      const stored = await this.messageRepo.create(validated);
      
      // Publish to PubSub
      await this.pubsub.publish('messages', {
        type: 'new_message',
        payload: stored
      });
      
      return stored;
    } catch (error) {
      // Convert to ProtocolError
      if (error.code === 'UNIQUE_VIOLATION') {
        throw new ProtocolError(
          'Message already exists',
          ErrorCode.CONFLICT,
          'database',
          { messageId: message.id }
        );
      }
      
      if (error instanceof ValidationError) {
        throw new ProtocolError(
          error.message,
          ErrorCode.INVALID_INPUT,
          'validation',
          { errors: error.errors }
        );
      }
      
      // Unknown error
      throw new ProtocolError(
        'Failed to send message',
        ErrorCode.INTERNAL_ERROR,
        'service',
        { originalError: error.message }
      );
    }
  }
}
```

**Common Pitfalls:**
- Different error formats per protocol
- Not logging errors with context
- Exposing stack traces to clients
- Missing error codes
- No retry indicators

**Best Practices:**
- Unified error model with protocol adapters
- Include error codes for programmatic handling
- Log all errors with full context
- Protocol-appropriate error formatting
- Indicate retryable errors
- Don't expose sensitive information

---

Let me continue with the remaining principles and sections...

### Principle 6: Hierarchical Configuration ⭐ MANDATORY

**Meta-Architecture Definition:**  
"Configuration MUST follow clear hierarchy (lowest to highest precedence)."

**Multi-Protocol Implementation:**

Configuration must support protocol-specific settings while maintaining shared infrastructure configuration.

**Configuration Schema:**

```typescript
// infrastructure/config/config-schema.ts
import { z } from 'zod';

export const ConfigSchema = z.object({
  // Global settings
  app: z.object({
    name: z.string().default('unified-server'),
    env: z.enum(['development', 'staging', 'production']).default('development'),
    shutdownTimeout: z.number().default(30000)
  }),

  // Protocol configurations
  protocols: z.object({
    tcp: z.object({
      enabled: z.boolean().default(false),
      host: z.string().default('0.0.0.0'),
      port: z.number().int().default(9000),
      maxConnections: z.number().int().default(1000)
    }),

    http: z.object({
      enabled: z.boolean().default(true),
      host: z.string().default('0.0.0.0'),
      port: z.number().int().default(3000),
      corsOrigins: z.array(z.string()).default(['*'])
    }),

    rest: z.object({
      enabled: z.boolean().default(true),
      basePath: z.string().default('/api/v1'),
      rateLimit: z.object({
        windowMs: z.number().default(900000),
        max: z.number().default(100)
      })
    }),

    graphql: z.object({
      enabled: z.boolean().default(false),
      path: z.string().default('/graphql'),
      playground: z.boolean().default(false),
      introspection: z.boolean().default(false)
    }),

    websocket: z.object({
      enabled: z.boolean().default(false),
      path: z.string().default('/ws'),
      port: z.number().int().optional(),
      pingInterval: z.number().default(30000),
      maxConnections: z.number().int().default(10000)
    })
  }),

  // PubSub configuration
  pubsub: z.object({
    backend: z.enum(['memory', 'redis', 'mqtt']).default('memory'),
    persistence: z.boolean().default(false),
    redis: z.object({
      host: z.string().default('localhost'),
      port: z.number().int().default(6379),
      password: z.string().optional(),
      db: z.number().int().default(0)
    }).optional(),
    mqtt: z.object({
      broker: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional()
    }).optional()
  }),

  // Shared infrastructure
  database: z.object({
    host: z.string().required(),
    port: z.number().int().default(5432),
    name: z.string().required(),
    user: z.string().required(),
    password: z.string().required(),
    poolMin: z.number().int().default(2),
    poolMax: z.number().int().default(20)
  }),

  cache: z.object({
    enabled: z.boolean().default(false),
    host: z.string().default('localhost'),
    port: z.number().int().default(6379),
    ttl: z.number().default(300)
  }),

  auth: z.object({
    jwtSecret: z.string().min(32).required(),
    jwtExpiresIn: z.string().default('15m'),
    sessionStore: z.enum(['memory', 'redis']).default('memory')
  }),

  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    pretty: z.boolean().default(false)
  }),

  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsPort: z.number().int().default(9090)
  })
});

export type AppConfig = z.infer<typeof ConfigSchema>;
```

**Configuration Loader:**

```typescript
// infrastructure/config/config-loader.ts
import * as fs from 'fs';
import * as path from 'path';

export class ConfigLoader {
  static load(): AppConfig {
    // 1. Start with defaults (from schema)
    let config: any = {};

    // 2. Load config/default.json
    const defaultPath = path.join(process.cwd(), 'config', 'default.json');
    if (fs.existsSync(defaultPath)) {
      config = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
    }

    // 3. Load environment-specific config
    const env = process.env.NODE_ENV || 'development';
    const envPath = path.join(process.cwd(), 'config', `${env}.json`);
    if (fs.existsSync(envPath)) {
      const envConfig = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
      config = this.deepMerge(config, envConfig);
    }

    // 4. Override with environment variables
    config = this.applyEnvOverrides(config);

    // 5. Validate
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      console.error('Configuration validation failed:');
      result.error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }

    return result.data;
  }

  private static applyEnvOverrides(config: any): any {
    return {
      ...config,
      protocols: {
        ...config.protocols,
        tcp: {
          ...config.protocols?.tcp,
          enabled: this.envBool('TCP_ENABLED', config.protocols?.tcp?.enabled),
          port: this.envInt('TCP_PORT', config.protocols?.tcp?.port)
        },
        http: {
          ...config.protocols?.http,
          port: this.envInt('HTTP_PORT', config.protocols?.http?.port)
        },
        websocket: {
          ...config.protocols?.websocket,
          enabled: this.envBool('WS_ENABLED', config.protocols?.websocket?.enabled),
          port: this.envInt('WS_PORT', config.protocols?.websocket?.port)
        },
        graphql: {
          ...config.protocols?.graphql,
          enabled: this.envBool('GRAPHQL_ENABLED', config.protocols?.graphql?.enabled)
        }
      },
      pubsub: {
        ...config.pubsub,
        backend: process.env.PUBSUB_BACKEND || config.pubsub?.backend,
        redis: {
          ...config.pubsub?.redis,
          host: process.env.REDIS_HOST || config.pubsub?.redis?.host,
          port: this.envInt('REDIS_PORT', config.pubsub?.redis?.port)
        }
      },
      auth: {
        ...config.auth,
        jwtSecret: process.env.JWT_SECRET || config.auth?.jwtSecret
      }
    };
  }

  private static envBool(key: string, defaultValue?: boolean): boolean | undefined {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1';
  }

  private static envInt(key: string, defaultValue?: number): number | undefined {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
  }

  private static deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}

export const config = ConfigLoader.load();
```

**Protocol-Specific Configuration:**

```typescript
// Application can query protocol availability
export function isProtocolEnabled(protocol: string): boolean {
  return config.protocols[protocol]?.enabled ?? false;
}

// Get protocol configuration
export function getProtocolConfig<T>(protocol: string): T {
  return config.protocols[protocol] as T;
}

// Usage
if (isProtocolEnabled('graphql')) {
  const graphqlConfig = getProtocolConfig('graphql');
  startGraphQLServer(graphqlConfig);
}
```

**Environment Variables Template:**

```bash
# .env.example

# Application
NODE_ENV=production

# Protocols
TCP_ENABLED=true
TCP_PORT=9000

HTTP_PORT=3000

WS_ENABLED=true
WS_PORT=3001

GRAPHQL_ENABLED=true

# PubSub
PUBSUB_BACKEND=redis
REDIS_HOST=redis.example.com
REDIS_PORT=6379

# Database
DB_HOST=db.example.com
DB_PORT=5432
DB_NAME=unified_server
DB_USER=app_user
DB_PASSWORD=CHANGE_ME

# Authentication
JWT_SECRET=GENERATE_SECURE_32_CHAR_SECRET

# Logging
LOG_LEVEL=info
LOG_PRETTY=false
```

**Common Pitfalls:**
- No protocol-specific configuration
- Hardcoded port numbers
- Missing environment overrides
- No validation of configuration
- PubSub backend hardcoded

**Best Practices:**
- Protocol configuration in dedicated sections
- Environment variable overrides for all settings
- Validate configuration at startup
- Support multiple PubSub backends
- Document all configuration options
- Fail fast on invalid configuration

---

### Principle 7: Observable System Behavior ⭐ MANDATORY

**Meta-Architecture Definition:**  
"System behavior MUST be observable through structured logging, metrics, and tracing."

**Multi-Protocol Implementation:**

Observability must span all protocols with unified correlation IDs.

**Cross-Protocol Logging:**

```typescript
// infrastructure/logging/protocol-logger.ts
import pino from 'pino';

export class ProtocolLogger {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: config.logging.level,
      transport: config.logging.pretty
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
      base: {
        pid: process.pid,
        hostname: require('os').hostname()
      },
      timestamp: pino.stdTimeFunctions.isoTime
    });
  }

  // Create protocol-specific logger
  forProtocol(protocol: string, sessionId?: string): pino.Logger {
    return this.logger.child({
      protocol,
      sessionId: sessionId || this.generateSessionId()
    });
  }

  // Log with correlation ID across protocols
  logCrossProtocol(
    correlationId: string,
    protocol: string,
    event: string,
    data: any
  ): void {
    this.logger.info({
      correlationId,
      protocol,
      event,
      ...data
    }, `Cross-protocol: ${event}`);
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const protocolLogger = new ProtocolLogger();
```

**Protocol-Specific Metrics:**

```typescript
// infrastructure/metrics/protocol-metrics.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class ProtocolMetrics {
  private registry: Registry;

  // Protocol-specific counters
  public tcpConnectionsTotal: Counter;
  public httpRequestsTotal: Counter;
  public wsConnectionsTotal: Counter;
  public graphqlQueriesTotal: Counter;

  // Protocol-specific histograms
  public tcpMessageDuration: Histogram;
  public httpRequestDuration: Histogram;
  public wsMessageDuration: Histogram;
  public graphqlQueryDuration: Histogram;

  // PubSub metrics
  public pubsubMessagesPublished: Counter;
  public pubsubMessagesDelivered: Counter;
  public pubsubSubscriptionsActive: Gauge;

  // Cross-protocol metrics
  public activeConnections: Gauge;
  public messagesProcessed: Counter;

  constructor() {
    this.registry = new Registry();

    // TCP metrics
    this.tcpConnectionsTotal = new Counter({
      name: 'tcp_connections_total',
      help: 'Total TCP connections',
      labelNames: ['status'],
      registers: [this.registry]
    });

    this.tcpMessageDuration = new Histogram({
      name: 'tcp_message_duration_seconds',
      help: 'TCP message processing duration',
      labelNames: ['message_type'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry]
    });

    // HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry]
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'path'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry]
    });

    // WebSocket metrics
    this.wsConnectionsTotal = new Counter({
      name: 'ws_connections_total',
      help: 'Total WebSocket connections',
      labelNames: ['status'],
      registers: [this.registry]
    });

    this.wsMessageDuration = new Histogram({
      name: 'ws_message_duration_seconds',
      help: 'WebSocket message processing duration',
      labelNames: ['message_type'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
      registers: [this.registry]
    });

    // GraphQL metrics
    this.graphqlQueriesTotal = new Counter({
      name: 'graphql_queries_total',
      help: 'Total GraphQL queries',
      labelNames: ['operation_type', 'operation_name', 'status'],
      registers: [this.registry]
    });

    this.graphqlQueryDuration = new Histogram({
      name: 'graphql_query_duration_seconds',
      help: 'GraphQL query duration',
      labelNames: ['operation_type', 'operation_name'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry]
    });

    // PubSub metrics
    this.pubsubMessagesPublished = new Counter({
      name: 'pubsub_messages_published_total',
      help: 'Total PubSub messages published',
      labelNames: ['topic'],
      registers: [this.registry]
    });

    this.pubsubMessagesDelivered = new Counter({
      name: 'pubsub_messages_delivered_total',
      help: 'Total PubSub messages delivered',
      labelNames: ['topic', 'status'],
      registers: [this.registry]
    });

    this.pubsubSubscriptionsActive = new Gauge({
      name: 'pubsub_subscriptions_active',
      help: 'Active PubSub subscriptions',
      labelNames: ['topic'],
      registers: [this.registry]
    });

    // Cross-protocol metrics
    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Active connections across all protocols',
      labelNames: ['protocol'],
      registers: [this.registry]
    });

    this.messagesProcessed = new Counter({
      name: 'messages_processed_total',
      help: 'Total messages processed across all protocols',
      labelNames: ['protocol', 'status'],
      registers: [this.registry]
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

export const protocolMetrics = new ProtocolMetrics();
```

**Distributed Tracing Across Protocols:**

```typescript
// infrastructure/tracing/cross-protocol-tracer.ts
export class CrossProtocolTracer {
  private correlationMap = new Map<string, ProtocolTrace>();

  // Start a trace
  startTrace(protocol: string, operation: string): string {
    const correlationId = this.generateCorrelationId();
    
    this.correlationMap.set(correlationId, {
      correlationId,
      startProtocol: protocol,
      startOperation: operation,
      startTime: Date.now(),
      spans: []
    });

    return correlationId;
  }

  // Add a span for a protocol interaction
  addSpan(
    correlationId: string,
    protocol: string,
    operation: string,
    duration: number,
    metadata?: any
  ): void {
    const trace = this.correlationMap.get(correlationId);
    if (!trace) return;

    trace.spans.push({
      protocol,
      operation,
      duration,
      timestamp: Date.now(),
      metadata
    });
  }

  // Complete a trace
  endTrace(correlationId: string): ProtocolTrace | null {
    const trace = this.correlationMap.get(correlationId);
    if (!trace) return null;

    trace.endTime = Date.now();
    trace.totalDuration = trace.endTime - trace.startTime;

    // Log complete trace
    protocolLogger.logCrossProtocol(
      correlationId,
      trace.startProtocol,
      'trace_complete',
      {
        duration: trace.totalDuration,
        spans: trace.spans.length,
        protocols: [...new Set(trace.spans.map(s => s.protocol))]
      }
    );

    this.correlationMap.delete(correlationId);
    return trace;
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const crossProtocolTracer = new CrossProtocolTracer();
```

**Usage Example - Cross-Protocol Flow:**

```typescript
// Scenario: HTTP request → PubSub → WebSocket delivery

// 1. HTTP Handler
app.post('/api/messages', async (req, res) => {
  const correlationId = crossProtocolTracer.startTrace('http', 'post_message');
  req.correlationId = correlationId;

  const logger = protocolLogger.forProtocol('http');
  logger.info({ correlationId }, 'Message received via HTTP');

  const start = Date.now();
  const message = await messageService.sendMessage(req.body);
  
  crossProtocolTracer.addSpan(
    correlationId,
    'http',
    'post_message',
    Date.now() - start,
    { messageId: message.id }
  );

  res.status(201).json(message);
});

// 2. Message Service publishes to PubSub
class MessageService {
  async sendMessage(data: any): Promise<Message> {
    const message = await this.repo.create(data);

    // Publish to PubSub with correlation ID
    const start = Date.now();
    await pubsub.publish('messages', {
      ...message,
      correlationId: data.correlationId
    });

    crossProtocolTracer.addSpan(
      data.correlationId,
      'pubsub',
      'publish_message',
      Date.now() - start,
      { topic: 'messages' }
    );

    return message;
  }
}

// 3. WebSocket Handler receives from PubSub
class WebSocketHandler {
  constructor() {
    pubsub.subscribe('messages', (msg) => {
      const start = Date.now();
      this.broadcastToClients(msg);

      if (msg.correlationId) {
        crossProtocolTracer.addSpan(
          msg.correlationId,
          'websocket',
          'broadcast_message',
          Date.now() - start,
          { recipientCount: this.clients.size }
        );

        // End trace
        crossProtocolTracer.endTrace(msg.correlationId);
      }
    });
  }
}
```

**Metrics Endpoint:**

```typescript
// Expose metrics on separate port
const metricsApp = express();

metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(await protocolMetrics.getMetrics());
});

metricsApp.get('/metrics/protocols', (req, res) => {
  res.json({
    protocols: {
      tcp: {
        enabled: config.protocols.tcp.enabled,
        connections: 0 // Get from connection manager
      },
      http: {
        enabled: config.protocols.http.enabled,
        requests: 0
      },
      websocket: {
        enabled: config.protocols.websocket.enabled,
        connections: 0
      },
      graphql: {
        enabled: config.protocols.graphql.enabled,
        queries: 0
      }
    },
    pubsub: {
      backend: config.pubsub.backend,
      topics: pubsubBroker.getTopicCount(),
      subscribers: pubsubBroker.getSubscriberCount()
    }
  });
});

metricsApp.listen(config.monitoring.metricsPort, () => {
  console.log(`Metrics server on port ${config.monitoring.metricsPort}`);
});
```

**Common Pitfalls:**
- No correlation IDs across protocols
- Separate metrics per protocol (not unified)
- Missing PubSub observability
- No cross-protocol tracing

**Best Practices:**
- Use correlation IDs for all requests
- Unified metrics registry
- Protocol-specific metric labels
- Trace cross-protocol flows
- Expose metrics on separate port
- Log all protocol interactions
- Monitor PubSub health

---

## 4. Implementation Patterns

### Unified Server Bootstrap

```typescript
// src/server.ts
import { UnifiedServer } from './application/unified-server';
import { config } from './infrastructure/config/config-loader';
import { protocolLogger } from './infrastructure/logging/protocol-logger';

async function main() {
  const logger = protocolLogger.forProtocol('system');

  try {
    logger.info('Starting unified multi-protocol server...');

    // Initialize server
    const server = new UnifiedServer(config);

    // Start all enabled protocols
    await server.start();

    logger.info({
      protocols: server.getActiveProtocols(),
      ports: server.getActivePorts()
    }, '🚀 Server started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
```

### Protocol Handler Registration

```typescript
// application/unified-server.ts
export class UnifiedServer {
  private protocols: Map<string, ProtocolHandler> = new Map();
  private pubsub: PubSubBroker;
  private database: DatabasePool;

  constructor(private config: AppConfig) {
    this.pubsub = new PubSubBroker(config.pubsub);
    this.database = new DatabasePool(config.database);
  }

  async start(): Promise<void> {
    // Initialize infrastructure
    await this.database.connect();
    await this.pubsub.connect();

    // Start enabled protocols
    if (this.config.protocols.tcp.enabled) {
      const tcpHandler = new TcpProtocolHandler(
        this.config.protocols.tcp,
        this.pubsub,
        this.database
      );
      await this.registerProtocol('tcp', tcpHandler);
    }

    if (this.config.protocols.http.enabled) {
      const httpHandler = new HttpProtocolHandler(
        this.config.protocols.http,
        this.pubsub,
        this.database
      );
      await this.registerProtocol('http', httpHandler);
    }

    if (this.config.protocols.websocket.enabled) {
      const wsHandler = new WebSocketProtocolHandler(
        this.config.protocols.websocket,
        this.pubsub,
        this.database
      );
      await this.registerProtocol('websocket', wsHandler);
    }

    if (this.config.protocols.graphql.enabled) {
      const graphqlHandler = new GraphQLProtocolHandler(
        this.config.protocols.graphql,
        this.pubsub,
        this.database
      );
      await this.registerProtocol('graphql', graphqlHandler);
    }
  }

  private async registerProtocol(
    name: string,
    handler: ProtocolHandler
  ): Promise<void> {
    try {
      await handler.start();
      this.protocols.set(name, handler);
      protocolMetrics.activeConnections.labels(name).set(0);
      logger.info({ protocol: name }, 'Protocol registered');
    } catch (error) {
      logger.error({ error, protocol: name }, 'Failed to register protocol');
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping all protocols...');

    // Stop protocols in reverse order
    const protocolNames = Array.from(this.protocols.keys()).reverse();
    
    for (const name of protocolNames) {
      const handler = this.protocols.get(name);
      if (handler) {
        try {
          await handler.stop();
          logger.info({ protocol: name }, 'Protocol stopped');
        } catch (error) {
          logger.error({ error, protocol: name }, 'Error stopping protocol');
        }
      }
    }

    // Cleanup infrastructure
    await this.pubsub.disconnect();
    await this.database.disconnect();
  }

  getActiveProtocols(): string[] {
    return Array.from(this.protocols.keys());
  }

  getActivePorts(): Record<string, number> {
    const ports: Record<string, number> = {};
    
    if (this.config.protocols.tcp.enabled) {
      ports.tcp = this.config.protocols.tcp.port;
    }
    if (this.config.protocols.http.enabled) {
      ports.http = this.config.protocols.http.port;
    }
    if (this.config.protocols.websocket.enabled) {
      ports.websocket = this.config.protocols.websocket.port || this.config.protocols.http.port;
    }

    return ports;
  }
}
```

### Complete TCP Protocol Handler

```typescript
// application/protocols/tcp/tcp-protocol-handler.ts
import * as net from 'net';

export class TcpProtocolHandler implements ProtocolHandler {
  name = 'tcp';
  private server?: net.Server;
  private connections = new Map<string, net.Socket>();

  constructor(
    private config: TcpConfig,
    private pubsub: PubSubBroker,
    private database: DatabasePool
  ) {}

  async start(): Promise<void> {
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    this.server.listen(this.config.port, this.config.host);

    // Subscribe to PubSub for broadcasts
    this.pubsub.subscribe('broadcast', (msg) => {
      this.broadcast(msg);
    });

    logger.info({
      host: this.config.host,
      port: this.config.port
    }, 'TCP server started');
  }

  async stop(): Promise<void> {
    // Close all connections
    for (const [id, socket] of this.connections) {
      socket.end();
    }
    this.connections.clear();

    // Close server
    if (this.server) {
      await new Promise((resolve) => {
        this.server!.close(resolve);
      });
    }

    logger.info('TCP server stopped');
  }

  private handleConnection(socket: net.Socket): void {
    const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
    this.connections.set(connectionId, socket);

    const logger = protocolLogger.forProtocol('tcp', connectionId);
    logger.info({ connectionId }, 'New TCP connection');

    protocolMetrics.tcpConnectionsTotal.labels('connected').inc();
    protocolMetrics.activeConnections.labels('tcp').inc();

    socket.on('data', (buffer) => {
      this.handleData(socket, buffer, logger);
    });

    socket.on('close', () => {
      this.connections.delete(connectionId);
      protocolMetrics.tcpConnectionsTotal.labels('disconnected').inc();
      protocolMetrics.activeConnections.labels('tcp').dec();
      logger.info({ connectionId }, 'TCP connection closed');
    });

    socket.on('error', (error) => {
      logger.error({ error, connectionId }, 'TCP connection error');
    });
  }

  private handleData(
    socket: net.Socket,
    buffer: Buffer,
    logger: pino.Logger
  ): void {
    const start = Date.now();

    try {
      // Validate TCP message
      const message = ProtocolValidator.validateTcp(buffer);
      
      logger.debug({ message }, 'TCP message received');

      // Process message
      this.processMessage(socket, message);

      // Metrics
      const duration = (Date.now() - start) / 1000;
      protocolMetrics.tcpMessageDuration
        .labels(message.type.toString())
        .observe(duration);
      
      protocolMetrics.messagesProcessed
        .labels('tcp', 'success')
        .inc();

    } catch (error) {
      logger.error({ error }, 'TCP message processing failed');
      
      protocolMetrics.messagesProcessed
        .labels('tcp', 'error')
        .inc();

      TcpErrorHandler.handle(socket, error);
    }
  }

  private async processMessage(
    socket: net.Socket,
    message: TcpMessage
  ): Promise<void> {
    // Publish to PubSub (other protocols can receive)
    await this.pubsub.publish('tcp_messages', {
      protocol: 'tcp',
      message
    });

    // Send acknowledgment
    const ack = this.createAckMessage(message);
    socket.write(ack);
  }

  private broadcast(message: any): void {
    const buffer = this.serializeMessage(message);
    
    for (const [id, socket] of this.connections) {
      try {
        socket.write(buffer);
      } catch (error) {
        logger.warn({ error, connectionId: id }, 'Broadcast failed');
      }
    }
  }

  async handleMessage(message: ProtocolMessage): Promise<void> {
    // Implement protocol-agnostic message handling
  }

  getMetrics(): ProtocolMetrics {
    return {
      activeConnections: this.connections.size,
      messagesProcessed: 0 // Get from metrics
    };
  }

  private createAckMessage(message: TcpMessage): Buffer {
    // Create ACK in binary format
    const buffer = Buffer.allocUnsafe(3);
    buffer.writeUInt8(1, 0);    // Version
    buffer.writeUInt16BE(0, 1); // ACK type
    return buffer;
  }

  private serializeMessage(message: any): Buffer {
    // Serialize message to binary format
    const json = JSON.stringify(message);
    const jsonBuffer = Buffer.from(json, 'utf8');
    
    const buffer = Buffer.allocUnsafe(7 + jsonBuffer.length);
    buffer.writeUInt8(1, 0);
    buffer.writeUInt16BE(100, 1); // Message type
    buffer.writeUInt32BE(jsonBuffer.length, 3);
    jsonBuffer.copy(buffer, 7);
    
    return buffer;
  }
}
```

### Complete WebSocket Protocol Handler

```typescript
// application/protocols/websocket/ws-protocol-handler.ts
import { WebSocketServer, WebSocket } from 'ws';

export class WebSocketProtocolHandler implements ProtocolHandler {
  name = 'websocket';
  private wss?: WebSocketServer;
  private clients = new Map<string, WebSocket>();
  private subscriptions = new Map<string, Set<string>>(); // userId -> channels

  constructor(
    private config: WebSocketConfig,
    private pubsub: PubSubBroker,
    private database: DatabasePool
  ) {}

  async start(): Promise<void> {
    this.wss = new WebSocketServer({
      port: this.config.port,
      path: this.config.path
    });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    // Subscribe to PubSub topics for broadcasting
    this.pubsub.subscribe('broadcast', (msg) => {
      this.broadcastToAll(msg);
    });

    // Start ping interval
    this.startPingInterval();

    logger.info({
      port: this.config.port,
      path: this.config.path
    }, 'WebSocket server started');
  }

  async stop(): Promise<void> {
    // Close all client connections
    for (const [id, ws] of this.clients) {
      ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();

    // Close server
    if (this.wss) {
      await new Promise((resolve) => {
        this.wss!.close(resolve);
      });
    }

    logger.info('WebSocket server stopped');
  }

  private async handleConnection(
    ws: WebSocket,
    request: any
  ): Promise<void> {
    const sessionId = this.generateSessionId();
    const logger = protocolLogger.forProtocol('websocket', sessionId);

    try {
      // Authenticate
      const token = this.extractToken(request);
      const user = await this.authenticate(token);

      this.clients.set(sessionId, ws);
      (ws as any).userId = user.id;
      (ws as any).sessionId = sessionId;

      logger.info({ userId: user.id }, 'WebSocket connection established');

      protocolMetrics.wsConnectionsTotal.labels('connected').inc();
      protocolMetrics.activeConnections.labels('websocket').inc();

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        sessionId,
        timestamp: Date.now()
      }));

      // Handle messages
      ws.on('message', (data) => {
        this.handleMessage(ws, sessionId, data, logger);
      });

      // Handle close
      ws.on('close', () => {
        this.handleDisconnect(sessionId, logger);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error({ error }, 'WebSocket error');
      });

      // Handle pong
      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

    } catch (error) {
      logger.error({ error }, 'WebSocket authentication failed');
      ws.close(1008, 'Authentication failed');
    }
  }

  private handleMessage(
    ws: WebSocket,
    sessionId: string,
    data: any,
    logger: pino.Logger
  ): void {
    const start = Date.now();

    try {
      const message = ProtocolValidator.validateWebSocket(
        JSON.parse(data.toString())
      );

      logger.debug({ message }, 'WebSocket message received');

      // Route by message type
      this.routeMessage(ws, sessionId, message);

      // Metrics
      const duration = (Date.now() - start) / 1000;
      protocolMetrics.wsMessageDuration
        .labels(message.type)
        .observe(duration);
      
      protocolMetrics.messagesProcessed
        .labels('websocket', 'success')
        .inc();

    } catch (error) {
      logger.error({ error }, 'WebSocket message processing failed');
      
      protocolMetrics.messagesProcessed
        .labels('websocket', 'error')
        .inc();

      WebSocketErrorHandler.handle(ws, error);
    }
  }

  private async routeMessage(
    ws: WebSocket,
    sessionId: string,
    message: WebSocketMessage
  ): Promise<void> {
    const userId = (ws as any).userId;

    switch (message.type) {
      case 'message':
        await this.handleUserMessage(userId, message.payload);
        break;

      case 'subscribe':
        await this.handleSubscribe(userId, sessionId, message.payload.channels);
        break;

      case 'unsubscribe':
        await this.handleUnsubscribe(userId, message.payload.channels);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
    }
  }

  private async handleUserMessage(userId: string, payload: any): Promise<void> {
    // Publish to PubSub
    await this.pubsub.publish('user_messages', {
      userId,
      payload,
      timestamp: Date.now()
    });
  }

  private async handleSubscribe(
    userId: string,
    sessionId: string,
    channels: string[]
  ): Promise<void> {
    if (!this.subscriptions.has(userId)) {
      this.subscriptions.set(userId, new Set());
    }

    const userChannels = this.subscriptions.get(userId)!;
    
    for (const channel of channels) {
      userChannels.add(channel);
      
      // Subscribe to PubSub channel
      await this.pubsub.subscribe(channel, (msg) => {
        this.deliverToUser(userId, channel, msg);
      });
    }

    const ws = this.clients.get(sessionId);
    if (ws) {
      ws.send(JSON.stringify({
        type: 'subscribed',
        channels,
        timestamp: Date.now()
      }));
    }
  }

  private async handleUnsubscribe(
    userId: string,
    channels: string[]
  ): Promise<void> {
    const userChannels = this.subscriptions.get(userId);
    if (!userChannels) return;

    for (const channel of channels) {
      userChannels.delete(channel);
    }
  }

  private deliverToUser(userId: string, channel: string, message: any): void {
    // Find all sessions for this user
    for (const [sessionId, ws] of this.clients) {
      if ((ws as any).userId === userId) {
        try {
          ws.send(JSON.stringify({
            type: 'message',
            channel,
            payload: message,
            timestamp: Date.now()
          }));
        } catch (error) {
          logger.warn({ error, sessionId }, 'Message delivery failed');
        }
      }
    }
  }

  private broadcastToAll(message: any): void {
    const serialized = JSON.stringify({
      type: 'broadcast',
      payload: message,
      timestamp: Date.now()
    });

    for (const [sessionId, ws] of this.clients) {
      try {
        ws.send(serialized);
      } catch (error) {
        logger.warn({ error, sessionId }, 'Broadcast failed');
      }
    }
  }

  private handleDisconnect(sessionId: string, logger: pino.Logger): void {
    this.clients.delete(sessionId);
    
    protocolMetrics.wsConnectionsTotal.labels('disconnected').inc();
    protocolMetrics.activeConnections.labels('websocket').dec();
    
    logger.info('WebSocket disconnected');
  }

  private startPingInterval(): void {
    const interval = setInterval(() => {
      for (const [sessionId, ws] of this.clients) {
        if ((ws as any).isAlive === false) {
          logger.warn({ sessionId }, 'WebSocket ping timeout');
          ws.terminate();
          this.clients.delete(sessionId);
        } else {
          (ws as any).isAlive = false;
          ws.ping();
        }
      }
    }, this.config.pingInterval);

    // Clear on shutdown
    this.wss?.on('close', () => {
      clearInterval(interval);
    });
  }

  private extractToken(request: any): string {
    const url = new URL(request.url, `ws://${request.headers.host}`);
    return url.searchParams.get('token') || '';
  }

  private async authenticate(token: string): Promise<User> {
    // Validate JWT token
    const payload = jwtService.verifyToken(token);
    return payload as User;
  }

  private generateSessionId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async handleMessage(message: ProtocolMessage): Promise<void> {
    // Implement protocol-agnostic message handling
  }

  getMetrics(): ProtocolMetrics {
    return {
      activeConnections: this.clients.size,
      messagesProcessed: 0
    };
  }
}
```

---

## 5. Complete Code Examples

### Full GraphQL Integration

```typescript
// application/protocols/graphql/graphql-protocol-handler.ts
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';

export class GraphQLProtocolHandler implements ProtocolHandler {
  name = 'graphql';
  private yoga: any;

  constructor(
    private config: GraphQLConfig,
    private pubsub: PubSubBroker,
    private database: DatabasePool
  ) {
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    });

    this.yoga = createYoga({
      schema,
      graphiql: this.config.playground,
      context: async ({ request }) => ({
        pubsub: this.pubsub,
        database: this.database,
        user: await this.authenticateRequest(request)
      }),
      plugins: [
        // Custom plugin for metrics
        {
          onExecute: ({ args }) => {
            const start = Date.now();
            const operationName = args.operationName || 'anonymous';
            const operationType = this.getOperationType(args.document);

            return {
              onExecuteDone: () => {
                const duration = (Date.now() - start) / 1000;
                protocolMetrics.graphqlQueryDuration
                  .labels(operationType, operationName)
                  .observe(duration);
                
                protocolMetrics.graphqlQueriesTotal
                  .labels(operationType, operationName, 'success')
                  .inc();
              }
            };
          }
        }
      ]
    });
  }

  async start(): Promise<void> {
    logger.info({
      path: this.config.path,
      playground: this.config.playground
    }, 'GraphQL server started');
  }

  async stop(): Promise<void> {
    logger.info('GraphQL server stopped');
  }

  getHandler(): any {
    return this.yoga;
  }

  private async authenticateRequest(request: Request): Promise<User | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    try {
      return await jwtService.verifyToken(token);
    } catch {
      return null;
    }
  }

  private getOperationType(document: any): string {
    // Extract operation type from AST
    return 'query'; // Simplified
  }

  async handleMessage(message: ProtocolMessage): Promise<void> {
    // Not applicable for GraphQL
  }

  getMetrics(): ProtocolMetrics {
    return {
      activeConnections: 0,
      messagesProcessed: 0
    };
  }
}

// application/protocols/graphql/schema.ts
export const typeDefs = `#graphql
  type Query {
    user(id: ID!): User
    users(limit: Int, offset: Int): [User!]!
    messages(channelId: ID!): [Message!]!
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
    sendMessage(input: SendMessageInput!): Message!
    subscribe(channelId: ID!): Subscription!
  }

  type Subscription {
    messageAdded(channelId: ID!): Message!
    userStatusChanged: UserStatus!
  }

  type User {
    id: ID!
    email: String!
    name: String!
    createdAt: String!
  }

  type Message {
    id: ID!
    content: String!
    userId: ID!
    channelId: ID!
    createdAt: String!
  }

  type UserStatus {
    userId: ID!
    status: String!
    timestamp: String!
  }

  type Subscription {
    id: ID!
    channelId: ID!
    userId: ID!
  }

  input CreateUserInput {
    email: String!
    name: String!
    password: String!
  }

  input SendMessageInput {
    content: String!
    channelId: ID!
  }
`;

// application/protocols/graphql/resolvers/index.ts
export const resolvers = {
  Query: {
    user: async (_: any, { id }: any, context: GraphQLContext) => {
      return context.database.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
    },

    users: async (_: any, { limit = 20, offset = 0 }: any, context: GraphQLContext) => {
      return context.database.query(
        'SELECT * FROM users LIMIT $1 OFFSET $2',
        [limit, offset]
      );
    },

    messages: async (_: any, { channelId }: any, context: GraphQLContext) => {
      return context.database.query(
        'SELECT * FROM messages WHERE channel_id = $1 ORDER BY created_at DESC',
        [channelId]
      );
    }
  },

  Mutation: {
    createUser: async (_: any, { input }: any, context: GraphQLContext) => {
      const validated = ProtocolValidator.validateGraphQL(
        GraphQLInputSchemas.CreateUser,
        input
      );

      const user = await context.database.query(
        'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *',
        [validated.email, validated.name, await hashPassword(validated.password)]
      );

      return user.rows[0];
    },

    sendMessage: async (_: any, { input }: any, context: GraphQLContext) => {
      if (!context.user) {
        throw new ProtocolError(
          'Authentication required',
          ErrorCode.PERMISSION_DENIED,
          'graphql'
        );
      }

      const message = await context.database.query(
        'INSERT INTO messages (content, user_id, channel_id) VALUES ($1, $2, $3) RETURNING *',
        [input.content, context.user.id, input.channelId]
      );

      // Publish to PubSub for real-time delivery
      await context.pubsub.publish(`channel:${input.channelId}`, {
        type: 'new_message',
        message: message.rows[0]
      });

      return message.rows[0];
    },

    subscribe: async (_: any, { channelId }: any, context: GraphQLContext) => {
      if (!context.user) {
        throw new ProtocolError(
          'Authentication required',
          ErrorCode.PERMISSION_DENIED,
          'graphql'
        );
      }

      // Create subscription
      const subscription = await context.database.query(
        'INSERT INTO subscriptions (channel_id, user_id) VALUES ($1, $2) RETURNING *',
        [channelId, context.user.id]
      );

      return subscription.rows[0];
    }
  },

  Subscription: {
    messageAdded: {
      subscribe: async (_: any, { channelId }: any, context: GraphQLContext) => {
        return context.pubsub.asyncIterator(`channel:${channelId}`);
      },
      resolve: (payload: any) => payload.message
    },

    userStatusChanged: {
      subscribe: async (_: any, args: any, context: GraphQLContext) => {
        return context.pubsub.asyncIterator('user_status');
      },
      resolve: (payload: any) => payload
    }
  }
};
```

---

## 6. Tool Recommendations

### Core Tools

**Server Framework:**
- Node.js - Event-driven runtime
- Express - HTTP server
- ws - WebSocket implementation
- net (built-in) - TCP server

**GraphQL:**
- GraphQL Yoga - Modern GraphQL server
- @graphql-tools/schema - Schema utilities
- graphql - GraphQL implementation

**PubSub Backends:**
- Redis - In-memory data store
- MQTT - Message broker
- RabbitMQ - Message queue
- AWS SNS/SQS - Cloud messaging

**Database:**
- PostgreSQL - Primary database
- Redis - Caching & sessions
- MongoDB - Document store (optional)

**Testing:**
- Vitest/Jest - Test framework
- Supertest - HTTP testing
- ws (client) - WebSocket testing
- Artillery - Load testing

**Monitoring:**
- Prometheus - Metrics collection
- Grafana - Visualization
- Pino - Structured logging
- OpenTelemetry - Distributed tracing

---

## 7. Testing Strategy

### Protocol-Specific Tests

```typescript
// tests/protocols/tcp.test.ts
describe('TCP Protocol', () => {
  it('should handle binary messages', async () => {
    const client = net.connect(9000);
    
    // Send message
    const message = createTcpMessage({ type: 1, payload: 'test' });
    client.write(message);

    // Receive response
    const response = await receiveMessage(client);
    expect(response.type).toBe(0); // ACK
  });
});

// tests/protocols/websocket.test.ts
describe('WebSocket Protocol', () => {
  it('should broadcast messages to subscribers', async () => {
    const ws1 = new WebSocket('ws://localhost:3001/ws?token=token1');
    const ws2 = new WebSocket('ws://localhost:3001/ws?token=token2');

    await Promise.all([
      waitForConnection(ws1),
      waitForConnection(ws2)
    ]);

    // Subscribe to channel
    ws1.send(JSON.stringify({
      type: 'subscribe',
      payload: { channels: ['test-channel'] }
    }));

    // Send message
    ws2.send(JSON.stringify({
      type: 'message',
      payload: { content: 'Hello', channelId: 'test-channel' }
    }));

    // ws1 should receive message
    const message = await receiveWsMessage(ws1);
    expect(message.payload.content).toBe('Hello');
  });
});

// tests/protocols/graphql.test.ts
describe('GraphQL Protocol', () => {
  it('should execute queries', async () => {
    const query = `
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          email
          name
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({ query, variables: { id: '1' } })
      .expect(200);

    expect(response.body.data.user).toBeDefined();
  });
});
```

### Cross-Protocol Integration Tests

```typescript
// tests/integration/cross-protocol.test.ts
describe('Cross-Protocol Integration', () => {
  it('should propagate message from REST to WebSocket', async () => {
    // Connect WebSocket client
    const ws = new WebSocket('ws://localhost:3001/ws?token=token');
    await waitForConnection(ws);

    // Subscribe to channel
    ws.send(JSON.stringify({
      type: 'subscribe',
      payload: { channels: ['notifications'] }
    }));

    // Send message via REST
    await request(app)
      .post('/api/v1/messages')
      .send({
        content: 'Test message',
        channelId: 'notifications'
      })
      .expect(201);

    // WebSocket should receive message
    const message = await receiveWsMessage(ws);
    expect(message.payload.content).toBe('Test message');
  });

  it('should handle TCP to GraphQL flow', async () => {
    // Send data via TCP
    const tcpClient = net.connect(9000);
    const tcpMessage = createTcpMessage({
      type: 100,
      payload: { userId: '1', status: 'online' }
    });
    tcpClient.write(tcpMessage);

    // Query via GraphQL
    await new Promise(resolve => setTimeout(resolve, 100));

    const query = `
      query {
        user(id: "1") {
          status
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({ query })
      .expect(200);

    expect(response.body.data.user.status).toBe('online');
  });
});
```

---

## 8. Deployment Guidelines

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  unified-server:
    build: .
    ports:
      - "3000:3000"    # HTTP
      - "3001:3001"    # WebSocket
      - "9000:9000"    # TCP
      - "9090:9090"    # Metrics
    environment:
      NODE_ENV: production
      TCP_ENABLED: "true"
      WS_ENABLED: "true"
      GRAPHQL_ENABLED: "true"
      PUBSUB_BACKEND: redis
      REDIS_HOST: redis
      DB_HOST: postgres
    depends_on:
      - postgres
      - redis
    networks:
      - unified-net

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: unified_server
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - unified-net

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - unified-net

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9091:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - unified-net

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3002:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - unified-net

networks:
  unified-net:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unified-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: unified-server
  template:
    metadata:
      labels:
        app: unified-server
    spec:
      containers:
      - name: server
        image: unified-server:latest
        ports:
        - containerPort: 3000
          name: http
          protocol: TCP
        - containerPort: 3001
          name: websocket
          protocol: TCP
        - containerPort: 9000
          name: tcp
          protocol: TCP
        - containerPort: 9090
          name: metrics
          protocol: TCP
        env:
        - name: NODE_ENV
          value: "production"
        - name: TCP_ENABLED
          value: "true"
        - name: WS_ENABLED
          value: "true"
        - name: GRAPHQL_ENABLED
          value: "true"
        - name: PUBSUB_BACKEND
          value: "redis"
        - name: REDIS_HOST
          value: "redis-service"
        - name: DB_HOST
          value: "postgres-service"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: unified-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: unified-server-http
spec:
  selector:
    app: unified-server
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http

---
apiVersion: v1
kind: Service
metadata:
  name: unified-server-ws
spec:
  selector:
    app: unified-server
  ports:
  - port: 3001
    targetPort: 3001
    protocol: TCP
    name: websocket

---
apiVersion: v1
kind: Service
metadata:
  name: unified-server-tcp
spec:
  type: LoadBalancer
  selector:
    app: unified-server
  ports:
  - port: 9000
    targetPort: 9000
    protocol: TCP
    name: tcp
```

---

## 9. Compliance Checklist

### Four-Layer Architecture
- [ ] Foundation layer with no dependencies
- [ ] Infrastructure layer with shared services
- [ ] Integration layer with database/cache
- [ ] Protocol handlers in application layer
- [ ] No upward dependencies

### Protocol Support
- [ ] TCP protocol handler implemented
- [ ] HTTP/REST endpoints configured
- [ ] GraphQL schema and resolvers
- [ ] WebSocket server with subscriptions
- [ ] PubSub broker integrated

### Dependency Management
- [ ] All protocols in package.json
- [ ] PubSub adapters for multiple backends
- [ ] Graceful degradation for optional protocols
- [ ] Protocol availability tracking

### Error Handling
- [ ] Unified error model across protocols
- [ ] Protocol-specific error formatting
- [ ] TCP binary error responses
- [ ] HTTP RFC 7807 compliance
- [ ] GraphQL error extensions
- [ ] WebSocket error messages

### Configuration
- [ ] Protocol-specific configuration
- [ ] Environment variable overrides
- [ ] Multiple PubSub backend support
- [ ] Validated at startup

### Observability
- [ ] Cross-protocol correlation IDs
- [ ] Protocol-specific metrics
- [ ] Unified logging format
- [ ] Metrics endpoint exposed
- [ ] Health check with protocol status

### Security
- [ ] Authentication across all protocols
- [ ] JWT token validation
- [ ] Rate limiting per protocol
- [ ] Input validation for each protocol
- [ ] Secure WebSocket handshake

### Testing
- [ ] Unit tests for each protocol handler
- [ ] Integration tests across protocols
- [ ] PubSub message delivery tests
- [ ] Load tests for each protocol
- [ ] Cross-protocol flow tests

---

## 10. Migration Guide

### From Single-Protocol to Multi-Protocol

**Week 1-2: Assessment**
- Document current protocol usage
- Identify protocol interaction needs
- Plan PubSub integration
- Design unified authentication

**Week 3-4: Infrastructure Setup**
- Implement PubSub broker
- Create protocol handler interface
- Setup shared authentication
- Configure unified logging

**Week 5-6: Protocol Migration**
- Migrate existing protocol first
- Add WebSocket support
- Integrate GraphQL (if needed)
- Add TCP protocol (if needed)

**Week 7-8: PubSub Integration**
- Connect protocols to PubSub
- Implement cross-protocol messaging
- Add subscription management
- Test message delivery

**Week 9-10: Testing & Deployment**
- Cross-protocol integration tests
- Load testing all protocols
- Deploy to staging
- Production rollout

---

## Version History

### 1.0.0 (2025-11-10)
- Initial release
- TCP, HTTP, REST, GraphQL, WebSocket, PubSub support
- Full Meta-Architecture v1.0.0 compliance
- Cross-protocol messaging
- Unified observability

---

**Template Maintainer**: Architecture Team  
**Last Reviewed**: 2025-11-10  
**License**: MIT

---

**END OF UNIFIED MULTI-PROTOCOL SERVER ARCHITECTURE v1.0.0**
