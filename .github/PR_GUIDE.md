# Pull Request Creation Guide

## Quick Start

### Using the Script (Recommended)

```bash
# Basic usage - creates PR from current branch
./scripts/create-pr.sh

# Specify branch name
./scripts/create-pr.sh feat/my-feature

# With labels
./scripts/create-pr.sh feat/my-feature --label "enhancement" --label "documentation"

# With reviewers
./scripts/create-pr.sh feat/my-feature --reviewer "Ayut0"

# With custom title
./scripts/create-pr.sh feat/my-feature --title "My Custom PR Title"

# Full example
./scripts/create-pr.sh feat/my-feature \
  --label "enhancement" \
  --label "documentation" \
  --reviewer "Ayut0" \
  --title "Add new feature"
```

### Manual Creation

1. **Visit the PR creation page:**
   ```
   https://github.com/Ayut0/workout-tracker/compare/main...your-branch-name
   ```

2. **Fill in the PR details:**
   - Use the template at `.github/pull_request_template.md`
   - Add appropriate labels (enhancement, bug, documentation, etc.)
   - Assign reviewers
   - Link related issues

3. **Submit the PR**

## PR Checklist

Before creating a PR, ensure:

- [ ] All changes are committed
- [ ] Branch is pushed to remote
- [ ] Branch is up to date with main (or rebased)
- [ ] Unit tests pass
- [ ] Manual testing completed
- [ ] Code follows project style guidelines
- [ ] Documentation is updated (if needed)

## Common Labels

- `enhancement` - New feature or improvement
- `bug` - Bug fix
- `documentation` - Documentation changes
- `refactoring` - Code refactoring
- `chore` - Maintenance tasks
- `breaking-change` - Breaking changes

## Installing GitHub CLI (Optional)

For automated PR creation:

```bash
# macOS
brew install gh

# Authenticate
gh auth login

# Verify installation
gh --version
```

