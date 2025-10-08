# Test script for /api/users endpoints using PowerShell
# Make sure the server is running first with: npm run dev

$API_BASE = "http://localhost:5000/api"
Write-Host "🧪 Testing /api/users endpoints..." -ForegroundColor Green
Write-Host ""

# Test 1: Health check
Write-Host "0️⃣ Checking server health..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$API_BASE/health" -Method Get
    Write-Host "Health check: $($healthResponse | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is not running. Start it with: npm run dev" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=".PadRight(50, "=")
Write-Host ""

# Test 2: Create user (POST /api/users)
Write-Host "1️⃣ Testing POST /api/users" -ForegroundColor Yellow
$createUserData = @{
    email = "test@example.com"
    full_name = "Test User"
    avatar_url = "https://example.com/avatar.jpg"
} | ConvertTo-Json

try {
    $createResponse = Invoke-RestMethod -Uri "$API_BASE/users" -Method Post -Body $createUserData -ContentType "application/json"
    Write-Host "Create user response: $($createResponse | ConvertTo-Json)" -ForegroundColor Green
    $userId = $createResponse.user.id
    Write-Host "✅ User created with ID: $userId" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create user: $($_.Exception.Message)" -ForegroundColor Red
    $userId = $null
}

Write-Host ""
Write-Host "=".PadRight(50, "=")
Write-Host ""

if ($userId) {
    # Test 3: Get user (GET /api/users/:id)
    Write-Host "2️⃣ Testing GET /api/users/$userId" -ForegroundColor Yellow
    try {
        $getResponse = Invoke-RestMethod -Uri "$API_BASE/users/$userId" -Method Get
        Write-Host "Get user response: $($getResponse | ConvertTo-Json)" -ForegroundColor Green
        Write-Host "✅ User fetched successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to get user: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "=".PadRight(50, "=")
    Write-Host ""

    # Test 4: Update user (PUT /api/users/:id)
    Write-Host "3️⃣ Testing PUT /api/users/$userId" -ForegroundColor Yellow
    $updateUserData = @{
        full_name = "Updated Test User"
        avatar_url = "https://example.com/new-avatar.jpg"
    } | ConvertTo-Json

    try {
        $updateResponse = Invoke-RestMethod -Uri "$API_BASE/users/$userId" -Method Put -Body $updateUserData -ContentType "application/json"
        Write-Host "Update user response: $($updateResponse | ConvertTo-Json)" -ForegroundColor Green
        Write-Host "✅ User updated successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to update user: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "=".PadRight(50, "=")
    Write-Host ""
}

# Test 5: Test upsert
Write-Host "4️⃣ Testing upsert (POST same email again)" -ForegroundColor Yellow
$upsertUserData = @{
    email = "test@example.com"
    full_name = "Upserted User Name"
} | ConvertTo-Json

try {
    $upsertResponse = Invoke-RestMethod -Uri "$API_BASE/users" -Method Post -Body $upsertUserData -ContentType "application/json"
    Write-Host "Upsert response: $($upsertResponse | ConvertTo-Json)" -ForegroundColor Green
    Write-Host "✅ Upsert worked successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Upsert failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=".PadRight(50, "=")
Write-Host ""

# Test 6: Error cases
Write-Host "5️⃣ Testing error cases" -ForegroundColor Yellow

# Invalid email
Write-Host "Testing invalid email..."
$invalidEmailData = @{ email = "invalid-email" } | ConvertTo-Json
try {
    $invalidResponse = Invoke-RestMethod -Uri "$API_BASE/users" -Method Post -Body $invalidEmailData -ContentType "application/json"
    Write-Host "Unexpected success: $($invalidResponse | ConvertTo-Json)" -ForegroundColor Red
} catch {
    Write-Host "✅ Correctly rejected invalid email: $($_.Exception.Response.StatusCode)" -ForegroundColor Green
}

# Missing email
Write-Host "Testing missing email..."
$missingEmailData = @{ full_name = "No Email User" } | ConvertTo-Json
try {
    $missingResponse = Invoke-RestMethod -Uri "$API_BASE/users" -Method Post -Body $missingEmailData -ContentType "application/json"
    Write-Host "Unexpected success: $($missingResponse | ConvertTo-Json)" -ForegroundColor Red
} catch {
    Write-Host "✅ Correctly rejected missing email: $($_.Exception.Response.StatusCode)" -ForegroundColor Green
}

# Invalid UUID
Write-Host "Testing invalid UUID..."
try {
    $invalidUuidResponse = Invoke-RestMethod -Uri "$API_BASE/users/invalid-uuid" -Method Get
    Write-Host "Unexpected success: $($invalidUuidResponse | ConvertTo-Json)" -ForegroundColor Red
} catch {
    Write-Host "✅ Correctly rejected invalid UUID: $($_.Exception.Response.StatusCode)" -ForegroundColor Green
}

# Non-existent user
Write-Host "Testing non-existent user..."
try {
    $nonExistentResponse = Invoke-RestMethod -Uri "$API_BASE/users/00000000-0000-0000-0000-000000000000" -Method Get
    Write-Host "Unexpected success: $($nonExistentResponse | ConvertTo-Json)" -ForegroundColor Red
} catch {
    Write-Host "✅ Correctly returned 404 for non-existent user: $($_.Exception.Response.StatusCode)" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 All tests completed!" -ForegroundColor Green