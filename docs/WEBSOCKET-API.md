# WebSocket API Documentation

**Version:** 1.0.0
**Protocol:** WebSocket (RFC 6455)
**Endpoint:** `ws://localhost:3000/ws`

---

## Table of Contents

1. [Overview](#overview)
2. [Connection](#connection)
3. [Authentication](#authentication)
4. [Message Format](#message-format)
5. [Client Messages](#client-messages)
6. [Server Messages](#server-messages)
7. [Topics & Subscriptions](#topics--subscriptions)
8. [Error Handling](#error-handling)
9. [Examples](#examples)
10. [Best Practices](#best-practices)

---

## Overview

The WebSocket API provides real-time, bidirectional communication between clients and the server. It supports:

- **JWT-based authentication**
- **Topic-based pub/sub messaging**
- **Automatic message broadcasting**
- **Keep-alive ping/pong**
- **Cross-protocol integration** (HTTP → WebSocket events)

### Key Features

- ✅ Real-time message delivery
- ✅ Topic pattern matching with wildcards
- ✅ Automatic reconnection support
- ✅ Message ordering guarantees (per connection)
- ✅ Graceful connection management

---

## Connection

### Establishing a Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected to WebSocket server');
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code, event.reason);
};
```

### Connection Limits

- **Max connections per IP:** 100 (configurable)
- **Max message size:** 1 MB (configurable)
- **Idle timeout:** 60 seconds (based on ping/pong)

---

## Authentication

Authentication is **required** before subscribing to topics or publishing messages.

### Authentication Flow

1. Connect to WebSocket
2. Send `auth` message with JWT token
3. Receive `auth_success` or `auth_error`
4. Proceed with subscriptions and messaging

### Auth Message

**Client → Server:**

```json
{
  "type": "auth",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Server → Client (Success):**

```json
{
  "type": "auth_success",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-11-11T12:00:00.000Z"
}
```

**Server → Client (Error):**

```json
{
  "type": "auth_error",
  "message": "Invalid token",
  "code": 401,
  "timestamp": "2025-11-11T12:00:00.000Z"
}
```

### Getting a JWT Token

Obtain a token via the HTTP authentication endpoint:

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

# Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "..."
  }
}
```

---

## Message Format

All messages follow a standardized JSON format:

```typescript
interface BaseMessage {
  type: string;           // Message type
  timestamp?: string;     // ISO 8601 timestamp
}
```

### Message Types

| Direction        | Type          | Description                    |
|------------------|---------------|--------------------------------|
| Client → Server  | `auth`        | Authenticate connection        |
| Client → Server  | `subscribe`   | Subscribe to topic             |
| Client → Server  | `unsubscribe` | Unsubscribe from topic         |
| Client → Server  | `message`     | Publish message to topic       |
| Client → Server  | `ping`        | Health check request           |
| Server → Client  | `auth_success`| Authentication successful      |
| Server → Client  | `auth_error`  | Authentication failed          |
| Server → Client  | `subscribed`  | Subscription confirmed         |
| Server → Client  | `unsubscribed`| Unsubscription confirmed       |
| Server → Client  | `message`     | Broadcast message              |
| Server → Client  | `error`       | Error notification             |
| Server → Client  | `pong`        | Health check response          |

---

## Client Messages

### 1. Subscribe to Topic

**Request:**

```json
{
  "type": "subscribe",
  "topic": "messages.user.123"
}
```

**Response:**

```json
{
  "type": "subscribed",
  "topic": "messages.user.123",
  "timestamp": "2025-11-11T12:00:00.000Z"
}
```

**Topic Patterns:**

- Exact: `messages.user.123`
- Single wildcard: `messages.user.*` (matches `messages.user.123`, `messages.user.456`)
- Multi-level wildcard: `messages.**` (matches `messages.user.123`, `messages.channel.abc`, etc.)

### 2. Unsubscribe from Topic

**Request:**

```json
{
  "type": "unsubscribe",
  "topic": "messages.user.123"
}
```

**Response:**

```json
{
  "type": "unsubscribed",
  "topic": "messages.user.123",
  "timestamp": "2025-11-11T12:00:00.000Z"
}
```

### 3. Publish Message

**Request:**

```json
{
  "type": "message",
  "topic": "messages.channel.general",
  "data": {
    "content": "Hello, World!",
    "attachments": []
  },
  "metadata": {
    "priority": "normal"
  }
}
```

**Notes:**
- Authentication required
- Message will be broadcast to all subscribers of the topic
- No response sent (fire-and-forget)

### 4. Ping (Health Check)

**Request:**

```json
{
  "type": "ping"
}
```

**Response:**

```json
{
  "type": "pong",
  "timestamp": "2025-11-11T12:00:00.000Z"
}
```

---

## Server Messages

### 1. Broadcast Message

Sent when a message is published to a subscribed topic:

```json
{
  "type": "message",
  "topic": "messages.user.123",
  "eventType": "message.sent",
  "data": {
    "id": "msg-uuid",
    "userId": "user-abc",
    "recipientId": "user-123",
    "content": "Hello!",
    "createdAt": "2025-11-11T12:00:00.000Z",
    "updatedAt": "2025-11-11T12:00:00.000Z"
  },
  "metadata": {
    "senderId": "user-abc",
    "senderConnectionId": "conn-xyz"
  },
  "timestamp": "2025-11-11T12:00:00.000Z"
}
```

### 2. Error Message

Sent when an error occurs:

```json
{
  "type": "error",
  "code": 400,
  "message": "Invalid message format",
  "details": {
    "field": "topic",
    "issue": "required"
  },
  "timestamp": "2025-11-11T12:00:00.000Z"
}
```

**Common Error Codes:**

| Code | Meaning                     |
|------|-----------------------------|
| 400  | Bad Request                 |
| 401  | Unauthorized                |
| 403  | Forbidden                   |
| 500  | Internal Server Error       |
| 1000 | Normal Closure              |
| 1008 | Policy Violation            |

---

## Topics & Subscriptions

### Topic Naming Convention

```
<resource>.<scope>.<identifier>

Examples:
- messages                      (all messages)
- messages.user.123            (user 123's messages)
- messages.channel.general     (general channel)
- notifications.user.456       (user 456's notifications)
```

### Wildcard Matching

**Single-level wildcard (`*`):**
```
messages.user.*
  ✓ Matches: messages.user.123
  ✓ Matches: messages.user.456
  ✗ No match: messages.channel.general
```

**Multi-level wildcard (`**`):**
```
messages.**
  ✓ Matches: messages.user.123
  ✓ Matches: messages.channel.general
  ✓ Matches: messages.user.123.replies
```

### Automatic Topic Broadcasting

When a message is created via HTTP POST /api/messages, it's automatically broadcast to:

1. `messages` - All subscribers
2. `messages.user.{senderId}` - Sender's personal feed
3. `messages.user.{recipientId}` - Recipient's personal feed (if DM)
4. `messages.channel.{channelId}` - Channel feed (if channel message)

---

## Error Handling

### Connection Errors

```javascript
ws.onerror = (error) => {
  console.error('Connection error:', error);
  // Implement reconnection logic
};

ws.onclose = (event) => {
  if (event.code !== 1000) {
    console.error('Abnormal closure:', event.code, event.reason);
    // Implement reconnection with exponential backoff
  }
};
```

### Message Errors

```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'error') {
    console.error('Server error:', message.code, message.message);

    switch (message.code) {
      case 401:
        // Re-authenticate
        break;
      case 403:
        // Permission denied
        break;
      default:
        // Handle other errors
    }
  }
};
```

### Reconnection Strategy

```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const baseDelay = 1000;

function connect() {
  const ws = new WebSocket('ws://localhost:3000/ws');

  ws.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = baseDelay * Math.pow(2, reconnectAttempts);
      console.log(`Reconnecting in ${delay}ms...`);

      setTimeout(() => {
        reconnectAttempts++;
        connect();
      }, delay);
    }
  };

  ws.onopen = () => {
    reconnectAttempts = 0; // Reset on successful connection
  };
}
```

---

## Examples

### Complete Client Example (JavaScript)

```javascript
class WebSocketClient {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.ws = null;
    this.authenticated = false;
    this.subscriptions = new Set();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('Connected');
        this.authenticate().then(resolve).catch(reject);
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected');
        this.authenticated = false;
      };
    });
  }

  authenticate() {
    return new Promise((resolve, reject) => {
      const handler = (message) => {
        if (message.type === 'auth_success') {
          this.authenticated = true;
          console.log('Authenticated as:', message.userId);
          resolve(message.userId);
        } else if (message.type === 'auth_error') {
          reject(new Error(message.message));
        }
      };

      this.once('auth_success', handler);
      this.once('auth_error', handler);

      this.send({
        type: 'auth',
        token: this.token,
      });
    });
  }

  subscribe(topic, callback) {
    if (!this.authenticated) {
      throw new Error('Not authenticated');
    }

    this.subscriptions.add(topic);
    this.on('message', (message) => {
      if (message.topic === topic || this.matchesTopic(topic, message.topic)) {
        callback(message);
      }
    });

    this.send({
      type: 'subscribe',
      topic,
    });
  }

  publish(topic, data, metadata = {}) {
    if (!this.authenticated) {
      throw new Error('Not authenticated');
    }

    this.send({
      type: 'message',
      topic,
      data,
      metadata,
    });
  }

  send(message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  handleMessage(message) {
    // Emit event for listeners
    this.emit(message.type, message);
  }

  // Simple event emitter implementation
  on(event, handler) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  once(event, handler) {
    const wrapper = (...args) => {
      handler(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  off(event, handler) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    }
  }

  emit(event, ...args) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(handler => handler(...args));
    }
  }

  matchesTopic(pattern, topic) {
    // Simple wildcard matching
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^.]+');
    return new RegExp(`^${regex}$`).test(topic);
  }

  close() {
    if (this.ws) {
      this.ws.close(1000, 'Client closing');
    }
  }
}

