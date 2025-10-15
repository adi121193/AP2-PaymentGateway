#!/bin/bash
# Cashfree API Connectivity Test Script
# Tests API credentials and S2S flag status for sandbox environment
# Part of Phase C1: Cashfree Integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}  Cashfree API Connectivity Test${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}ERROR: .env file not found at $ENV_FILE${NC}"
    echo "Please create .env file with Cashfree credentials"
    exit 1
fi

# Source environment variables
source "$ENV_FILE"

# Validate required variables
if [ -z "$CASHFREE_APP_ID" ] || [ -z "$CASHFREE_SECRET_KEY" ] || [ -z "$CASHFREE_API_URL" ] || [ -z "$CASHFREE_API_VERSION" ]; then
    echo -e "${RED}ERROR: Missing required Cashfree environment variables${NC}"
    echo "Required: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_API_URL, CASHFREE_API_VERSION"
    exit 1
fi

echo -e "${BLUE}Configuration:${NC}"
echo "  App ID:      ${CASHFREE_APP_ID}"
echo "  Environment: ${CASHFREE_ENV:-sandbox}"
echo "  API URL:     ${CASHFREE_API_URL}"
echo "  API Version: ${CASHFREE_API_VERSION}"
echo ""

# Create temp files for response
RESPONSE_BODY=$(mktemp)
RESPONSE_HEADERS=$(mktemp)

# Cleanup on exit
trap "rm -f $RESPONSE_BODY $RESPONSE_HEADERS" EXIT

echo -e "${BLUE}Test 1: POST /orders (Create Test Order)${NC}"
echo "Testing API connectivity and authentication with order creation..."
echo ""

# Generate unique order ID
ORDER_ID="test_$(date +%s)"

# Make API request
HTTP_STATUS=$(curl -s -w "%{http_code}" -o "$RESPONSE_BODY" \
    -X POST "${CASHFREE_API_URL}/orders" \
    -H "x-client-id: ${CASHFREE_APP_ID}" \
    -H "x-client-secret: ${CASHFREE_SECRET_KEY}" \
    -H "x-api-version: ${CASHFREE_API_VERSION}" \
    -H "Content-Type: application/json" \
    -D "$RESPONSE_HEADERS" \
    -d "{
        \"order_id\": \"${ORDER_ID}\",
        \"order_amount\": 10.00,
        \"order_currency\": \"INR\",
        \"customer_details\": {
            \"customer_id\": \"test_customer_001\",
            \"customer_phone\": \"9999999999\"
        }
    }")

echo "HTTP Status: $HTTP_STATUS"
echo ""
echo -e "${BLUE}Response Headers:${NC}"
cat "$RESPONSE_HEADERS" | grep -E "^(HTTP|content-|x-|cf-)"
echo ""
echo -e "${BLUE}Response Body:${NC}"
cat "$RESPONSE_BODY" | jq '.' 2>/dev/null || cat "$RESPONSE_BODY"
echo ""
echo ""

# Analyze response
S2S_STATUS="UNKNOWN"
OVERALL_STATUS="UNKNOWN"
RECOMMENDATION=""

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    echo -e "${GREEN}✅ SUCCESS: API credentials are valid${NC}"
    echo -e "${GREEN}✅ SUCCESS: Order creation works${NC}"

    # Check if payment_session_id exists in response
    if cat "$RESPONSE_BODY" | jq -e '.payment_session_id' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ SUCCESS: Payment session generated${NC}"
        S2S_STATUS="ENABLED"
        OVERALL_STATUS="READY"
        RECOMMENDATION="Cashfree API is fully operational. You can proceed with integration immediately."
    else
        S2S_STATUS="PARTIAL"
        OVERALL_STATUS="READY"
        RECOMMENDATION="Basic order creation works. You can proceed with integration."
    fi

