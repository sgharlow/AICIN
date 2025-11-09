#!/bin/bash

# AICIN - Final Security Cleanup
# Fixes critical gitignore issues found in final review

set -e

echo "🔒 FINAL SECURITY CLEANUP"
echo "=========================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Issue 1: archive/ folder is tracked by git but contains secrets
echo "Issue 1: Checking archive/ folder status..."
if git ls-files archive/ &>/dev/null; then
    print_error "archive/ folder is tracked by git!"
    echo "  Files with secrets are in the repository history"
    echo ""

    # Add archive/ to .gitignore
    echo "  Adding 'archive/' to .gitignore..."
    if ! grep -q "^archive/$" .gitignore; then
        echo "" >> .gitignore
        echo "# Archive folder (contains old dev docs)" >> .gitignore
        echo "archive/" >> .gitignore
        print_status "Added archive/ to .gitignore"
    else
        print_status "archive/ already in .gitignore"
    fi

    # Remove from git tracking
    echo "  Removing archive/ from git tracking..."
    git rm -r --cached archive/ 2>/dev/null || true
    print_status "Removed archive/ from git tracking"

    print_warning "IMPORTANT: archive/ will be removed from future commits"
    print_warning "Old commits still contain it - see remediation steps below"
else
    print_status "archive/ folder is not tracked by git"
fi

echo ""

# Issue 2: Delete backup files (contain old secrets)
echo "Issue 2: Removing backup files..."
BACKUP_COUNT=0

for backup_file in demo/*.backup docs/*.backup; do
    if [ -f "$backup_file" ]; then
        rm "$backup_file"
        BACKUP_COUNT=$((BACKUP_COUNT + 1))
    fi
done

if [ $BACKUP_COUNT -gt 0 ]; then
    print_status "Deleted $BACKUP_COUNT backup files"
else
    print_status "No backup files found"
fi

echo ""

# Issue 3: Add *.backup to .gitignore to prevent future issues
echo "Issue 3: Updating .gitignore for backup files..."
if ! grep -q "*.backup" .gitignore; then
    echo "" >> .gitignore
    echo "# Backup files" >> .gitignore
    echo "*.backup" >> .gitignore
    print_status "Added *.backup to .gitignore"
else
    print_status "*.backup already in .gitignore"
fi

echo ""

# Verification
echo "=========================="
echo "🔍 FINAL VERIFICATION"
echo "=========================="
echo ""

# Check for secrets in tracked files only
echo "Scanning TRACKED files for secrets..."
TRACKED_SECRETS=$(git ls-files | xargs grep -l "tgJoQnBPwHxccxWwYdx15g==" 2>/dev/null | \
    grep -v "\.sh$" | \
    grep -v "EXECUTIVE_SUMMARY.md" | \
    grep -v "FINAL_COMPREHENSIVE_REVIEW.md" | \
    grep -v "CLEANUP_RESULTS_ANALYSIS.md" || true)

if [ -n "$TRACKED_SECRETS" ]; then
    print_error "Secrets found in tracked files:"
    echo "$TRACKED_SECRETS"
    echo ""
else
    print_status "No secrets found in tracked files (excluding review docs)!"
fi

echo ""

# Check .gitignore is working
echo "Verifying .gitignore rules..."
if git check-ignore .env &>/dev/null; then
    print_status ".env is ignored"
else
    print_error ".env is NOT ignored!"
fi

if git check-ignore docs/archive/test.md &>/dev/null; then
    print_status "docs/archive/ is ignored"
else
    print_error "docs/archive/ is NOT ignored!"
fi

if git check-ignore archive/test.md &>/dev/null; then
    print_status "archive/ is ignored"
else
    print_error "archive/ is NOT ignored!"
fi

echo ""

# Show what will be committed
echo "=========================="
echo "📋 CHANGES TO COMMIT"
echo "=========================="
git status --short

echo ""
echo "=========================="
echo "✅ CLEANUP COMPLETE"
echo "=========================="
echo ""

# Check if archive/ was previously committed
if git log --oneline --all -- archive/ | head -1 &>/dev/null; then
    print_error "CRITICAL: archive/ folder WAS committed in git history!"
    echo ""
    echo "🚨 SECURITY REMEDIATION REQUIRED:"
    echo ""
    echo "Option 1: SECRET ROTATION (RECOMMENDED - Safer, Simpler)"
    echo "  Since secrets are in git history, rotate them:"
    echo "  1. Generate new JWT_SECRET: openssl rand -base64 32"
    echo "  2. Update Google Cloud Secret Manager with new secret"
    echo "  3. Redeploy all Cloud Run services"
    echo "  4. Update .env locally with new secret"
    echo "  5. Submit hackathon with rotated secrets"
    echo ""
    echo "Option 2: GIT HISTORY REWRITE (Complex, Risky)"
    echo "  Use BFG Repo Cleaner to purge secrets from history:"
    echo "  1. Backup entire repo first!"
    echo "  2. Run: java -jar bfg.jar --replace-text secrets.txt AICIN/"
    echo "  3. Run: git reflog expire && git gc --prune=now --aggressive"
    echo "  4. Force push: git push --force origin main"
    echo "  ⚠️  This rewrites history - only do if you haven't shared repo!"
    echo ""
    echo "RECOMMENDATION: Use Option 1 (rotate secrets) - it's safer and simpler."
else
    print_status "archive/ folder was never committed - you're safe!"
fi

echo ""
echo "Next steps:"
echo "1. Review changes: git diff .gitignore"
echo "2. Commit: git add . && git commit -m 'Security: Add archive/ to gitignore, remove backup files'"
echo "3. Push: git push origin main"
echo ""
echo "4. IF archive/ was in git history (see above):"
echo "   → ROTATE SECRETS after hackathon submission"
echo ""
