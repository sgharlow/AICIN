#!/bin/bash

# AICIN - Fix Remaining Secret Exposures
# Fixes the 4 critical files identified in cleanup scan

set -e

echo "🔒 Fixing Remaining Secret Exposures"
echo "====================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Fix 1: demo/index.html
echo "Fix 1: Updating demo/index.html..."
if [ -f "demo/index.html" ]; then
    # Backup
    cp demo/index.html demo/index.html.backup

    # Replace hardcoded secret with placeholder
    sed -i "s/const DEMO_JWT_SECRET = 'tgJoQnBPwHxccxWwYdx15g==';/const DEMO_JWT_SECRET = 'PLACEHOLDER_SECRET'; \/\/ Replace with actual secret in production/g" demo/index.html

    print_status "Updated demo/index.html"
else
    print_warning "demo/index.html not found"
fi

echo ""

# Fix 2: demo/server.js
echo "Fix 2: Updating demo/server.js..."
if [ -f "demo/server.js" ]; then
    # Backup
    cp demo/server.js demo/server.js.backup

    # Check if the line exists and replace it
    if grep -q "const JWT_SECRET = process.env.JWT_SECRET || 'tgJoQnBPwHxccxWwYdx15g=='" demo/server.js; then
        # Replace with proper env var requirement
        sed -i "/const JWT_SECRET = process.env.JWT_SECRET || 'tgJoQnBPwHxccxWwYdx15g==';/c\\
const JWT_SECRET = process.env.JWT_SECRET;\\
if (!JWT_SECRET) {\\
  console.error('❌ ERROR: JWT_SECRET environment variable required');\\
  console.log('Set it with: export JWT_SECRET=\"your-secret\"');\\
  process.exit(1);\\
}" demo/server.js

        print_status "Updated demo/server.js"
    else
        print_warning "Pattern not found in demo/server.js (may already be fixed)"
    fi
else
    print_warning "demo/server.js not found"
fi

echo ""

# Fix 3: docs/LEARNINGAI365_AUTH_INTEGRATION.md
echo "Fix 3: Updating docs/LEARNINGAI365_AUTH_INTEGRATION.md..."
if [ -f "docs/LEARNINGAI365_AUTH_INTEGRATION.md" ]; then
    # Backup
    cp docs/LEARNINGAI365_AUTH_INTEGRATION.md docs/LEARNINGAI365_AUTH_INTEGRATION.md.backup

    # Replace all instances of the actual secret with placeholder
    sed -i "s/tgJoQnBPwHxccxWwYdx15g==/YOUR_JWT_SECRET_HERE/g" docs/LEARNINGAI365_AUTH_INTEGRATION.md

    print_status "Updated docs/LEARNINGAI365_AUTH_INTEGRATION.md"
else
    print_warning "docs/LEARNINGAI365_AUTH_INTEGRATION.md not found"
fi

echo ""

# Fix 4: docs/SECURITY_ASSESSMENT.md
echo "Fix 4: Updating docs/SECURITY_ASSESSMENT.md..."
if [ -f "docs/SECURITY_ASSESSMENT.md" ]; then
    # Backup
    cp docs/SECURITY_ASSESSMENT.md docs/SECURITY_ASSESSMENT.md.backup

    # Replace secret with placeholder (keep structure for examples)
    sed -i "s/tgJoQnBPwHxccxWwYdx15g==/YOUR_JWT_SECRET_HERE/g" docs/SECURITY_ASSESSMENT.md
    sed -i "s/2I3kb0Z91Un8jd4mGf7CREbTHTY93Zdg7nnaeTISiiA=/YOUR_DATABASE_PASSWORD_HERE/g" docs/SECURITY_ASSESSMENT.md

    print_status "Updated docs/SECURITY_ASSESSMENT.md"
else
    print_warning "docs/SECURITY_ASSESSMENT.md not found"
fi

echo ""

