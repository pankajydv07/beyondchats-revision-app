#!/bin/bash

# Test script for /api/users endpoints using curl
# Make sure the server is running first with: npm run dev

API_BASE="http://localhost:5000/api"
echo "🧪 Testing /api/users endpoints..."
echo ""

# Test 1: Health check
echo "0️⃣ Checking server health..."
curl -s "$API_BASE/health" | echo "$(cat)"
echo ""
echo "=================================================="
echo ""

# Test 2: Create user (POST /api/users)
echo "1️⃣ Testing POST /api/users"
echo "Creating user with email: test@example.com"

USER_RESPONSE=$(curl -s -X POST "$API_BASE/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "full_name": "Test User",
    "avatar_url": "https://example.com/avatar.jpg"
  }')

echo "Response: $USER_RESPONSE"

# Extract user ID from response (basic parsing)
USER_ID=$(echo "$USER_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Extracted User ID: $USER_ID"
echo ""
echo "=================================================="
echo ""

if [ -n "$USER_ID" ]; then
  # Test 3: Get user (GET /api/users/:id)
  echo "2️⃣ Testing GET /api/users/$USER_ID"
  curl -s "$API_BASE/users/$USER_ID" | echo "$(cat)"
  echo ""
  echo "=================================================="
  echo ""

  # Test 4: Update user (PUT /api/users/:id)
  echo "3️⃣ Testing PUT /api/users/$USER_ID"
  curl -s -X PUT "$API_BASE/users/$USER_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "full_name": "Updated Test User",
      "avatar_url": "https://example.com/new-avatar.jpg"
    }' | echo "$(cat)"
  echo ""
  echo "=================================================="
  echo ""
else
  echo "❌ Could not extract user ID, skipping subsequent tests"
fi

# Test 5: Test upsert
echo "4️⃣ Testing upsert (POST same email again)"
curl -s -X POST "$API_BASE/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "full_name": "Upserted User Name"
  }' | echo "$(cat)"
echo ""
echo "=================================================="
echo ""

# Test 6: Error cases
echo "5️⃣ Testing error cases"

echo "Testing invalid email:"
curl -s -X POST "$API_BASE/users" \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email"}' | echo "$(cat)"
echo ""

echo "Testing missing email:"
curl -s -X POST "$API_BASE/users" \
  -H "Content-Type: application/json" \
  -d '{"full_name": "No Email User"}' | echo "$(cat)"
echo ""

echo "Testing invalid UUID:"
curl -s "$API_BASE/users/invalid-uuid" | echo "$(cat)"
echo ""

echo "Testing non-existent user:"
curl -s "$API_BASE/users/00000000-0000-0000-0000-000000000000" | echo "$(cat)"
echo ""

echo "🎉 All tests completed!"