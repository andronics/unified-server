#!/bin/bash
set -e

echo "=== Testing Complete GraphQL Flow ==="
echo

# 1. Register new user
echo "1. Registering new user..."
REGISTER_RESULT=$(curl -s http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { register(input: {email: \"test-flow@example.com\", name: \"Flow Test\", password: \"Password123!\"}) { user { id email name } token expiresIn } }"}')

TOKEN=$(echo "$REGISTER_RESULT" | jq -r '.data.register.token')
USER_ID=$(echo "$REGISTER_RESULT" | jq -r '.data.register.user.id')

echo "   User ID: $USER_ID"
echo "   Token: ${TOKEN:0:50}..."
echo

# 2. Test 'me' query
echo "2. Testing 'me' query..."
ME_RESULT=$(curl -s http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { me { id email name } }"}')

echo "$ME_RESULT" | jq
echo

# 3. Test updateUser mutation
echo "3. Testing updateUser mutation..."
UPDATE_RESULT=$(curl -s http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"query\":\"mutation { updateUser(id: \\\"$USER_ID\\\", input: {name: \\\"Updated Flow Test\\\"}) { id email name } }\"}")

echo "$UPDATE_RESULT" | jq
echo

# 4. Test messages query
echo "4. Testing messages query..."
MESSAGES_RESULT=$(curl -s http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { messages(page: 1, limit: 5) { edges { node { id content } } pageInfo { page total hasNextPage hasPreviousPage } } }"}')

echo "$MESSAGES_RESULT" | jq
echo

echo "=== Test Complete ==="