// Usage
const client = new WebSocketClient('ws://localhost:3000/ws', 'your-jwt-token');

client.connect()
  .then((userId) => {
    console.log('Connected and authenticated:', userId);

    // Subscribe to user's messages
    client.subscribe(`messages.user.${userId}`, (message) => {
      console.log('Received message:', message.data);
    });

    // Subscribe to all messages
    client.subscribe('messages.**', (message) => {
      console.log('Any message:', message.data);
    });

    // Publish a message
    client.publish('messages.channel.general', {
      content: 'Hello from WebSocket!',
    });
  })
  .catch((error) => {
    console.error('Connection failed:', error);
  });
```

### TypeScript Example

```typescript
import { WebSocket } from 'ws';

interface AuthMessage {
  type: 'auth';
  token: string;
}

interface SubscribeMessage {
  type: 'subscribe';
  topic: string;
}

interface PublishMessage {
  type: 'message';
  topic: string;
  data: any;
  metadata?: Record<string, any>;
}

type ClientMessage = AuthMessage | SubscribeMessage | PublishMessage;

interface ServerMessage {
  type: string;
  timestamp?: string;
  [key: string]: any;
}

class TypedWebSocketClient {
  private ws: WebSocket | null = null;
  private authenticated = false;

  constructor(
    private url: string,
    private token: string
  ) {}

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.url);

    await new Promise<void>((resolve, reject) => {
      this.ws!.on('open', () => resolve());
      this.ws!.on('error', reject);
    });

    await this.authenticate();
  }

  private async authenticate(): Promise<string> {
    return new Promise((resolve, reject) => {
      const handler = (data: Buffer) => {
        const message: ServerMessage = JSON.parse(data.toString());

        if (message.type === 'auth_success') {
          this.authenticated = true;
          this.ws!.off('message', handler);
          resolve(message.userId);
        } else if (message.type === 'auth_error') {
          this.ws!.off('message', handler);
          reject(new Error(message.message));
        }
      };

      this.ws!.on('message', handler);
      this.send({ type: 'auth', token: this.token });
    });
  }

  subscribe(topic: string, callback: (message: ServerMessage) => void): void {
    if (!this.authenticated) {
      throw new Error('Not authenticated');
    }

    this.ws!.on('message', (data: Buffer) => {
      const message: ServerMessage = JSON.parse(data.toString());
      if (message.type === 'message' && message.topic === topic) {
        callback(message);
      }
    });

    this.send({ type: 'subscribe', topic });
  }

  publish(topic: string, data: any, metadata?: Record<string, any>): void {
    if (!this.authenticated) {
      throw new Error('Not authenticated');
    }

    this.send({
      type: 'message',
      topic,
      data,
      metadata,
    });
  }

  private send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client closing');
    }
  }
}