elif [ "$HTTP_STATUS" = "403" ]; then
    RESPONSE_TEXT=$(cat "$RESPONSE_BODY")
    if echo "$RESPONSE_TEXT" | grep -qi "s2s\|server"; then
        echo -e "${YELLOW}⚠️  WARNING: S2S flag is NOT enabled${NC}"
        echo -e "${GREEN}✅ SUCCESS: API credentials are valid${NC}"
        S2S_STATUS="DISABLED"
        OVERALL_STATUS="WAITING"
        RECOMMENDATION="Credentials are valid, but S2S flag is not enabled yet. Contact care@cashfree.com or wait for approval."
    else
        echo -e "${RED}❌ ERROR: Access forbidden${NC}"
        OVERALL_STATUS="BLOCKED"
        RECOMMENDATION="Access forbidden. Check credentials or contact Cashfree support."
    fi

elif [ "$HTTP_STATUS" = "422" ]; then
    echo -e "${YELLOW}⚠️  Validation error (credentials may be valid)${NC}"
    echo -e "${GREEN}✅ SUCCESS: API is reachable${NC}"
    OVERALL_STATUS="PARTIAL"
    S2S_STATUS="UNKNOWN"
    RECOMMENDATION="API is reachable but validation failed. Review error message and adjust test payload."

elif [ "$HTTP_STATUS" = "401" ]; then
    echo -e "${RED}❌ ERROR: Authentication failed${NC}"
    echo -e "${RED}Credentials are invalid or expired${NC}"
    OVERALL_STATUS="BLOCKED"
    RECOMMENDATION="Authentication failed. Verify APP_ID and SECRET_KEY in .env file."

elif [ "$HTTP_STATUS" = "000" ]; then
    echo -e "${RED}❌ ERROR: Network connection failed${NC}"
    echo -e "${RED}Could not reach Cashfree API${NC}"
    OVERALL_STATUS="BLOCKED"
    RECOMMENDATION="Network error. Check internet connection and API URL."

else
    echo -e "${RED}❌ ERROR: Unexpected HTTP status code${NC}"
    OVERALL_STATUS="BLOCKED"
    RECOMMENDATION="Unexpected response. Review error message above."
fi

echo ""
echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo "Overall Status:  $([ "$OVERALL_STATUS" = "READY" ] && echo -e "${GREEN}$OVERALL_STATUS${NC}" || [ "$OVERALL_STATUS" = "WAITING" ] && echo -e "${YELLOW}$OVERALL_STATUS${NC}" || echo -e "${RED}$OVERALL_STATUS${NC}")"
echo "HTTP Status:     $HTTP_STATUS"
echo "S2S Flag:        $([ "$S2S_STATUS" = "ENABLED" ] && echo -e "${GREEN}$S2S_STATUS${NC}" || [ "$S2S_STATUS" = "DISABLED" ] && echo -e "${YELLOW}$S2S_STATUS${NC}" || echo "$S2S_STATUS")"
echo ""
echo -e "${BLUE}Recommendation:${NC}"
echo "$RECOMMENDATION"
echo ""

# Extract key information from response
if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    echo ""
    echo -e "${BLUE}==================================================${NC}"
    echo -e "${BLUE}  Response Details${NC}"
    echo -e "${BLUE}==================================================${NC}"
    echo ""

    CF_ORDER_ID=$(cat "$RESPONSE_BODY" | jq -r '.cf_order_id // "N/A"')
    ORDER_STATUS=$(cat "$RESPONSE_BODY" | jq -r '.order_status // "N/A"')
    PAYMENT_SESSION_ID=$(cat "$RESPONSE_BODY" | jq -r '.payment_session_id // "N/A"')
    ORDER_CREATED_AT=$(cat "$RESPONSE_BODY" | jq -r '.created_at // "N/A"')

    echo "Cashfree Order ID:  $CF_ORDER_ID"
    echo "Order Status:       $ORDER_STATUS"
    echo "Created At:         $ORDER_CREATED_AT"
    echo "Payment Session ID: ${PAYMENT_SESSION_ID:0:40}..."
    echo ""
fi

# Exit code based on overall status
if [ "$OVERALL_STATUS" = "READY" ]; then
    exit 0
elif [ "$OVERALL_STATUS" = "WAITING" ]; then
    exit 0  # Not an error, just waiting
else
    exit 1
fi
