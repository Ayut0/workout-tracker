#!/bin/bash

# Script to help create a pull request
# Usage: ./scripts/create-pr.sh [branch-name] [--label LABEL] [--reviewer USER] [--title TITLE]
# Example: ./scripts/create-pr.sh feat/my-feature --label "enhancement" --label "documentation" --reviewer "Ayut0"

set -e

BRANCH_NAME=""
LABELS=()
REVIEWERS=()
PR_TITLE=""
REMOTE="origin"
MAIN_BRANCH="main"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --label)
            LABELS+=("$2")
            shift 2
            ;;
        --reviewer)
            REVIEWERS+=("$2")
            shift 2
            ;;
        --title)
            PR_TITLE="$2"
            shift 2
            ;;
        *)
            if [ -z "$BRANCH_NAME" ]; then
                BRANCH_NAME="$1"
            fi
            shift
            ;;
    esac
done

# Default to current branch if not specified
BRANCH_NAME="${BRANCH_NAME:-$(git branch --show-current)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Creating Pull Request for branch: ${BRANCH_NAME}${NC}\n"

# Check if we're on a branch
if [ "$BRANCH_NAME" = "HEAD" ] || [ -z "$BRANCH_NAME" ]; then
    echo -e "${RED}❌ Error: Not on a valid branch. Please checkout a feature branch first.${NC}"
    exit 1
fi

# Check if branch exists
if ! git show-ref --verify --quiet refs/heads/"$BRANCH_NAME"; then
    echo -e "${RED}❌ Error: Branch '$BRANCH_NAME' does not exist locally.${NC}"
    exit 1
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes.${NC}"
    read -p "Do you want to commit them first? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Please commit your changes first, then run this script again."
        exit 1
    fi
fi

# Ensure branch is pushed to remote
echo -e "${GREEN}📤 Checking if branch is pushed to remote...${NC}"
if ! git ls-remote --heads "$REMOTE" "$BRANCH_NAME" | grep -q "$BRANCH_NAME"; then
    echo -e "${YELLOW}Branch not found on remote. Pushing...${NC}"
    git push -u "$REMOTE" "$BRANCH_NAME"
else
    # Check if local branch is ahead
    LOCAL=$(git rev-parse @)
    REMOTE_BRANCH=$(git rev-parse "$REMOTE/$BRANCH_NAME" 2>/dev/null || echo "")
    
    if [ -n "$REMOTE_BRANCH" ] && [ "$LOCAL" != "$REMOTE_BRANCH" ]; then
        echo -e "${YELLOW}Local branch is ahead of remote. Pushing...${NC}"
        git push "$REMOTE" "$BRANCH_NAME"
    else
        echo -e "${GREEN}✓ Branch is up to date with remote${NC}"
    fi
fi

# Get commits ahead of main
COMMITS_AHEAD=$(git log "$MAIN_BRANCH".."$BRANCH_NAME" --oneline | wc -l | tr -d ' ')

if [ "$COMMITS_AHEAD" -eq 0 ]; then
    echo -e "${RED}❌ Error: Branch '$BRANCH_NAME' has no commits ahead of '$MAIN_BRANCH'.${NC}"
    exit 1
fi

echo -e "\n${GREEN}📋 Summary:${NC}"
echo -e "  Branch: ${BRANCH_NAME}"
echo -e "  Commits ahead of ${MAIN_BRANCH}: ${COMMITS_AHEAD}"
echo -e "\n${GREEN}Recent commits:${NC}"
git log "$MAIN_BRANCH".."$BRANCH_NAME" --oneline -5

# Check if GitHub CLI is available
if command -v gh &> /dev/null; then
    echo -e "\n${GREEN}GitHub CLI detected!${NC}"
    echo -e "${YELLOW}Creating PR with GitHub CLI...${NC}\n"
    
    # Get PR title from first commit if not provided
    if [ -z "$PR_TITLE" ]; then
        PR_TITLE=$(git log "$MAIN_BRANCH".."$BRANCH_NAME" --oneline -1 | cut -d' ' -f2-)
    fi
    
    # Build PR create command
    PR_CMD="gh pr create --base $MAIN_BRANCH --head $BRANCH_NAME --title \"$PR_TITLE\""
    
    # Add body file if template exists
    if [ -f ".github/pull_request_template.md" ]; then
        PR_CMD="$PR_CMD --body-file .github/pull_request_template.md"
    fi
    
    # Add labels
    if [ ${#LABELS[@]} -gt 0 ]; then
        LABEL_ARGS=$(IFS=,; echo "${LABELS[*]}")
        PR_CMD="$PR_CMD --label \"$LABEL_ARGS\""
        echo -e "${GREEN}Labels: ${LABELS[*]}${NC}"
    fi
    
    # Add reviewers
    if [ ${#REVIEWERS[@]} -gt 0 ]; then
        REVIEWER_ARGS=$(IFS=,; echo "${REVIEWERS[*]}")
        PR_CMD="$PR_CMD --reviewer \"$REVIEWER_ARGS\""
        echo -e "${GREEN}Reviewers: ${REVIEWERS[*]}${NC}"
    fi
    
    # Add web flag to open in browser
    PR_CMD="$PR_CMD --web"
    
    # Execute PR creation
    eval "$PR_CMD"
    
    echo -e "\n${GREEN}✅ Pull request created!${NC}"
else
    echo -e "\n${YELLOW}GitHub CLI not found.${NC}"
    echo -e "\n${GREEN}To create the PR manually:${NC}"
    echo -e "  1. Visit: https://github.com/Ayut0/workout-tracker/compare/${MAIN_BRANCH}...${BRANCH_NAME}"
    echo -e "  2. Fill in the PR details using the template at: .github/pull_request_template.md"
    echo -e "\n${GREEN}Or install GitHub CLI:${NC}"
    echo -e "  brew install gh"
    echo -e "  gh auth login"
fi

