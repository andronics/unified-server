/**
 * GraphQL Schema Definition
 * Layer 4: Application
 *
 * Defines all GraphQL types, queries, mutations, and subscriptions
 */

export const typeDefs = /* GraphQL */ `
  # Custom Scalars
  scalar DateTime

  # Custom Directives
  directive @auth on FIELD_DEFINITION

  # ============================================
  # Core Types
  # ============================================

  type User {
    id: ID!
    email: String!
    name: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Message {
    id: ID!
    userId: ID!
    user: User!
    content: String!
    recipientId: ID
    recipient: User
    channelId: ID
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthResponse {
    user: User!
    token: String!
    expiresIn: String!
  }

  # ============================================
  # Pagination Types (Relay-style Connections)
  # ============================================

  type MessageEdge {
    node: Message!
    cursor: String!
  }

  type PageInfo {
    page: Int!
    limit: Int!
    total: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  type MessageConnection {
    edges: [MessageEdge!]!
    pageInfo: PageInfo!
  }

  # ============================================
  # Input Types
  # ============================================

  input RegisterInput {
    email: String!
    name: String!
    password: String!
  }

  input UpdateUserInput {
    email: String
    name: String
    password: String
  }

  input SendMessageInput {
    content: String!
    recipientId: ID
    channelId: ID
  }

  # ============================================
  # Queries
  # ============================================

  type Query {
    """
    Get a user by ID
    """
    user(id: ID!): User

    """
    Get the currently authenticated user
    Requires authentication
    """
    me: User @auth

    """
    Get a message by ID
    """
    message(id: ID!): Message

    """
    Get all messages with pagination
    """
    messages(page: Int = 1, limit: Int = 20): MessageConnection!

    """
    Get messages sent by a specific user
    """
    userMessages(userId: ID!, page: Int = 1, limit: Int = 20): MessageConnection!

    """
    Get messages in a specific channel
    """
    channelMessages(channelId: ID!, page: Int = 1, limit: Int = 20): MessageConnection!
  }

  # ============================================
  # Mutations
  # ============================================

  type Mutation {
    """
    Register a new user account
    Returns user and authentication token
    """
    register(input: RegisterInput!): AuthResponse!

    """
    Login with email and password
    Returns user and authentication token
    """
    login(email: String!, password: String!): AuthResponse!

    """
    Update user profile
    Operates on the authenticated user
    Requires authentication
    """
    updateUser(input: UpdateUserInput!): User! @auth

    """
    Delete user account
    Deletes the authenticated user's account
    Requires authentication
    """
    deleteUser: Boolean! @auth

    """
    Send a new message
    Can be a direct message (recipientId) or channel message (channelId)
    Requires authentication
    """
    sendMessage(input: SendMessageInput!): Message! @auth

    """
    Delete a message
    Can only delete your own messages
    Requires authentication
    """
    deleteMessage(id: ID!): Boolean! @auth
  }

  # ============================================
  # Subscriptions
  # ============================================

  type Subscription {
    """
    Subscribe to new user registrations
    """
    userCreated: User!

    """
    Subscribe to user profile updates
    Optionally filter by specific userId
    """
    userUpdated(userId: ID): User!

    """
    Subscribe to new messages
    Optionally filter by channelId
    """
    messageSent(channelId: ID): Message!

    """
    Subscribe to direct messages sent to a specific user
    Requires authentication
    """
    messageToUser(userId: ID!): Message! @auth
  }
`;
