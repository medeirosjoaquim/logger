#!/bin/bash

# Pre-publish verification script
# Run this before publishing to npm

set -e

echo "🔍 Universal Logger - Pre-Publish Verification"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Check 1: README.md exists
echo -n "✓ Checking README.md... "
if [ -f "README.md" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "  → README.md is missing!"
    ERRORS=$((ERRORS + 1))
fi

# Check 2: LICENSE exists
echo -n "✓ Checking LICENSE... "
if [ -f "LICENSE" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "  → LICENSE file is missing!"
    ERRORS=$((ERRORS + 1))
fi

# Check 3: CHANGELOG.md exists
echo -n "✓ Checking CHANGELOG.md... "
if [ -f "CHANGELOG.md" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${YELLOW}WARN${NC}"
    echo "  → CHANGELOG.md is missing (recommended)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 4: Repository URL is not placeholder
echo -n "✓ Checking repository URL... "
if grep -q "github.com/asari/logger" package.json; then
    echo -e "${RED}FAIL${NC}"
    echo "  → Repository URL is still a placeholder!"
    echo "  → Update URLs in package.json before publishing"
    echo "  → See REPOSITORY_URL_UPDATE.md for instructions"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}PASS${NC}"
fi

# Check 5: Build exists
echo -n "✓ Checking dist/ folder... "
if [ -d "dist" ] && [ -f "dist/index.js" ] && [ -f "dist/index.d.ts" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "  → dist/ folder missing or incomplete"
    echo "  → Run: npm run build"
    ERRORS=$((ERRORS + 1))
fi

# Check 6: TypeScript compilation
echo -n "✓ Running TypeScript check... "
if npm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "  → TypeScript errors found"
    echo "  → Run: npm run typecheck"
    ERRORS=$((ERRORS + 1))
fi

# Check 7: Tests
echo -n "✓ Running tests... "
if npm run test:run > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "  → Tests failing"
    echo "  → Run: npm test"
    ERRORS=$((ERRORS + 1))
fi

# Check 8: Package size
echo -n "✓ Checking package size... "
SIZE=$(du -sh dist/ | cut -f1)
echo -e "${GREEN}$SIZE${NC}"

# Check 9: npm whoami
echo -n "✓ Checking npm authentication... "
if npm whoami > /dev/null 2>&1; then
    NPM_USER=$(npm whoami)
    echo -e "${GREEN}Logged in as: $NPM_USER${NC}"
else
    echo -e "${YELLOW}WARN${NC}"
    echo "  → Not logged in to npm"
    echo "  → Run: npm login"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 10: Package contents preview
echo ""
echo "📦 Package contents preview:"
echo "----------------------------"
npm pack --dry-run 2>&1 | grep "npm notice" | head -20

echo ""
echo "=============================================="
echo "Summary:"
echo "  Errors: $ERRORS"
echo "  Warnings: $WARNINGS"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ Pre-publish checks FAILED${NC}"
    echo "   Fix the errors above before publishing"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Pre-publish checks passed with warnings${NC}"
    echo "   Consider addressing warnings before publishing"
    exit 0
else
    echo -e "${GREEN}✅ All pre-publish checks PASSED${NC}"
    echo ""
    echo "Ready to publish! Run:"
    echo "  npm publish --access public"
    exit 0
fi
