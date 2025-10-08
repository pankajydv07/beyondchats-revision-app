#!/usr/bin/env node

// Test script for /api/users endpoints
// Run this with: node test-users-api.js
// Make sure the server is running first

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

// Test data
const testUser = {
  email: 'test@example.com',
  full_name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg'
};

let createdUserId = null;

async function testUsersAPI() {
  console.log('🧪 Testing /api/users endpoints...\n');

  try {
    // Test 1: Create user (POST /api/users)
    console.log('1️⃣ Testing POST /api/users');
    const createResponse = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });

    const createResult = await createResponse.json();
    console.log('Status:', createResponse.status);
    console.log('Response:', createResult);

    if (createResponse.ok && createResult.user) {
      createdUserId = createResult.user.id;
      console.log('✅ User created successfully with ID:', createdUserId);
    } else {
      console.log('❌ Failed to create user');
      return;
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: Get user (GET /api/users/:id)
    console.log('2️⃣ Testing GET /api/users/:id');
    const getResponse = await fetch(`${API_BASE}/users/${createdUserId}`);
    const getResult = await getResponse.json();

    console.log('Status:', getResponse.status);
    console.log('Response:', getResult);

    if (getResponse.ok) {
      console.log('✅ User fetched successfully');
    } else {
      console.log('❌ Failed to fetch user');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 3: Update user (PUT /api/users/:id)
    console.log('3️⃣ Testing PUT /api/users/:id');
    const updateData = {
      full_name: 'Updated Test User',
      avatar_url: 'https://example.com/new-avatar.jpg'
    };

    const updateResponse = await fetch(`${API_BASE}/users/${createdUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const updateResult = await updateResponse.json();
    console.log('Status:', updateResponse.status);
    console.log('Response:', updateResult);

    if (updateResponse.ok) {
      console.log('✅ User updated successfully');
    } else {
      console.log('❌ Failed to update user');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 4: Test upsert (create same email again)
    console.log('4️⃣ Testing upsert functionality (POST same email)');
    const upsertData = {
      email: testUser.email,
      full_name: 'Upserted User Name'
    };

    const upsertResponse = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upsertData),
    });

    const upsertResult = await upsertResponse.json();
    console.log('Status:', upsertResponse.status);
    console.log('Response:', upsertResult);

    if (upsertResponse.ok) {
      console.log('✅ Upsert worked successfully');
    } else {
      console.log('❌ Upsert failed');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 5: Error cases
    console.log('5️⃣ Testing error cases');
    
    // Invalid email
    const invalidEmailResponse = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'invalid-email' }),
    });
    console.log('Invalid email status:', invalidEmailResponse.status);
    
    // Missing email
    const missingEmailResponse = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ full_name: 'No Email User' }),
    });
    console.log('Missing email status:', missingEmailResponse.status);

    // Invalid UUID
    const invalidUuidResponse = await fetch(`${API_BASE}/users/invalid-uuid`);
    console.log('Invalid UUID status:', invalidUuidResponse.status);

    // Non-existent user
    const nonExistentResponse = await fetch(`${API_BASE}/users/00000000-0000-0000-0000-000000000000`);
    console.log('Non-existent user status:', nonExistentResponse.status);

    console.log('✅ Error cases tested');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }

  console.log('\n🎉 All tests completed!');
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      console.log('✅ Server is running, starting tests...\n');
      await testUsersAPI();
    } else {
      console.log('❌ Server health check failed');
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Make sure it\'s running on port 5000');
    console.log('Start the server with: npm run dev');
  }
}

checkServer();