// Usage
const client = new TypedWebSocketClient('ws://localhost:3000/ws', 'jwt-token');

await client.connect();
client.subscribe('messages.user.123', (message) => {
  console.log('Message:', message.data);
});
```

---

## Best Practices

### 1. Authentication

- ✅ Always authenticate immediately after connecting
- ✅ Handle token expiration and re-authentication
- ✅ Use HTTPS/WSS in production

### 2. Subscriptions

- ✅ Subscribe to specific topics, not wildcards when possible
- ✅ Unsubscribe when no longer needed to reduce server load
- ✅ Batch subscriptions if subscribing to multiple topics

### 3. Error Handling

- ✅ Implement exponential backoff for reconnections
- ✅ Handle all error types gracefully
- ✅ Log errors for debugging

### 4. Performance

- ✅ Limit message size to avoid network congestion
- ✅ Batch messages when publishing multiple at once
- ✅ Use compression for large payloads (gzip)

### 5. Security

- ✅ Validate all incoming messages
- ✅ Sanitize user-generated content
- ✅ Rate limit message publishing
- ✅ Use WSS (WebSocket Secure) in production

---

## Configuration

Server configuration via environment variables:

```env
# Enable/disable WebSocket server
WEBSOCKET_ENABLED=true

# WebSocket server port (shares with HTTP)
WEBSOCKET_PORT=3000
WEBSOCKET_HOST=0.0.0.0

