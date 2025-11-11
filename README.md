# Unified Multi-Protocol Server

A production-ready, multi-protocol server built with TypeScript, supporting both HTTP REST API and WebSocket real-time communication, following clean architecture principles with a 4-layer design.

## Features

### Core Architecture
- **🏗️ Clean Architecture**: 4-layer architecture (Foundation, Infrastructure, Integration, Application)
- **🎯 Event-Driven**: Internal event bus for loosely-coupled components
- **📦 PubSub System**: Redis and in-memory adapters for scalable messaging
- **🔄 Cross-Protocol**: Seamless HTTP → WebSocket event broadcasting

### Communication Protocols
- **🌐 HTTP REST API**: Full CRUD operations with Express
- **⚡ WebSocket**: Real-time bidirectional communication
- **📡 Topic-Based PubSub**: Wildcard pattern matching for intelligent routing

### Security & Authentication
- **🔐 JWT Authentication**: Secure token-based auth for both HTTP and WebSocket
- **🔒 Security**: Helmet, CORS, rate limiting, input validation
- **✅ Input Validation**: Zod schema validation for all inputs

### Operations & Monitoring
- **📊 Prometheus Metrics**: Built-in metrics collection and monitoring
- **📝 Structured Logging**: Correlation IDs, request tracking with Pino
- **🚀 Production-Ready**: Docker, health checks, graceful shutdown
- **📈 Horizontal Scaling**: Redis PubSub for multi-instance deployments

## Architecture

### 4-Layer Structure

```
src/
├── foundation/         # Layer 1: Types, errors, validators
├── infrastructure/     # Layer 2: Config, logging, auth, events, metrics
├── integration/        # Layer 3: Database, cache, external APIs
└── application/        # Layer 4: Services, HTTP routes, controllers
```

### Technology Stack

- **Runtime**: Node.js 20+, TypeScript 5.2+
- **Web Framework**: Express
- **WebSocket**: ws (WebSocket library)
- **Database**: PostgreSQL 16
- **Cache/PubSub**: Redis 7
- **Validation**: Zod
- **Logging**: Pino
- **Metrics**: Prometheus (prom-client)
- **Authentication**: JWT (jsonwebtoken), bcrypt
- **Testing**: Vitest

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7
- Docker & Docker Compose (optional)

### Installation

1. **Clone and install dependencies**:

```bash
npm install
```

2. **Configure environment**:

```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Run database migrations**:

```bash
npm run migrate
```

4. **Start development server**:

```bash
npm run dev
```

The server will start on `http://localhost:3000`.

### Docker Compose (Recommended)

Start the entire stack (app + PostgreSQL + Redis + Prometheus + Grafana):

```bash
docker-compose up -d
```

Services:
- **HTTP API**: http://localhost:3000/api
- **WebSocket**: ws://localhost:3000/ws
- **Metrics**: http://localhost:9090/metrics
- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3001 (admin/admin)

## API Endpoints

### HTTP REST API

#### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user (requires auth)

#### Users

- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

#### Messages

- `POST /api/messages` - Send message (broadcasts to WebSocket)
- `GET /api/messages` - Get all messages (pagination)
- `GET /api/messages/:id` - Get message by ID
- `DELETE /api/messages/:id` - Delete message

#### Health

- `GET /health` - Overall health status
- `GET /health/ready` - Readiness probe (K8s)
- `GET /health/live` - Liveness probe (K8s)

### WebSocket API

Connect to `ws://localhost:3000/ws` for real-time bidirectional communication.

**Message Types (Client → Server):**
- `auth` - Authenticate with JWT token
- `subscribe` - Subscribe to topic (wildcards: `*`, `**`)
- `unsubscribe` - Unsubscribe from topic
- `message` - Publish message to topic
- `ping` - Health check

**Message Types (Server → Client):**
- `auth_success` - Authentication successful
- `subscribed` - Subscription confirmed
- `message` - Message received on subscribed topic
- `error` - Error occurred
- `pong` - Ping response

See [WebSocket API Documentation](docs/WEBSOCKET-API.md) for complete reference.

## Authentication

### HTTP REST API

All protected endpoints require a JWT token in the Authorization header:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "password": "SecurePass123!"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'

# Use token
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### WebSocket

WebSocket connections require JWT authentication via the `auth` message:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  // Send auth message
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'YOUR_JWT_TOKEN'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'auth_success') {
    console.log('Authenticated!');
    // Now you can subscribe to topics
    ws.send(JSON.stringify({
      type: 'subscribe',
      topic: 'messages.**'
    }));
  }
};
```

See [examples/](examples/) for complete client implementations.

## Development

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm test             # Run tests
npm run test:coverage # Run tests with coverage
npm run lint         # Lint code
npm run format       # Format code with Prettier
npm run migrate      # Run database migrations
```

### Project Structure

```
unified-server/
├── src/
│   ├── foundation/          # Types, errors, validators
│   ├── infrastructure/      # Config, logging, auth, events, pubsub
│   ├── integration/         # Database, cache
│   ├── application/         # Services, HTTP, WebSocket
│   └── server.ts            # Entry point
├── tests/                   # Test files
├── docs/                    # Documentation
│   ├── WEBSOCKET-API.md    # WebSocket API reference
│   └── DEPLOYMENT.md       # Production deployment guide
├── examples/                # Client examples
│   ├── websocket-client.js # Node.js WebSocket client
│   └── README.md           # Examples documentation
├── config/                  # Configuration files
├── docker-compose.yml       # Docker Compose config
├── Dockerfile              # Docker image
└── package.json            # Dependencies
```

