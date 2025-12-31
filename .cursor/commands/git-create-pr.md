# Create PR

## Overview
Create a well-structured pull request with proper description, labels, and reviewers.

## Steps
1. **Prepare branch**
   - Check current git status and branch
   - Ensure all changes are committed (if not, commit them)
   - Push branch to remote if not already pushed
   - Verify branch is up to date with main

2. **Write PR description**
   - Read `.github/pull_request_template.md` if it exists
   - Analyze the changes in the branch (git diff, git log)
   - Summarize changes clearly and concisely
   - Include context and motivation for the changes
   - List any breaking changes
   - Note any UI changes that might need screenshots

3. **Create PR**
   - Use GitHub CLI (`gh pr create`) if available, or provide manual instructions
   - Create PR with a descriptive title based on the changes
   - Use the PR template content for the description
   - Add appropriate labels based on the type of changes
   - If reviewers are mentioned in the command, assign them
   - Link any related issues if mentioned

## PR Creation Checklist
- [ ] All changes committed
- [ ] Branch pushed to remote
- [ ] PR description written using template
- [ ] Appropriate labels added
- [ ] Reviewers assigned (if specified)
- [ ] Related issues linked (if any)