# Keep-alive settings
WEBSOCKET_PING_INTERVAL=30000          # 30 seconds
WEBSOCKET_PING_TIMEOUT=60000           # 60 seconds

# Connection limits
WEBSOCKET_MAX_CONNECTIONS_PER_IP=100   # Per IP limit
WEBSOCKET_MAX_MESSAGE_SIZE=1048576     # 1 MB

# PubSub backend
PUBSUB_ADAPTER=memory                   # or 'redis'
PUBSUB_REDIS_URL=redis://localhost:6379
```

---

## Troubleshooting

### Connection Refused

**Problem:** Cannot connect to WebSocket server

**Solutions:**
- Check if server is running
- Verify WebSocket is enabled (`WEBSOCKET_ENABLED=true`)
- Check firewall settings
- Verify port is correct

### Authentication Failures

**Problem:** Receiving `auth_error` messages

**Solutions:**
- Verify JWT token is valid and not expired
- Check token was obtained from `/api/auth/login`
- Ensure token is sent with `auth` message type

### Not Receiving Messages

**Problem:** Subscribed but no messages arrive

**Solutions:**
- Verify authentication was successful
- Check topic pattern matches published topics
- Confirm messages are being published
- Check server logs for errors

### Connection Drops

**Problem:** Frequent disconnections

**Solutions:**
- Implement reconnection logic with backoff
- Check network stability
- Verify ping/pong is working
- Increase `WEBSOCKET_PING_TIMEOUT` if needed

---

## Support

For issues or questions:
- GitHub Issues: [Repository URL]
- Documentation: [Docs URL]
- API Reference: This document

---

**Last Updated:** 2025-11-11
**Version:** 1.0.0