## Configuration

Configuration follows hierarchical precedence:

1. Schema defaults
2. `config/default.json`
3. `config/{env}.json`
4. Environment variables (highest priority)

### Key Environment Variables

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=unified_server
DB_USER=postgres
DB_PASSWORD=postgres

# Redis (Cache & PubSub)
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication
JWT_SECRET=your-32-character-secret-key

# Logging
LOG_LEVEL=info
LOG_PRETTY=true

# WebSocket
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=3000
WEBSOCKET_PING_INTERVAL=30000

# PubSub (memory or redis)
PUBSUB_ADAPTER=memory
PUBSUB_REDIS_URL=redis://localhost:6379
```

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete configuration reference.

## Monitoring

### Prometheus Metrics

Access metrics at: `http://localhost:9090/metrics`

Key metrics:
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration
- `websocket_connections_total` - WebSocket connections
- `websocket_messages_total` - WebSocket messages
- `database_queries_total` - Database query count
- `cache_hits_total` / `cache_misses_total` - Cache performance
- `auth_attempts_total` - Authentication attempts
- `pubsub_messages_published_total` - PubSub messages published
- `pubsub_messages_delivered_total` - PubSub messages delivered

### Grafana Dashboards

1. Access Grafana: `http://localhost:3001`
2. Login: `admin` / `admin`
3. Add Prometheus datasource: `http://prometheus:9090`
4. Import dashboard or create your own

## Event System & PubSub

### Internal Event Bus

The server uses an internal event bus for decoupled communication between components:

```typescript
// Subscribe to events
eventBus.on('user.created', async (event) => {
  console.log('New user:', event.data.user);
});

// Emit events
eventBus.emit({
  eventId: uuidv4(),
  eventType: 'user.created',
  timestamp: new Date(),
  data: { user },
});
```

**Available Events**:
- `user.created`, `user.updated`, `user.deleted`
- `message.sent`, `message.received`

### PubSub System

The PubSub system bridges EventBus events to WebSocket clients:

```
HTTP POST /api/messages
  ↓
EventBus emits message.sent
  ↓
EventBridge publishes to PubSub topics
  ↓
WebSocket clients receive real-time updates
```

**Topic Patterns**:
- `messages` - All messages
- `messages.user.{userId}` - User-specific messages
- `messages.channel.{channelId}` - Channel messages
- Wildcards: `messages.*`, `messages.**`

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm run test:coverage
```

## Production Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for comprehensive deployment guide.

### Quick Docker Deploy

```bash
# Build image
docker build -t unified-server .

# Run container
docker run -p 3000:3000 -p 9090:9090 \
  -e DB_HOST=your-db-host \
  -e REDIS_HOST=your-redis-host \
  -e JWT_SECRET=your-secret \
  -e WEBSOCKET_ENABLED=true \
  -e PUBSUB_ADAPTER=redis \
  unified-server
```

### Production Checklist

**Security:**
- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Enable HTTPS/WSS (SSL/TLS certificates)
- [ ] Configure CORS origins
- [ ] Enable rate limiting
- [ ] Review security headers (Helmet)

**Infrastructure:**
- [ ] Configure production PostgreSQL
- [ ] Setup Redis for cache and PubSub
- [ ] Configure reverse proxy (Nginx)
- [ ] Setup load balancer (for scaling)

**Monitoring:**
- [ ] Setup Prometheus metrics scraping
- [ ] Configure Grafana dashboards
- [ ] Setup log aggregation
- [ ] Configure alerts

**Operations:**
- [ ] Configure database backups
- [ ] Setup graceful shutdown handling
- [ ] Configure health checks
- [ ] Test disaster recovery

**WebSocket Specific:**
- [ ] Use Redis PubSub for multi-instance
- [ ] Configure WebSocket timeouts
- [ ] Set appropriate connection limits
- [ ] Test WebSocket proxy configuration

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U postgres -d unified_server
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps redis

# Test Redis
docker-compose exec redis redis-cli ping
```

### Application Logs

```bash
# Follow logs
docker-compose logs -f app

# View specific service
docker-compose logs app
```

## Contributing

This is a reference implementation following clean architecture principles. Feel free to fork and adapt for your needs.

## Documentation

- **[WebSocket API Reference](docs/WEBSOCKET-API.md)** - Complete WebSocket API documentation
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Client Examples](examples/)** - WebSocket client examples (Node.js, Browser, React, Python)
- **[Phase 2 Summary](PHASE2-COMPLETE.md)** - WebSocket implementation details

## License

ISC

## Project Status

### ✅ Phase 1: HTTP REST API - COMPLETE
- HTTP server with Express
- JWT authentication
- PostgreSQL database
- Redis caching
- Event bus
- Prometheus metrics
- Health checks

### ✅ Phase 2: WebSocket Support - COMPLETE
- WebSocket server with JWT auth
- PubSub system (Memory + Redis)
- Cross-protocol integration (HTTP → WebSocket)
- Topic-based subscriptions
- Complete documentation
- Client examples

### 🔄 Future Enhancements (Roadmap)

- [ ] GraphQL API endpoint
- [ ] TCP raw socket server for IoT devices
- [ ] WebSocket integration tests
- [ ] Rate limiting per user
- [ ] API versioning
- [ ] Swagger/OpenAPI documentation
- [ ] E2E test suite
- [ ] CI/CD pipeline
- [ ] Kubernetes manifests

---

**Built with ❤️ using TypeScript and Clean Architecture principles**

**Version:** 1.0.0 (Phase 2 Complete)
**Last Updated:** 2025-11-11
