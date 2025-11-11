# Phase 2: WebSocket Support - Implementation Plan

**Project**: Unified Multi-Protocol Server - Phase 2
**Started**: 2025-11-11
**Target**: Add real-time WebSocket communication
**Status**: 🔄 IN PROGRESS
**Dependencies**: Phase 1 Complete ✅

---

## Executive Summary

Phase 2 adds WebSocket support to enable real-time, bidirectional communication. This includes:
- Upgrading the simple EventBus to a full PubSubBroker with Redis persistence
- Implementing WebSocket server with connection management
- JWT authentication for WebSocket connections
- Topic-based message broadcasting
- Cross-protocol messaging (HTTP → WebSocket)

**Timeline**: 1-2 weeks
**Complexity**: Medium
**Risk**: Low (building on solid Phase 1 foundation)

---

## Architecture Changes

### 1. EventBus → PubSubBroker Upgrade

**Current (Phase 1)**:
```
EventBus (in-memory)
├── Simple pub/sub within single process
├── No persistence
└── No cross-process communication
```

**Phase 2 Target**:
```
PubSubBroker
├── In-memory adapter (default, backward compatible)
├── Redis adapter (for production, multi-instance)
├── Topic-based routing
├── Message persistence (optional)
└── Cross-protocol event routing
```

**Design Principles**:
- Backward compatible with existing EventBus usage
- Pluggable adapters (in-memory, Redis)
- Seamless upgrade path (EventBus → PubSubBroker)

### 2. WebSocket Server Architecture

```
application/
└── websocket/
    ├── websocket-server.ts       # WebSocket server setup
    ├── websocket-handler.ts      # Connection handler
    ├── connection-manager.ts     # Track active connections
    ├── message-router.ts         # Route messages to handlers
    └── middleware/
        ├── ws-auth-middleware.ts # JWT authentication
        └── ws-logging-middleware.ts
```

### 3. Message Flow

```
HTTP POST /api/messages
  ↓
MessageService.sendMessage()
  ↓
PubSubBroker.publish('message.sent')
  ↓
[Redis PubSub Channel]
  ↓
WebSocketHandler receives event
  ↓
ConnectionManager.broadcast(topic, message)
  ↓
All subscribed WebSocket clients receive message
```

---

## Implementation Phases

### Phase 2.1: PubSubBroker (Infrastructure)
**Time**: 2-3 days
**Priority**: CRITICAL (foundation for everything else)

#### Tasks:
1. **Create PubSubBroker interface** (`infrastructure/pubsub/`)
   - [ ] `pubsub-broker.ts` - Core interface and types
   - [ ] `adapters/memory-adapter.ts` - In-memory implementation (default)
   - [ ] `adapters/redis-adapter.ts` - Redis-backed implementation

2. **Implement adapter pattern**
   - [ ] Adapter interface with `publish()`, `subscribe()`, `unsubscribe()`
   - [ ] Connection pooling for Redis adapter
   - [ ] Graceful degradation (Redis → memory on failure)

3. **Backward compatibility layer**
   - [ ] Update `eventBus` to use PubSubBroker internally
   - [ ] Ensure existing code works without changes
   - [ ] Migration helper utilities

4. **Testing**
   - [ ] Unit tests for each adapter
   - [ ] Integration tests with Redis
   - [ ] Failover testing (Redis disconnect)

**Acceptance Criteria**:
- ✅ All existing EventBus tests pass
- ✅ New PubSubBroker tests pass
- ✅ Redis adapter functional
- ✅ No breaking changes to existing code

---

### Phase 2.2: WebSocket Server Core
**Time**: 2-3 days
**Priority**: HIGH

#### Tasks:
1. **Install dependencies**
   ```bash
   npm install ws @types/ws
   ```

2. **Create WebSocket server** (`application/websocket/`)
   - [ ] `websocket-server.ts` - Server initialization
   - [ ] Listen on separate port (default: 8080)
   - [ ] Integrate with existing HTTP server lifecycle

3. **Connection management**
   - [ ] `connection-manager.ts` - Track all active WebSocket connections
   - [ ] Connection metadata (user ID, topics subscribed)
   - [ ] Connection cleanup on disconnect
   - [ ] Heartbeat/ping-pong mechanism

4. **Message handling**
   - [ ] `websocket-handler.ts` - Handle incoming messages
   - [ ] Message types: `subscribe`, `unsubscribe`, `message`, `ping`
   - [ ] Error handling and validation

**Acceptance Criteria**:
- ✅ WebSocket server starts and accepts connections
- ✅ Connections tracked in ConnectionManager
- ✅ Ping/pong keep-alive working
- ✅ Clean disconnection handling

