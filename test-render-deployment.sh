#!/bin/bash

# Render.com Deployment Test Script
# Usage: ./test-render-deployment.sh https://your-app.onrender.com

API_URL="${1:-http://localhost:3000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "Testing API at: $API_URL"
echo "=================================="
echo ""

# Test 1: Health Check
echo "📊 Test 1: Health Check"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed (Status: $HEALTH)${NC}"
fi
echo ""

# Test 2: API Prefix
echo "🔗 Test 2: API Routes"
ROUTES=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api")
if [ "$ROUTES" = "200" ] || [ "$ROUTES" = "404" ]; then
    echo -e "${GREEN}✅ API routes accessible${NC}"
else
    echo -e "${RED}❌ API routes failed (Status: $ROUTES)${NC}"
fi
echo ""

# Test 3: Register New User
echo "👤 Test 3: User Registration"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test'$(date +%s)'@example.com",
    "password": "TestPass123",
    "name": "Test User"
  }')

if echo "$REGISTER_RESPONSE" | grep -q "email"; then
    echo -e "${GREEN}✅ Registration endpoint working${NC}"
    echo "Response: $REGISTER_RESPONSE"
else
    echo -e "${RED}❌ Registration failed${NC}"
    echo "Response: $REGISTER_RESPONSE"
fi
echo ""

# Test 4: Login
echo "🔐 Test 4: User Login"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }')

if echo "$LOGIN_RESPONSE" | grep -q "token\|error"; then
    echo -e "${GREEN}✅ Login endpoint working${NC}"
    echo "Response: $LOGIN_RESPONSE"
else
    echo -e "${YELLOW}⚠️  Login response unexpected${NC}"
    echo "Response: $LOGIN_RESPONSE"
fi
echo ""

# Test 5: Protected Route (should fail without token)
echo "🔒 Test 5: Protected Route (No Auth)"
PROTECTED=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/items")
if [ "$PROTECTED" = "401" ]; then
    echo -e "${GREEN}✅ Auth middleware working (401 Unauthorized)${NC}"
elif [ "$PROTECTED" = "200" ]; then
    echo -e "${YELLOW}⚠️  Protected route returned 200 (might be public)${NC}"
else
    echo -e "${RED}❌ Unexpected status: $PROTECTED${NC}"
fi
echo ""

# Test 6: CORS Headers
echo "🌐 Test 6: CORS Configuration"
CORS=$(curl -s -I "$API_URL/api" | grep -i "access-control-allow-origin")
if [ -n "$CORS" ]; then
    echo -e "${GREEN}✅ CORS headers present${NC}"
    echo "$CORS"
else
    echo -e "${YELLOW}⚠️  CORS headers not found${NC}"
fi
echo ""

# Test 7: Response Time
echo "⚡ Test 7: Response Time"
TIME=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL/health")
echo "Response time: ${TIME}s"
if (( $(echo "$TIME < 2.0" | bc -l) )); then
    echo -e "${GREEN}✅ Response time good (<2s)${NC}"
elif (( $(echo "$TIME < 5.0" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Response time acceptable (2-5s)${NC}"
else
    echo -e "${RED}❌ Response time slow (>5s) - Cold start?${NC}"
fi
echo ""

# Test 8: Database Connection
echo "💾 Test 8: Database Connection"
# Try to register a user - if successful, DB is working
DB_TEST=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dbtest'$(date +%s)'@example.com",
    "password": "TestPass123",
    "name": "DB Test"
  }' | grep -o "email\|error\|Database")

if echo "$DB_TEST" | grep -q "email"; then
    echo -e "${GREEN}✅ Database connection working${NC}"
elif echo "$DB_TEST" | grep -qi "database\|connection"; then
    echo -e "${RED}❌ Database connection error${NC}"
    echo "$DB_TEST"
else
    echo -e "${YELLOW}⚠️  Database test inconclusive${NC}"
fi
echo ""

# Summary
echo "=================================="
echo "🎯 Test Summary"
echo "=================================="
echo "API URL: $API_URL"
echo ""
echo "Next steps:"
echo "1. Check Render logs if any test failed"
echo "2. Verify environment variables in Render dashboard"
echo "3. Test email sending manually"
echo "4. Test Google OAuth flow"
echo "5. Test Stream Chat integration"
echo ""
echo "For detailed logs, visit:"
echo "https://dashboard.render.com"
echo ""
