# Tests

This directory contains all test files for the workout tracker application.

## Structure

```
tests/
├── db/              # Database-related tests
│   └── connection.test.ts
├── unit/             # Unit tests (when Vitest is set up)
├── integration/      # Integration tests
└── e2e/              # End-to-end tests
```

## Running Tests

- **Database connection test**: `pnpm test:db`
- **Unit tests** (when configured): `pnpm test`
- **Integration tests** (when configured): `pnpm test:integration`
- **E2E tests** (when configured): `pnpm test:e2e`

## Test Types

### Database Tests
Tests that verify database connectivity and basic operations.

### Unit Tests
Tests for individual functions, utilities, and domain logic.

### Integration Tests
Tests for API endpoints, repositories, and service integrations.

### E2E Tests
Tests for complete user flows and workflows.

