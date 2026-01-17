# Render Environment Variables Generator
# This script helps you prepare environment variables for Render.com
# Usage: .\generate-render-env.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Render.com Environment Setup Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to generate random secret
function Generate-Secret {
    param([int]$Length = 32)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-="
    $secret = -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return $secret
}

# Generate JWT secrets
$jwtSecret = Generate-Secret -Length 40
$jwtRefreshSecret = Generate-Secret -Length 40

Write-Host "🔑 Generated JWT Secrets:" -ForegroundColor Green
Write-Host "JWT_SECRET=$jwtSecret" -ForegroundColor Yellow
Write-Host "JWT_REFRESH_SECRET=$jwtRefreshSecret" -ForegroundColor Yellow
Write-Host ""

# Collect user inputs
Write-Host "📝 Please provide the following information:" -ForegroundColor Cyan
Write-Host ""

$databaseUrl = Read-Host "Database URL (from Render PostgreSQL service)"
$appName = Read-Host "Your app name on Render (e.g., my-backend-api)"
$appUrl = "https://$appName.onrender.com"

Write-Host ""
Write-Host "📧 Email (SMTP) Configuration:" -ForegroundColor Cyan
$smtpUser = Read-Host "Gmail address"
$smtpPass = Read-Host "Gmail App Password (16 characters)" -AsSecureString
$smtpPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($smtpPass))
$smtpFromEmail = Read-Host "From Email (e.g., noreply@yourdomain.com)"
$smtpFromName = Read-Host "From Name (e.g., My App Team)"

Write-Host ""
Write-Host "💬 Stream Chat Configuration:" -ForegroundColor Cyan
$streamKey = Read-Host "Stream API Key"
$streamSecret = Read-Host "Stream API Secret" -AsSecureString
$streamSecretPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($streamSecret))

Write-Host ""
$useGoogleAuth = Read-Host "Use Google OAuth? (y/n)"

if ($useGoogleAuth -eq "y") {
    Write-Host ""
    Write-Host "🔐 Google OAuth Configuration:" -ForegroundColor Cyan
    $googleClientId = Read-Host "Google Client ID"
    $googleClientSecret = Read-Host "Google Client Secret" -AsSecureString
    $googleClientSecretPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($googleClientSecret))
}

# Generate output
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  📋 Copy these to Render Dashboard" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$envVars = @"
NODE_ENV=production
PORT=3000
API_PREFIX=/api
DATABASE_URL=$databaseUrl
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=$jwtRefreshSecret
JWT_REFRESH_EXPIRES_IN=30d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=$smtpUser
SMTP_PASS=$smtpPassPlain
SMTP_FROM_EMAIL=$smtpFromEmail
SMTP_FROM_NAME=$smtpFromName
SKIP_EMAIL_VERIFICATION=false
STREAM_API_KEY=$streamKey
STREAM_API_SECRET=$streamSecretPlain
APP_BASE_URL=$appUrl
"@

if ($useGoogleAuth -eq "y") {
    $envVars += @"

GOOGLE_CLIENT_ID=$googleClientId
GOOGLE_CLIENT_SECRET=$googleClientSecretPlain
GOOGLE_CALLBACK_URL=$appUrl/api/auth/google/callback
"@
}

# Display
Write-Host $envVars -ForegroundColor Yellow
Write-Host ""

# Save to file
$outputFile = ".env.render.generated"
$envVars | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "✅ Saved to file: $outputFile" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  📝 Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open file: $outputFile"
Write-Host "2. Go to Render Dashboard → Your Web Service → Environment"
Write-Host "3. Click 'Add Environment Variable'"
Write-Host "4. Copy each line (format: KEY=VALUE)"
Write-Host "5. Click 'Save Changes'"
Write-Host ""
Write-Host "Or use the Render API to bulk import (advanced):"
Write-Host "https://render.com/docs/api#environment-variables"
Write-Host ""
Write-Host "⚠️  IMPORTANT: Delete $outputFile after copying!" -ForegroundColor Red
Write-Host "   It contains sensitive credentials!" -ForegroundColor Red
Write-Host ""
