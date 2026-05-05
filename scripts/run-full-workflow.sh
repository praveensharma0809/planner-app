#!/bin/bash
cd "/c/Users/Lenono/Desktop/planner-app"

echo "=== STEP 1: GIT STATUS ==="
git --no-pager status --short
echo "---HEAD---"
git rev-parse HEAD

echo ""
echo "=== STEP 2: START DEV SERVER ==="
npm run dev &
DEV_PID=$!
sleep 8

echo ""
echo "=== STEP 3: CAPTURE SCREENSHOTS ==="
node scripts/run-workflow.mjs

echo ""
echo "=== STEP 4: STOP DEV SERVER ==="
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
sleep 2

echo ""
echo "=== STEP 5: FINAL STATUS ==="
git --no-pager status --short
