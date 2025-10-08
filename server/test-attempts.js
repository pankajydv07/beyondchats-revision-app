/**
 * Test script for quiz attempts API endpoints
 * Run with: node test-attempts.js
 */

const BASE_URL = 'http://localhost:5000'

// Test data
const testUserId = '550e8400-e29b-41d4-a716-446655440000' // Example UUID
const testAttempt = {
  user_id: testUserId,
  pdf_id: null,
  topic: 'JavaScript Fundamentals',
  questions: [
    {
      id: 1,
      question: 'What is a closure in JavaScript?',
      type: 'multiple_choice',
      options: ['A function', 'A variable', 'A scope concept', 'An object'],
      correct: 2
    },
    {
      id: 2,
      question: 'What does "this" refer to in JavaScript?',
      type: 'multiple_choice',
      options: ['The current object', 'The global object', 'Depends on context', 'The function'],
      correct: 2
    }
  ],
  answers: [
    { question_id: 1, answer: 2, correct: true },
    { question_id: 2, answer: 1, correct: false }
  ],
  score: 0.5,
  total_questions: 2,
  correct_answers: 1,
  time_taken: 120
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
    
    const data = await response.json()
    return { response, data }
  } catch (error) {
    console.error('Request failed:', error)
    return { error }
  }
}

async function testAPI() {
  console.log('🧪 Testing Quiz Attempts API\n')

  // Test 1: Create a quiz attempt
  console.log('1️⃣ Testing POST /api/attempts (Create attempt)')
  const { response: createResponse, data: createData } = await makeRequest(
    `${BASE_URL}/api/attempts`,
    {
      method: 'POST',
      body: JSON.stringify(testAttempt)
    }
  )

  if (createResponse?.ok) {
    console.log('✅ Create attempt successful')
    console.log('Response:', JSON.stringify(createData, null, 2))
  } else {
    console.log('❌ Create attempt failed')
    console.log('Status:', createResponse?.status)
    console.log('Response:', JSON.stringify(createData, null, 2))
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 2: Get all attempts for user
  console.log('2️⃣ Testing GET /api/attempts (List attempts)')
  const { response: listResponse, data: listData } = await makeRequest(
    `${BASE_URL}/api/attempts?userId=${testUserId}`
  )

  if (listResponse?.ok) {
    console.log('✅ List attempts successful')
    console.log('Found attempts:', listData.attempts?.length || 0)
    console.log('Response:', JSON.stringify(listData, null, 2))
  } else {
    console.log('❌ List attempts failed')
    console.log('Status:', listResponse?.status)
    console.log('Response:', JSON.stringify(listData, null, 2))
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 3: Get specific attempt (if we created one)
  if (createData?.attempt?.id) {
    console.log('3️⃣ Testing GET /api/attempts/:id (Get specific attempt)')
    const { response: getResponse, data: getData } = await makeRequest(
      `${BASE_URL}/api/attempts/${createData.attempt.id}`
    )

    if (getResponse?.ok) {
      console.log('✅ Get specific attempt successful')
      console.log('Response:', JSON.stringify(getData, null, 2))
    } else {
      console.log('❌ Get specific attempt failed')
      console.log('Status:', getResponse?.status)
      console.log('Response:', JSON.stringify(getData, null, 2))
    }

    console.log('\n' + '='.repeat(50) + '\n')
  }

  // Test 4: Error handling - Invalid user ID
  console.log('4️⃣ Testing error handling (Invalid user ID)')
  const { response: errorResponse, data: errorData } = await makeRequest(
    `${BASE_URL}/api/attempts?userId=invalid-uuid`
  )

  if (errorResponse?.status === 400) {
    console.log('✅ Error handling working correctly')
    console.log('Response:', JSON.stringify(errorData, null, 2))
  } else {
    console.log('❌ Error handling not working as expected')
    console.log('Status:', errorResponse?.status)
    console.log('Response:', JSON.stringify(errorData, null, 2))
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 5: Missing required fields
  console.log('5️⃣ Testing validation (Missing required fields)')
  const invalidAttempt = {
    user_id: testUserId,
    // Missing topic, questions, answers, score
  }

  const { response: validationResponse, data: validationData } = await makeRequest(
    `${BASE_URL}/api/attempts`,
    {
      method: 'POST',
      body: JSON.stringify(invalidAttempt)
    }
  )

  if (validationResponse?.status === 400) {
    console.log('✅ Validation working correctly')
    console.log('Response:', JSON.stringify(validationData, null, 2))
  } else {
    console.log('❌ Validation not working as expected')
    console.log('Status:', validationResponse?.status)
    console.log('Response:', JSON.stringify(validationData, null, 2))
  }

  console.log('\n🏁 Testing complete!')
}

// Check if server is running
async function checkServer() {
  try {
    const { response } = await makeRequest(`${BASE_URL}/api/health`)
    if (response?.ok) {
      console.log('✅ Server is running\n')
      return true
    }
  } catch (error) {
    console.log('❌ Server is not running. Please start the server with: npm start')
    console.log('Error:', error.message)
    return false
  }
}

// Main execution
async function main() {
  const isServerRunning = await checkServer()
  if (isServerRunning) {
    await testAPI()
  }
}

main().catch(console.error)