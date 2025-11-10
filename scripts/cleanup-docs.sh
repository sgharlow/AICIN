#!/bin/bash

# AICIN - Clean Up Documentation Folder
# Moves non-essential docs to archive for cleaner submission

set -e

echo "📁 Cleaning Up Documentation Folder"
echo "===================================="
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

# Create archive directory
mkdir -p docs/archive
print_status "Created docs/archive/ directory"

echo ""
echo "Moving non-essential documents to archive..."
echo ""

# Count files to move
MOVED=0

# List of files to archive
FILES_TO_ARCHIVE=(
    "docs/CLEANUP_RESULTS_ANALYSIS.md"
    "docs/EXECUTIVE_SUMMARY.md"
    "docs/FINAL_COMPREHENSIVE_REVIEW.md"
    "docs/FINAL_REVIEW_FINDINGS.md"
    "docs/TIER_1_AND_2_COMPLETION_SUMMARY.md"
    "docs/LEARNINGAI365_AUTH_INTEGRATION.md"
    "docs/LEARNINGAI365_FRONTEND_CHANGES.md"
    "docs/PRESENTATION_OUTLINE.md"
    "docs/SECURITY_ASSESSMENT.md"
    "docs/DEPLOY.md"
)

for file in "${FILES_TO_ARCHIVE[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" docs/archive/
        MOVED=$((MOVED + 1))
        print_status "Archived $(basename $file)"
    else
        print_warning "$(basename $file) not found (may already be archived)"
    fi
done

echo ""

# Optional: Archive BEFORE_AFTER_COMPARISON.md (borderline file)
echo "Borderline file: BEFORE_AFTER_COMPARISON.md"
echo "  This file shows migration story but is not essential."
echo "  Recommend keeping it. If you want to archive:"
echo "    mv docs/BEFORE_AFTER_COMPARISON.md docs/archive/"
echo ""

# Show final docs/ folder
echo "===================================="
echo "✅ Cleanup Complete!"
echo ""
echo "Moved $MOVED files to docs/archive/"
echo ""
echo "Final docs/ folder structure:"
ls -1 docs/*.md 2>/dev/null || echo "  (no markdown files found)"

echo ""
echo "Essential files remaining (7-8):"
echo "  ✅ ARCHITECTURE.md"
echo "  ✅ ARCHITECTURE_DIAGRAMS.md"
echo "  ✅ BEFORE_AFTER_COMPARISON.md (optional)"
echo "  ✅ HACKATHON_SUBMISSION.md"
echo "  ✅ HONEST_VIDEO_SCRIPT.md"
echo "  ✅ PERFORMANCE_METRICS.md"
echo "  ✅ PRODUCTION_CUTOVER_PLAN.md"
echo "  ✅ SCORING-ANALYSIS.md"
echo ""
echo "Next steps:"
echo "  1. Review: git status"
echo "  2. Commit: git add . && git commit -m 'Docs: Archive non-essential files for cleaner submission'"
echo "  3. Push: git push origin main"
echo ""
