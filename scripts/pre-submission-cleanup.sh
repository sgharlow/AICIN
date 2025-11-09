#!/bin/bash

# AICIN Pre-Submission Cleanup Script
# Automates critical security fixes and documentation cleanup
# Run before final hackathon submission (Nov 10, 2025)

set -e  # Exit on error

echo "🚀 AICIN Pre-Submission Cleanup"
echo "================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Security - Remove hardcoded secrets
echo "Step 1: Fixing hardcoded secrets in scripts..."
echo ""

FILES_TO_FIX=(
    "scripts/test-agents-diagnostic.js"
    "scripts/test-agents-comprehensive.js"
    "scripts/test-deployed-scoring.js"
)

for file in "${FILES_TO_FIX[@]}"; do
    if [ -f "$file" ]; then
        # Check if file contains the hardcoded secret
        if grep -q "process.env.JWT_SECRET || 'tgJoQnBPwHxccxWwYdx15g=='" "$file"; then
            print_warning "Fixing $file..."

            # Create backup
            cp "$file" "${file}.backup"

            # Replace the hardcoded secret with proper error handling
            sed -i "s/const JWT_SECRET = process.env.JWT_SECRET || 'tgJoQnBPwHxccxWwYdx15g==';/const JWT_SECRET = process.env.JWT_SECRET;\nif (!JWT_SECRET) {\n  console.error('❌ ERROR: JWT_SECRET environment variable required');\n  console.log('Set it with: export JWT_SECRET=\"your-secret\"');\n  process.exit(1);\n}/g" "$file"

            print_status "Fixed $file"
        else
            print_status "$file already secure"
        fi
    else
        print_warning "$file not found"
    fi
done

echo ""

# Step 2: Archive working documents
echo "Step 2: Archiving working documents..."
echo ""

# Create archive directory if it doesn't exist
mkdir -p docs/archive

FILES_TO_ARCHIVE=(
    "docs/CRITICAL_SUBMISSION_GAPS.md"
    "docs/current.md"
    "docs/FINAL_SUBMISSION_CHECKLIST.md"
    "docs/FINAL-HACKATHON-STATUS.md"
    "docs/SUBMISSION_READY_SUMMARY.md"
    "docs/TESTING_SUMMARY.md"
    "docs/VIDEO_RECORDING_CHECKLIST.md"
)

for file in "${FILES_TO_ARCHIVE[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" docs/archive/
        print_status "Archived $file"
    else
        print_warning "$file not found (may already be archived)"
    fi
done

echo ""

# Step 3: Delete obsolete files
echo "Step 3: Deleting obsolete files..."
echo ""

FILES_TO_DELETE=(
    "docs/HACKATHON-SCORING-ISSUE.md"
    "docs/SLIDE_DECK_CONTENT.md"
    "docs/RECORDING_GUIDE.md"
    "docs/TESTING-LOCAL-AGENTS.md"
    "docs/QUICKSTART.md"
    "docs/PROJECT_STRUCTURE.md"
)

for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        print_status "Deleted $file"
    else
        print_warning "$file not found (may already be deleted)"
    fi
done

echo ""

# Step 4: Verify .env is gitignored
echo "Step 4: Verifying .env security..."
echo ""

if grep -q "^\.env$" .gitignore; then
    print_status ".env is in .gitignore"
else
    print_error ".env NOT in .gitignore - FIX THIS IMMEDIATELY!"
    echo "  Add this line to .gitignore: .env"
fi

# Check if .env is staged
if git ls-files --error-unmatch .env 2>/dev/null; then
    print_error ".env is tracked by git! REMOVE IT:"
    echo "  git rm --cached .env"
    echo "  git commit -m 'Remove .env from tracking'"
else
    print_status ".env is not tracked by git"
fi

echo ""

# Step 5: Security scan for remaining secrets
echo "Step 5: Scanning for exposed secrets..."
echo ""

# Search for JWT secret (excluding node_modules and .git)
JWT_RESULTS=$(grep -r "tgJoQnBPwHxccxWwYdx15g==" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs/archive 2>/dev/null || true)

if [ -n "$JWT_RESULTS" ]; then
    print_error "JWT secret still found in files:"
    echo "$JWT_RESULTS"
    echo ""
    echo "Fix these files before submission!"
else
    print_status "No JWT secrets found in code (docs/archive/ is gitignored)"
fi

# Search for database password
DB_RESULTS=$(grep -r "2I3kb0Z91Un8jd4mGf7CREbTHTY93Zdg7nnaeTISiiA=" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs/archive 2>/dev/null || true)

if [ -n "$DB_RESULTS" ]; then
    print_error "Database password found in files:"
    echo "$DB_RESULTS"
else
    print_status "No database passwords found in code"
fi

echo ""

# Step 6: List remaining docs files
echo "Step 6: Clean docs/ folder contents:"
echo ""

echo "Files remaining in docs/:"
ls -lh docs/*.md 2>/dev/null || echo "  (no markdown files)"

echo ""

# Step 7: Final checks
echo "Step 7: Final verification..."
echo ""

# Check if git repo is clean
if git status --porcelain | grep -q "^M"; then
    print_warning "You have uncommitted changes. Review them before committing:"
    git status --short
else
    print_status "No uncommitted changes"
fi

echo ""
echo "================================"
echo "✅ Cleanup Complete!"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Test system: export JWT_SECRET='your-secret' && node scripts/test-agents-diagnostic.js"
echo "3. Commit changes: git add . && git commit -m 'Security: Remove secrets, clean docs'"
echo "4. Push to GitHub: git push origin main"
echo "5. Verify GitHub repo is PUBLIC"
echo "6. Submit to Devpost before Nov 10, 5:00 PM PST"
echo ""
echo "📄 Review FINAL_COMPREHENSIVE_REVIEW.md for complete submission checklist"
echo ""
