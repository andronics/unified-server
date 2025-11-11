# WebSocket Client Examples

This directory contains example implementations for connecting to the Unified Server's WebSocket API.

---

## Quick Start

### 1. Start the Server

```bash
# In the project root
npm install
npm run build
npm start
```

### 2. Get a JWT Token

```bash
# Create a user (if needed)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "password123"
  }'

# Login to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Save the accessToken from the response
```

### 3. Run the Example

```bash
# Set your JWT token
export JWT_TOKEN="your-access-token-here"

# Run the WebSocket client
node examples/websocket-client.js
```

---

## Examples Included

### 1. websocket-client.js

**Node.js WebSocket client** with full functionality:
- Connection establishment
- JWT authentication
- Topic subscriptions
- Message publishing
- Event handling
- Error handling

**Usage:**

```bash
JWT_TOKEN=<your-token> node examples/websocket-client.js
```

---

## Testing Real-Time Messages

With the WebSocket client running, send messages via HTTP to see real-time updates:

### Terminal 1: Run WebSocket Client

```bash
export JWT_TOKEN="<your-token>"
node examples/websocket-client.js
```

### Terminal 2: Send HTTP Messages

```bash
# Get user ID from login response
USER_ID="<your-user-id>"

# Send a message
curl -X POST http://localhost:3000/api/messages \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"content\": \"Hello from HTTP!\"
  }"
```

You should see the message appear instantly in Terminal 1! 🎉

---

## Browser Example

Create an `index.html` file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>WebSocket Client</title>
</head>
<body>
    <h1>WebSocket Client</h1>
    <div id="status">Disconnected</div>
    <div id="messages"></div>

    <script>
        const token = 'YOUR_JWT_TOKEN'; // Replace with actual token
        const ws = new WebSocket('ws://localhost:3000/ws');

        ws.onopen = () => {
            document.getElementById('status').textContent = 'Connected';

            // Authenticate
            ws.send(JSON.stringify({
                type: 'auth',
                token: token
            }));
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log('Received:', message);

            if (message.type === 'auth_success') {
                // Subscribe to messages
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    topic: 'messages.**'
                }));
            }

            if (message.type === 'message') {
                const div = document.createElement('div');
                div.textContent = JSON.stringify(message.data);
                document.getElementById('messages').appendChild(div);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            document.getElementById('status').textContent = 'Disconnected';
        };
    </script>
</body>
</html>
```

---

## React Example

```typescript
import { useEffect, useState } from 'react';

function useWebSocket(token: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:3000/ws');

    websocket.onopen = () => {
      console.log('Connected');
      setConnected(true);

      // Authenticate
      websocket.send(JSON.stringify({
        type: 'auth',
        token
      }));
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'auth_success') {
        // Subscribe to messages
        websocket.send(JSON.stringify({
          type: 'subscribe',
          topic: 'messages.**'
        }));
      }

      if (message.type === 'message') {
        setMessages(prev => [...prev, message.data]);
      }
    };

    websocket.onclose = () => {
      setConnected(false);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [token]);

  return { ws, connected, messages };
}

// Usage in component
function App() {
  const token = 'YOUR_JWT_TOKEN';
  const { ws, connected, messages } = useWebSocket(token);

  return (
    <div>
      <h1>WebSocket Demo</h1>
      <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
      <div>
        {messages.map((msg, i) => (
          <div key={i}>{JSON.stringify(msg)}</div>
        ))}
      </div>
    </div>
  );
}
```

---

## Python Example

```python
import asyncio
import websockets
import json

async def websocket_client(token):
    uri = "ws://localhost:3000/ws"

    async with websockets.connect(uri) as websocket:
        # Authenticate
        await websocket.send(json.dumps({
            "type": "auth",
            "token": token
        }))

        # Wait for auth response
        response = await websocket.recv()
        auth_msg = json.loads(response)

        if auth_msg["type"] == "auth_success":
            print(f"Authenticated as: {auth_msg['userId']}")

            # Subscribe to messages
            await websocket.send(json.dumps({
                "type": "subscribe",
                "topic": "messages.**"
            }))

            # Listen for messages
            async for message in websocket:
                msg = json.loads(message)
                print(f"Received: {msg['type']}")

                if msg["type"] == "message":
                    print(f"Message data: {msg['data']}")

# Run
asyncio.run(websocket_client("YOUR_JWT_TOKEN"))
```

---

## Troubleshooting

### Connection Refused

**Problem:** Cannot connect to `ws://localhost:3000/ws`

**Solution:**
- Check server is running: `npm start`
- Verify WebSocket is enabled in `.env`: `WEBSOCKET_ENABLED=true`
- Check port is correct (default: 3000)

### Authentication Failed

**Problem:** Receiving `auth_error` message

**Solution:**
- Get a fresh token from `/api/auth/login`
- Check token hasn't expired (default: 15 minutes)
- Verify token is sent correctly in `auth` message

### No Messages Received

**Problem:** Subscribed but not receiving messages

**Solution:**
- Verify authentication succeeded
- Check topic pattern matches (e.g., `messages.**`)
- Send a test message via HTTP API
- Check server logs for errors

---

## API Reference

See [WebSocket API Documentation](../docs/WEBSOCKET-API.md) for complete API reference.

---

## Need Help?

- Check the [main documentation](../docs/)
- Review [deployment guide](../docs/DEPLOYMENT.md)
- Open an issue on GitHub

---

**Last Updated:** 2025-11-11
