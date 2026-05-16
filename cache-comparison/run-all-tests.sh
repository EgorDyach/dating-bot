#!/bin/bash

set -e

DURATION=${1:-30}
CONCURRENCY=${2:-10}
BASE_URL=${3:-http://localhost:3000}

echo "═════════════════════════════════════════════"
echo "  Cache Comparison - Full Test Suite"
echo "═════════════════════════════════════════════"
echo ""
echo "Configuration:"
echo "  Duration: ${DURATION}s"
echo "  Concurrency: ${CONCURRENCY}"
echo "  Base URL: ${BASE_URL}"
echo ""

# Check if application is running
echo "🔍 Checking if application is running..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "❌ Application is not responding at $BASE_URL"
    echo "Start the application with: npm run start:dev"
    exit 1
fi
echo "✅ Application is running"
echo ""

# Create results directory
mkdir -p results

# Test configurations
STRATEGIES=("lazy" "write-through" "write-back")
MODES=("read-heavy" "balanced" "write-heavy")

# Run all combinations
TEST_COUNT=0
for strategy in "${STRATEGIES[@]}"; do
    for mode in "${MODES[@]}"; do
        TEST_COUNT=$((TEST_COUNT + 1))
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Test $TEST_COUNT/9: $strategy - $mode"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Run load generator
        cd "$(dirname "$0")/load-generator"
        npx tsx index.ts \
            --strategy "$strategy" \
            --mode "$mode" \
            --duration "$DURATION" \
            --concurrency "$CONCURRENCY" \
            --baseUrl "$BASE_URL"

        cd - > /dev/null

        # Wait between tests
        if [ $TEST_COUNT -lt 9 ]; then
            echo ""
            echo "⏳ Waiting 5 seconds before next test..."
            sleep 5
        fi
    done
done

echo ""
echo "═════════════════════════════════════════════"
echo "✅ All tests completed!"
echo "═════════════════════════════════════════════"
echo ""
echo "Results saved to: results/"
echo ""
echo "To view results:"
echo "  ls -la results/"
echo ""
