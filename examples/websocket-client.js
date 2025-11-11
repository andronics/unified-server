/**
 * WebSocket Client Example
 *
 * Simple Node.js WebSocket client demonstrating:
 * - Connection establishment
 * - Authentication with JWT
 * - Topic subscription
 * - Message publishing
 * - Event handling
 *
 * Usage:
 *   node examples/websocket-client.js
 */

const WebSocket = require('ws');

class UnifiedClient {
  constructor(url, options = {}) {
    this.url = url;
    this.token = options.token;
    this.ws = null;
    this.authenticated = false;
    this.messageHandlers = new Map();
    this.subscriptions = new Set();
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to ${this.url}...`);
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('✓ Connected to WebSocket server');
        this.setupHandlers();
        resolve();
      });

      this.ws.on('error', (error) => {
        console.error('✗ Connection error:', error.message);
        reject(error);
      });
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  setupHandlers() {
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`Disconnected: ${code} - ${reason || 'No reason'}`);
      this.authenticated = false;
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });

    this.ws.on('ping', () => {
      console.log('← Received ping from server');
    });

    this.ws.on('pong', () => {
      console.log('← Received pong from server');
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    console.log(`\n← Received: ${message.type}`);

    switch (message.type) {
      case 'auth_success':
        this.authenticated = true;
        console.log(`✓ Authenticated as user: ${message.userId}`);
        break;

      case 'auth_error':
        console.error(`✗ Authentication failed: ${message.message}`);
        break;

      case 'subscribed':
        console.log(`✓ Subscribed to topic: ${message.topic}`);
        break;

      case 'unsubscribed':
        console.log(`✓ Unsubscribed from topic: ${message.topic}`);
        break;

      case 'message':
        console.log(`✓ Message on topic: ${message.topic}`);
        console.log('  Data:', JSON.stringify(message.data, null, 2));
        if (message.metadata) {
          console.log('  Metadata:', JSON.stringify(message.metadata, null, 2));
        }

        // Call registered handlers
        const handler = this.messageHandlers.get(message.topic);
        if (handler) {
          handler(message);
        }
        break;

      case 'error':
        console.error(`✗ Server error [${message.code}]: ${message.message}`);
        if (message.details) {
          console.error('  Details:', JSON.stringify(message.details, null, 2));
        }
        break;

      case 'pong':
        console.log('✓ Pong received');
        break;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Authenticate with JWT token
   */
  async authenticate(token) {
    return new Promise((resolve, reject) => {
      if (!token) {
        token = this.token;
      }

      if (!token) {
        reject(new Error('No token provided'));
        return;
      }

      console.log('\nAuthenticating...');

      // Wait for auth response
      const originalHandler = this.handleMessage.bind(this);
      let resolved = false;

      const authHandler = (message) => {
        if (message.type === 'auth_success' && !resolved) {
          resolved = true;
          resolve(message.userId);
        } else if (message.type === 'auth_error' && !resolved) {
          resolved = true;
          reject(new Error(message.message));
        }
      };

      // Temporarily override message handler
      const tempHandler = (message) => {
        originalHandler(message);
        authHandler(message);
      };

      this.ws.removeAllListeners('message');
      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        tempHandler(message);
      });

      // Send auth message
      this.send({
        type: 'auth',
        token
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Authentication timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Subscribe to a topic
   */
  async subscribe(topic, handler) {
    if (!this.authenticated) {
      throw new Error('Must authenticate before subscribing');
    }

    console.log(`\nSubscribing to topic: ${topic}`);

    this.subscriptions.add(topic);

    if (handler) {
      this.messageHandlers.set(topic, handler);
    }

    this.send({
      type: 'subscribe',
      topic
    });

    // Wait a bit for confirmation
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(topic) {
    console.log(`\nUnsubscribing from topic: ${topic}`);

    this.subscriptions.delete(topic);
    this.messageHandlers.delete(topic);

    this.send({
      type: 'unsubscribe',
      topic
    });

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Publish a message to a topic
   */
  publish(topic, data, metadata = {}) {
    if (!this.authenticated) {
      throw new Error('Must authenticate before publishing');
    }

    console.log(`\nPublishing to topic: ${topic}`);
    console.log('Data:', JSON.stringify(data, null, 2));

    this.send({
      type: 'message',
      topic,
      data,
      metadata
    });
  }

  /**
   * Send ping to server
   */
  ping() {
    console.log('\n→ Sending ping');
    this.send({
      type: 'ping'
    });
  }

  /**
   * Send a message to the server
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log(`→ Sent: ${message.type}`);
    } else {
      throw new Error('WebSocket not connected');
    }
  }

  /**
   * Close connection
   */
  close() {
    if (this.ws) {
      console.log('\nClosing connection...');
      this.ws.close(1000, 'Client closing');
    }
  }
}

// Example usage
async function main() {
  // Configuration
  const WS_URL = process.env.WS_URL || 'ws://localhost:3000/ws';
  const JWT_TOKEN = process.env.JWT_TOKEN;

  if (!JWT_TOKEN) {
    console.error('Error: JWT_TOKEN environment variable required');
    console.log('\nTo get a token:');
    console.log('  1. Start the server: npm start');
    console.log('  2. Login via HTTP: POST http://localhost:3000/api/auth/login');
    console.log('  3. Copy the accessToken from response');
    console.log('  4. Run: JWT_TOKEN=<token> node examples/websocket-client.js');
    process.exit(1);
  }

  const client = new UnifiedClient(WS_URL, { token: JWT_TOKEN });

  try {
    // Connect
    await client.connect();

    // Authenticate
    const userId = await client.authenticate();
    console.log(`\n✓ Ready! Authenticated as: ${userId}`);

    // Subscribe to user's personal messages
    await client.subscribe(`messages.user.${userId}`, (message) => {
      console.log('\n🔔 Custom handler called!');
      console.log('Message data:', message.data);
    });

    // Subscribe to all messages
    await client.subscribe('messages.**');

    // Send a ping
    await new Promise(resolve => setTimeout(resolve, 1000));
    client.ping();

    // Publish a test message (optional - requires HTTP API)
    // Uncomment to test:
    // await new Promise(resolve => setTimeout(resolve, 1000));
    // client.publish('messages.channel.test', {
    //   content: 'Hello from WebSocket client!'
    // });

    // Keep connection alive for 30 seconds
    console.log('\n✓ Connection established and subscribed');
    console.log('Listening for messages for 30 seconds...');
    console.log('(Create messages via HTTP API to see real-time updates)');

    await new Promise(resolve => setTimeout(resolve, 30000));

    // Unsubscribe and close
    await client.unsubscribe(`messages.user.${userId}`);
    await client.unsubscribe('messages.**');

    client.close();

    console.log('\n✓ Example completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    client.close();
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, closing...');
  process.exit(0);
});

// Run example
if (require.main === module) {
  main();
}

module.exports = UnifiedClient;