---

### Phase 2.3: WebSocket Authentication
**Time**: 1 day
**Priority**: CRITICAL (security)

#### Tasks:
1. **JWT authentication middleware**
   - [ ] `ws-auth-middleware.ts` - Verify JWT tokens
   - [ ] Support token in query param: `?token=...`
   - [ ] Support token in first message: `{ type: "auth", token: "..." }`

2. **Session management**
   - [ ] Link WebSocket connection to user session
   - [ ] Store user ID in connection metadata
   - [ ] Disconnect on invalid/expired tokens

3. **Authorization checks**
   - [ ] Verify user can subscribe to requested topics
   - [ ] Room-based access control (optional)

**Acceptance Criteria**:
- ✅ Unauthenticated connections rejected
- ✅ Valid JWT tokens authenticated
- ✅ Expired tokens rejected
- ✅ User ID linked to connection

---

### Phase 2.4: Topic-Based Messaging
**Time**: 2 days
**Priority**: HIGH

#### Tasks:
1. **Topic subscription system**
   - [ ] `message-router.ts` - Route messages to subscribed connections
   - [ ] Subscribe to topics: `{ type: "subscribe", topic: "messages.user.123" }`
   - [ ] Unsubscribe: `{ type: "unsubscribe", topic: "messages.user.123" }`

2. **Message broadcasting**
   - [ ] Broadcast to all subscribers of a topic
   - [ ] Support wildcards: `messages.*`, `messages.user.*`
   - [ ] Direct messages (user-to-user)

3. **Integration with PubSubBroker**
   - [ ] Subscribe WebSocket handler to PubSub topics
   - [ ] Forward PubSub events to WebSocket clients
   - [ ] Bidirectional flow (WS → PubSub → WS)

**Acceptance Criteria**:
- ✅ Clients can subscribe/unsubscribe to topics
- ✅ Messages broadcast to correct subscribers
- ✅ PubSub events forwarded to WebSocket clients
- ✅ Wildcard subscriptions working

---

### Phase 2.5: Cross-Protocol Integration
**Time**: 1-2 days
**Priority**: MEDIUM

#### Tasks:
1. **HTTP → WebSocket flow**
   - [ ] Update `MessageService.sendMessage()` to publish to PubSub
   - [ ] WebSocket handler subscribes to `message.sent` topic
   - [ ] Clients subscribed to `messages.*` receive HTTP-created messages

2. **WebSocket → HTTP flow**
   - [ ] WebSocket messages create entries via MessageService
   - [ ] Full validation and persistence
   - [ ] Emit events back through PubSub

3. **Event mapping**
   - [ ] Map internal events to WebSocket topics
   - [ ] user.created → `users.created`
   - [ ] message.sent → `messages.sent`

**Acceptance Criteria**:
- ✅ HTTP POST creates message, WebSocket clients notified
- ✅ WebSocket message creates database entry
- ✅ All events flow through PubSub correctly

---

### Phase 2.6: Testing & Documentation
**Time**: 2 days
**Priority**: CRITICAL

#### Tasks:
1. **WebSocket integration tests**
   - [ ] `tests/integration/websocket/` directory
   - [ ] Connection lifecycle tests
   - [ ] Authentication tests
   - [ ] Subscription tests
   - [ ] Cross-protocol tests (HTTP + WebSocket)

2. **Load testing**
   - [ ] Test with 100+ concurrent WebSocket connections
   - [ ] Measure message latency
   - [ ] Test Redis failover behavior

3. **Documentation updates**
   - [ ] Update ARCHITECTURE.md with WebSocket architecture
   - [ ] Update README.md with WebSocket API docs
   - [ ] Add WebSocket client examples
   - [ ] Update PLAN.md with Phase 2 completion

**Acceptance Criteria**:
- ✅ All WebSocket tests passing
- ✅ Cross-protocol tests passing
- ✅ Documentation complete
- ✅ Examples working

---

## Technical Specifications

### WebSocket Message Protocol

#### Client → Server Messages

