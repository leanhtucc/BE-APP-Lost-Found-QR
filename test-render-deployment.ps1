# Render.com Deployment Test Script (PowerShell)
# Usage: .\test-render-deployment.ps1 -ApiUrl "https://your-app.onrender.com"

param(
    [string]$ApiUrl = "http://localhost:3000"
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Testing API at: $ApiUrl" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "📊 Test 1: Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/health" -Method Get -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health check passed" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: API Routes
Write-Host "🔗 Test 2: API Routes" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api" -Method Get -UseBasicParsing
    Write-Host "✅ API routes accessible (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) {
        Write-Host "✅ API endpoint responding (404 is expected)" -ForegroundColor Green
    } else {
        Write-Host "❌ API routes failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: User Registration
Write-Host "👤 Test 3: User Registration" -ForegroundColor Yellow
try {
    $timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
    $body = @{
        email = "test$timestamp@example.com"
        password = "TestPass123"
        name = "Test User"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$ApiUrl/api/auth/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body `
        -UseBasicParsing

    Write-Host "✅ Registration endpoint working" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Registration failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Gray
    }
}
Write-Host ""

# Test 4: Login
Write-Host "🔐 Test 4: User Login" -ForegroundColor Yellow
try {
    $body = @{
        email = "test@example.com"
        password = "Test123456"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$ApiUrl/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body `
        -UseBasicParsing

    Write-Host "✅ Login endpoint working" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️ Login response (expected if user doesn't exist)" -ForegroundColor Yellow
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Gray
    }
}
Write-Host ""

# Test 5: Protected Route
Write-Host "🔒 Test 5: Protected Route (No Auth)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api/items" -Method Get -UseBasicParsing
    Write-Host "⚠️ Protected route returned 200 (might be public)" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✅ Auth middleware working (401 Unauthorized)" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}
Write-Host ""

# Test 6: CORS Headers
Write-Host "🌐 Test 6: CORS Configuration" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/api" -Method Options -UseBasicParsing
    $corsHeader = $response.Headers['Access-Control-Allow-Origin']
    if ($corsHeader) {
        Write-Host "✅ CORS headers present: $corsHeader" -ForegroundColor Green
    } else {
        Write-Host "⚠️ CORS headers not found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Could not check CORS headers" -ForegroundColor Yellow
}
Write-Host ""

# Test 7: Response Time
Write-Host "⚡ Test 7: Response Time" -ForegroundColor Yellow
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/health" -Method Get -UseBasicParsing
    $stopwatch.Stop()
    $elapsed = $stopwatch.Elapsed.TotalSeconds
    Write-Host "Response time: $($elapsed)s"

    if ($elapsed -lt 2.0) {
        Write-Host "✅ Response time good (<2s)" -ForegroundColor Green
    } elseif ($elapsed -lt 5.0) {
        Write-Host "⚠️ Response time acceptable (2-5s)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Response time slow (>5s) - Cold start?" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Response time test failed" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "🎯 Test Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check Render logs if any test failed"
Write-Host "2. Verify environment variables in Render dashboard"
Write-Host "3. Test email sending manually"
Write-Host "4. Test Google OAuth flow"
Write-Host "5. Test Stream Chat integration"
Write-Host ""
Write-Host "For detailed logs, visit:"
Write-Host "https://dashboard.render.com" -ForegroundColor Blue
Write-Host ""
