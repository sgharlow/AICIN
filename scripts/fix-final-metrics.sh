#!/bin/bash

# AICIN - Fix Final Metric Inconsistencies
# Ensures all documentation uses consistent, accurate performance metrics

set -e

echo "🔧 Fixing Performance Metric Inconsistencies"
echo "==========================================="
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

# Fix 1: BEFORE_AFTER_COMPARISON.md
echo "Fix 1: Updating BEFORE_AFTER_COMPARISON.md..."
if [ -f "docs/BEFORE_AFTER_COMPARISON.md" ]; then
    cp docs/BEFORE_AFTER_COMPARISON.md docs/BEFORE_AFTER_COMPARISON.md.backup

    # Replace 805ms with 2.45s
    sed -i 's/805ms/2.45s/g' docs/BEFORE_AFTER_COMPARISON.md

    # Fix P50 latency mention
    sed -i 's/P50 Latency: 2\.45s/Average Response: 2.45s/g' docs/BEFORE_AFTER_COMPARISON.md

    print_status "Updated BEFORE_AFTER_COMPARISON.md (805ms → 2.45s)"
else
    print_warning "BEFORE_AFTER_COMPARISON.md not found"
fi

echo ""

# Fix 2: PRESENTATION_OUTLINE.md
echo "Fix 2: Updating PRESENTATION_OUTLINE.md..."
if [ -f "docs/PRESENTATION_OUTLINE.md" ]; then
    cp docs/PRESENTATION_OUTLINE.md docs/PRESENTATION_OUTLINE.md.backup

    # Fix daily capacity claim
    sed -i 's/7\.9M daily capacity/500K+ daily capacity (proven architecture)/g' docs/PRESENTATION_OUTLINE.md
    sed -i 's/7\.9 million daily capacity/500K+ daily capacity/g' docs/PRESENTATION_OUTLINE.md

    # Fix scoring weights
    sed -i 's/40% content.*35% metadata.*25%/30% content match, 70% metadata fit/g' docs/PRESENTATION_OUTLINE.md
    sed -i 's/40%.*35%.*25%/30% content, 70% metadata/g' docs/PRESENTATION_OUTLINE.md

    # Fix response time
    sed -i 's/805ms response/2.45s average response/g' docs/PRESENTATION_OUTLINE.md

    print_status "Updated PRESENTATION_OUTLINE.md (capacity, scoring, timing)"
else
    print_warning "PRESENTATION_OUTLINE.md not found"
fi

echo ""

# Verify consistency across key files
echo "Verification: Checking metric consistency..."
echo ""

# Check for any remaining 805ms references
REMAINING_805=$(grep -r "805ms" docs/*.md 2>/dev/null || true)
if [ -n "$REMAINING_805" ]; then
    print_warning "Still found 805ms in:"
    echo "$REMAINING_805"
else
    print_status "No 805ms references found"
fi

echo ""

# Check for 7.9M references
REMAINING_79M=$(grep -r "7\.9M\|7\.9 million" docs/*.md 2>/dev/null || true)
if [ -n "$REMAINING_79M" ]; then
    print_warning "Still found 7.9M capacity claims in:"
    echo "$REMAINING_79M"
else
    print_status "No inflated capacity claims found"
fi

echo ""

echo "==========================================="
echo "✅ Metric Fixes Complete!"
echo ""
echo "Changes made:"
echo "1. BEFORE_AFTER_COMPARISON.md: 805ms → 2.45s"
echo "2. PRESENTATION_OUTLINE.md: 7.9M → 500K+ daily capacity"
echo "3. PRESENTATION_OUTLINE.md: 40/35/25 → 30/70 scoring weights"
echo ""
echo "Backup files created (can restore if needed):"
echo "  - docs/BEFORE_AFTER_COMPARISON.md.backup"
echo "  - docs/PRESENTATION_OUTLINE.md.backup"
echo ""
echo "Next step: Review changes and commit"
echo "  git diff docs/"
echo "  git add docs/"
echo "  git commit -m 'Fix: Update performance metrics to match Nov 6 test data'"
echo ""