**1. Authentication**
```json
{
  "type": "auth",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**2. Subscribe to Topic**
```json
{
  "type": "subscribe",
  "topic": "messages.user.123"
}
```

**3. Unsubscribe from Topic**
```json
{
  "type": "unsubscribe",
  "topic": "messages.user.123"
}
```

**4. Send Message**
```json
{
  "type": "message",
  "topic": "messages.channel.456",
  "content": "Hello, world!",
  "data": {
    "userId": "123",
    "channelId": "456"
  }
}
```

**5. Ping (keep-alive)**
```json
{
  "type": "ping"
}
```

#### Server → Client Messages

**1. Authentication Result**
```json
{
  "type": "auth_success",
  "userId": "123",
  "timestamp": "2025-11-11T15:30:00Z"
}
```

**2. Subscription Confirmed**
```json
{
  "type": "subscribed",
  "topic": "messages.user.123",
  "timestamp": "2025-11-11T15:30:01Z"
}
```

**3. Message Received**
```json
{
  "type": "message",
  "topic": "messages.user.123",
  "eventType": "message.sent",
  "data": {
    "id": "msg-uuid",
    "userId": "123",
    "content": "Hello!",
    "createdAt": "2025-11-11T15:30:02Z"
  },
  "timestamp": "2025-11-11T15:30:02Z"
}
```

**4. Error**
```json
{
  "type": "error",
  "code": 4,
  "message": "Authentication failed",
  "timestamp": "2025-11-11T15:30:00Z"
}
```

**5. Pong (keep-alive response)**
```json
{
  "type": "pong",
  "timestamp": "2025-11-11T15:30:03Z"
}
```

---

## Configuration Changes

### Environment Variables

```bash
# WebSocket Configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=8080
WEBSOCKET_HOST=0.0.0.0
WEBSOCKET_PING_INTERVAL=30000  # 30 seconds
WEBSOCKET_PING_TIMEOUT=10000   # 10 seconds

# PubSub Configuration
PUBSUB_ADAPTER=redis  # 'memory' or 'redis'
PUBSUB_REDIS_URL=redis://localhost:6379
PUBSUB_REDIS_PREFIX=pubsub:
```

### Docker Compose Updates

```yaml
app:
  ports:
    - "3000:3000"  # HTTP
    - "8080:8080"  # WebSocket (NEW)
  environment:
    - WEBSOCKET_ENABLED=true
    - PUBSUB_ADAPTER=redis
```

---

## Dependencies

### New NPM Packages

```json
{
  "dependencies": {
    "ws": "^8.14.2"           // WebSocket server
  },
  "devDependencies": {
    "@types/ws": "^8.5.8"     // TypeScript types
  }
}
```

---

## Testing Strategy

### Unit Tests
- PubSubBroker adapters (memory, Redis)
- ConnectionManager operations
- MessageRouter logic
- Authentication middleware

### Integration Tests
- WebSocket connection lifecycle
- Authentication flow
- Topic subscription/unsubscribe
- Message broadcasting
- Cross-protocol messaging (HTTP → WebSocket)

### Load Tests
- 100+ concurrent connections
- Message throughput (messages/second)
- Memory usage under load
- Redis failover scenarios

---

## Success Criteria

### Phase 2 Complete When:
- [x] PubSubBroker implemented with Redis adapter
- [x] WebSocket server operational
- [x] JWT authentication working
- [x] Topic-based subscriptions working
- [x] Message broadcasting functional
- [x] Cross-protocol messaging working (HTTP → WebSocket)
- [x] Ping/pong keep-alive implemented
- [x] All tests passing
- [x] Documentation updated
- [x] Performance targets met:
  - [ ] Support 100+ concurrent WebSocket connections
  - [ ] Message latency < 100ms (p95)
  - [ ] No memory leaks after 1000 connect/disconnect cycles

---

## Risk Assessment

### Low Risk
- ✅ Building on stable Phase 1 foundation
- ✅ Using battle-tested `ws` library
- ✅ Well-defined WebSocket protocol standards

### Medium Risk
- ⚠️ Redis dependency (mitigated by memory adapter fallback)
- ⚠️ Connection management complexity (mitigated by clear lifecycle design)

### Mitigation Strategies
- Comprehensive testing (unit + integration + load)
- Graceful degradation (Redis failure → memory adapter)
- Connection limits to prevent resource exhaustion
- Thorough error handling at all layers

---

## Timeline

```
Week 1:
  Mon-Tue: PubSubBroker implementation
  Wed:     WebSocket server core + authentication
  Thu-Fri: Topic-based messaging

Week 2:
  Mon:     Cross-protocol integration
  Tue-Wed: Testing (unit + integration)
  Thu:     Load testing + optimization
  Fri:     Documentation + polish
```

---

## Next Steps

1. **Immediate**: Install `ws` and `@types/ws`
2. **Phase 2.1**: Implement PubSubBroker with adapters
3. **Phase 2.2**: Build WebSocket server core
4. **Phase 2.3**: Add authentication
5. **Phase 2.4**: Implement topic-based messaging
6. **Phase 2.5**: Cross-protocol integration
7. **Phase 2.6**: Testing and documentation

---

**Status**: 🔄 Ready to begin Phase 2.1 (PubSubBroker)
**Last Updated**: 2025-11-11