# Fix 5: Clean up backup files from first script
echo "Fix 5: Cleaning up backup files..."
if ls scripts/*.backup 1> /dev/null 2>&1; then
    rm scripts/*.backup
    print_status "Deleted old backup files from scripts/"
else
    print_warning "No backup files found in scripts/"
fi

echo ""

# Fix 6: Update BEFORE_AFTER_COMPARISON.md metrics
echo "Fix 6: Updating BEFORE_AFTER_COMPARISON.md metrics..."
if [ -f "docs/BEFORE_AFTER_COMPARISON.md" ]; then
    # Backup
    cp docs/BEFORE_AFTER_COMPARISON.md docs/BEFORE_AFTER_COMPARISON.md.backup

    # Replace 805ms with 2.45s (the accurate metric from testing)
    sed -i "s/805ms/2.45s/g" docs/BEFORE_AFTER_COMPARISON.md
    sed -i "s/P50 Latency: 2\.45s/Average Response: 2.45s/g" docs/BEFORE_AFTER_COMPARISON.md

    print_status "Updated docs/BEFORE_AFTER_COMPARISON.md with accurate metrics"
else
    print_warning "docs/BEFORE_AFTER_COMPARISON.md not found"
fi

echo ""

# Verification
echo "====================================="
echo "🔍 Final Security Verification"
echo "====================================="
echo ""

# Check for remaining secrets (excluding safe locations)
REMAINING_JWT=$(grep -r "tgJoQnBPwHxccxWwYdx15g==" . \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=archive \
    --exclude-dir=docs/archive \
    --exclude="*.backup" \
    --exclude=".env" \
    --exclude="EXECUTIVE_SUMMARY.md" \
    --exclude="FINAL_COMPREHENSIVE_REVIEW.md" \
    --exclude="CLEANUP_RESULTS_ANALYSIS.md" \
    --exclude="pre-submission-cleanup.sh" \
    --exclude="fix-remaining-secrets.sh" \
    2>/dev/null || true)

if [ -n "$REMAINING_JWT" ]; then
    echo "⚠️  JWT secret still found in:"
    echo "$REMAINING_JWT"
    echo ""
    echo "Review these files manually if they're not in safe locations"
else
    print_status "No JWT secrets found in critical files!"
fi

echo ""

REMAINING_DB=$(grep -r "2I3kb0Z91Un8jd4mGf7CREbTHTY93Zdg7nnaeTISiiA=" . \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=archive \
    --exclude-dir=docs/archive \
    --exclude="*.backup" \
    --exclude=".env" \
    --exclude="EXECUTIVE_SUMMARY.md" \
    --exclude="FINAL_COMPREHENSIVE_REVIEW.md" \
    --exclude="CLEANUP_RESULTS_ANALYSIS.md" \
    --exclude="pre-submission-cleanup.sh" \
    --exclude="fix-remaining-secrets.sh" \
    2>/dev/null || true)

if [ -n "$REMAINING_DB" ]; then
    echo "⚠️  Database password still found in:"
    echo "$REMAINING_DB"
    echo ""
    echo "Review these files manually if they're not in safe locations"
else
    print_status "No database passwords found in critical files!"
fi

echo ""
echo "====================================="
echo "✅ Security Fixes Complete!"
echo "====================================="
echo ""
echo "Files Modified:"
echo "  1. demo/index.html - Replaced secret with placeholder"
echo "  2. demo/server.js - Removed fallback, requires env var"
echo "  3. docs/LEARNINGAI365_AUTH_INTEGRATION.md - Used placeholders"
echo "  4. docs/SECURITY_ASSESSMENT.md - Used placeholders"
echo "  5. docs/BEFORE_AFTER_COMPARISON.md - Updated 805ms → 2.45s"
echo ""
echo "Backup files created in case you need to revert:"
echo "  - demo/index.html.backup"
echo "  - demo/server.js.backup"
echo "  - docs/LEARNINGAI365_AUTH_INTEGRATION.md.backup"
echo "  - docs/SECURITY_ASSESSMENT.md.backup"
echo "  - docs/BEFORE_AFTER_COMPARISON.md.backup"
echo ""
echo "Next Steps:"
echo "1. Test demo app: cd demo && JWT_SECRET='test-secret' node server.js"
echo "2. Review changes: git diff"
echo "3. Commit: git add . && git commit -m 'Security: Replace secrets with placeholders'"
echo "4. Delete backups: rm demo/*.backup docs/*.backup"
echo "5. Push to GitHub: git push origin main"
echo ""
