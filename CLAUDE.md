# Unified Server - Development Guide

**Project:** Unified Multi-Protocol Server
**Architecture:** 4-Layer Clean Architecture
**Status:** Phase 3 In Progress (GraphQL API)
**Last Updated:** 2025-11-11

---

## Overview

This is a production-grade, multi-protocol TypeScript server supporting HTTP REST, WebSocket, and GraphQL through a unified clean architecture. The project follows strict architectural principles, comprehensive testing standards, and disciplined development practices.

---

## Core Development Principles

### 1. **Phased Development with Git Discipline**

**CRITICAL: Every phase and task completion MUST be committed to git.**

#### Git Commit Strategy

**Phase-Level Commits** (Major Milestones):
```bash
# When completing an entire phase
git add .
git commit -m "Phase X Complete: [Phase Name]

- Feature 1 implemented
- Feature 2 implemented
- All tests passing (X/Y tests, Z% coverage)
- Documentation updated

Closes #issue-number"
```

**Task-Level Commits** (Daily Progress):
```bash
# When completing a specific task or day
git add .
git commit -m "Phase X Day Y: [Task Name]

- Specific accomplishment 1
- Specific accomplishment 2
- Tests: X passing
- PLAN.md updated"
```

**Feature Commits** (Granular Changes):
```bash
# When implementing a specific feature
git add src/application/graphql/resolvers/
git commit -m "feat(graphql): Implement query resolvers

- Add 6 query operations
- Implement field resolvers
- Add input validation"
```

**Bug Fix Commits**:
```bash
git add src/integration/database/repositories/message-repository.ts
git commit -m "fix(pagination): Add hasNextPage/hasPreviousPage fields

- Update PaginatedResponse type
- Calculate pagination booleans in repository
- Fix GraphQL connection pageInfo"
```

#### Commit Frequency

- ✅ **DO**: Commit at the end of each task/day
- ✅ **DO**: Commit when completing a logical feature
- ✅ **DO**: Commit before starting a new major task
- ✅ **DO**: Commit when tests are all passing
- ❌ **DON'T**: Go more than 1 day without committing
- ❌ **DON'T**: Commit broken code (unless explicitly WIP)
- ❌ **DON'T**: Combine unrelated changes in one commit

### 2. **docs/project/PLAN.md is the Source of Truth**

**docs/project/PLAN.md MUST ALWAYS be kept up to date.**

#### When to Update PLAN.md

1. **Before Starting Work**: Review current phase status
2. **During Work**: Mark items as in-progress with appropriate emojis
3. **After Completing Tasks**: Mark checkboxes `[x]` and add ✅ emoji
4. **After Completing Days**: Update day headers with "✅ COMPLETE"
5. **After Completing Phases**: Update phase status and summary sections
6. **When Discovering New Tasks**: Add them to the appropriate section
7. **When Changing Plans**: Update estimates and task breakdowns

#### PLAN.md Update Checklist

After completing any work, ensure:
- [ ] Task checkboxes updated `[ ]` → `[x]`
- [ ] Day/Phase headers have status (🚧 IN PROGRESS / ✅ COMPLETE)
- [ ] Test counts updated if applicable
- [ ] Status section at top reflects current phase
- [ ] Deliverables section updated
- [ ] Commit the PLAN.md update with your work

#### Example PLAN.md Update

```markdown
#### ✅ Day 3: Query & Mutation Resolvers COMPLETE
- [x] Implement Query resolvers (6 operations)
- [x] Implement Mutation resolvers (6 operations)
- [x] Implement Field resolvers (2 operations)
- [x] Create context builder with JWT auth
- [x] Add input validation with Zod

**Deliverables**: ✅ All query/mutation resolvers implemented, tested, and working
```

---

## Architecture Guidelines

### 4-Layer Clean Architecture

```
Foundation (Layer 1)
  ↓ depends on
Domain (Layer 2)
  ↓ depends on
Integration (Layer 3)
  ↓ depends on
Application (Layer 4)
```

**Dependency Flow**: Layers can only depend on layers below them. Never upward or sideways.

### Layer Responsibilities

**Layer 1: Foundation** (`src/foundation/`)
- Types, interfaces, enums
- Error classes
- Constants
- Pure business logic (no I/O)

**Layer 2: Domain** (`src/domain/`)
- Repository interfaces
- Service interfaces
- Domain models and rules
- Business validation logic

**Layer 3: Integration** (`src/integration/`)
- Database implementations
- External service clients
- Message queue adapters
- Infrastructure concerns

**Layer 4: Application** (`src/application/`)
- HTTP routes
- WebSocket handlers
- GraphQL resolvers
- Service implementations
- Protocol-specific logic

---

## Testing Standards

### Test Coverage Requirements

- **Overall Coverage**: 80%+ (statements, branches, functions)
- **Critical Paths**: 100% coverage required
- **Repository Layer**: 100% coverage required
- **Service Layer**: 95%+ coverage required
- **Application Layer**: 85%+ coverage required

### Test Types

1. **Unit Tests**: Test individual functions/classes in isolation
2. **Integration Tests**: Test layer interactions (e.g., service → repository → database)
3. **E2E Tests**: Test full request/response cycles across protocols

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- user-service.test.ts

# Run in watch mode
npm run test:watch
```

### Test Commit Requirements

- ✅ All tests must pass before committing
- ✅ New features require new tests
- ✅ Bug fixes require regression tests
- ✅ Coverage must not decrease

---

## Development Workflow

### Starting a New Phase

1. **Review docs/project/PLAN.md**: Understand phase goals and tasks
2. **Create Feature Branch** (optional): `git checkout -b phase-X-feature-name`
3. **Update PLAN.md**: Mark phase as 🚧 IN PROGRESS
4. **Commit**: `git commit -m "chore: Start Phase X - [Phase Name]"`

### Daily Development Cycle

1. **Morning**:
   - Review docs/project/PLAN.md for today's tasks
   - Update docs/project/PLAN.md with current day status (🚧 IN PROGRESS)
   - Commit PLAN.md update

2. **During Development**:
   - Follow TDD when appropriate (write tests first)
   - Keep commits small and focused
   - Run tests frequently (`npm test`)
   - Update types as needed

3. **End of Day**:
   - Run full test suite: `npm test`
   - Update PLAN.md with completed tasks
   - Commit all changes with descriptive message
   - Push to remote: `git push origin main`

### Completing a Task/Day

```bash
# 1. Ensure all tests pass
npm test

# 2. Update PLAN.md
# Mark tasks complete, update status

# 3. Stage changes
git add .

# 4. Commit with descriptive message
git commit -m "Phase X Day Y: [Task Name] Complete

- Accomplishment 1
- Accomplishment 2
- Tests: X/Y passing (Z% coverage)
- PLAN.md updated"

# 5. Push to remote
git push origin main
```

### Completing a Phase

```bash
# 1. Verify all phase tasks complete in PLAN.md
# 2. Run full test suite
npm test

# 3. Run coverage report
npm run test:coverage

# 4. Update PLAN.md
# - Mark phase as ✅ COMPLETE
# - Update status section at top
# - Add test summary
# - Add deliverables summary

# 5. Commit phase completion
git add .
git commit -m "Phase X Complete: [Phase Name]

Summary:
- Feature 1 implemented and tested
- Feature 2 implemented and tested
- All X tasks completed
- Tests: Y/Z passing (W% coverage)
- Documentation complete

Deliverables:
✅ [List key deliverables]

Next: Phase X+1 - [Next Phase Name]"

# 6. Tag the phase completion (optional but recommended)
git tag -a "phase-X-complete" -m "Phase X: [Phase Name] Complete"

# 7. Push with tags
git push origin main --tags
```

---

## Code Style & Conventions

### TypeScript

- **Strict mode**: Enabled in tsconfig.json
- **No any**: Use proper types or `unknown`
- **Interfaces over types**: For object shapes
- **Explicit return types**: On all public functions

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `user-service.ts`)
- **Classes**: `PascalCase` (e.g., `UserService`)
- **Functions**: `camelCase` (e.g., `getUserById`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_PAGE_SIZE`)
- **Interfaces**: `PascalCase` (e.g., `User`, `PaginatedResponse`)

### File Structure

```
src/
├── foundation/          # Layer 1: Pure domain
│   ├── types/
│   ├── errors/
│   └── constants/
├── domain/             # Layer 2: Business logic
│   ├── repositories/
│   └── services/
├── integration/        # Layer 3: External systems
│   ├── database/
│   ├── cache/
│   └── pubsub/
└── application/        # Layer 4: Protocols
    ├── http/
    ├── websocket/
    └── graphql/
```

---

## GraphQL Development (Phase 3)

### GraphQL Structure

```
src/application/graphql/
├── schema.ts              # SDL type definitions
├── resolvers/
│   ├── index.ts          # Combine all resolvers
│   ├── query-resolvers.ts
│   ├── mutation-resolvers.ts
│   ├── field-resolvers.ts
│   └── subscription-resolvers.ts
├── context.ts            # Request context builder
├── validators.ts         # Zod input validators
└── graphql-server.ts     # GraphQL Yoga setup
```

### Resolver Guidelines

1. **Delegate to Services**: Resolvers should not contain business logic
2. **Validate Inputs**: Use Zod schemas for all mutation inputs
3. **Handle Auth**: Check `context.user` for authenticated operations
4. **Log Operations**: Log all queries/mutations with correlation IDs
5. **Transform Responses**: Convert service responses to GraphQL types

### Adding a New Query

```typescript
// 1. Add to schema.ts
type Query {
  newQuery(arg: String!): Result
}

// 2. Add resolver in query-resolvers.ts
export const queryResolvers = {
  newQuery: async (_parent: any, args: { arg: string }, context: GraphQLContext) => {
    // Validate input
    const validatedArg = argSchema.parse(args.arg);

    // Call service
    const result = await someService.doSomething(validatedArg);

    return result;
  },
};

// 3. Add validator in validators.ts
export const argSchema = z.string().min(1).max(100);

// 4. Test the query
// 5. Update PLAN.md
// 6. Commit
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=unified_server
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your-secret-key-change-in-production

# GraphQL
GRAPHQL_ENABLED=true
GRAPHQL_PATH=/graphql
GRAPHQL_PLAYGROUND_ENABLED=true
GRAPHQL_MAX_DEPTH=5
GRAPHQL_MAX_COMPLEXITY=1000
```

### Configuration Files

- `.env.example`: Template with all variables
- `.env`: Local development (gitignored)
- `.env.test`: Test environment
- `.env.production`: Production (never commit)

---

## Common Tasks

### Adding a New Feature

1. **Plan**: Update PLAN.md with new tasks
2. **Design**: Define types in foundation layer
3. **Implement**: Bottom-up (foundation → domain → integration → application)
4. **Test**: Write tests as you go
5. **Document**: Update relevant docs
6. **Commit**: Commit when feature is complete and tested

### Fixing a Bug

1. **Reproduce**: Write a failing test
2. **Fix**: Make the minimal change to pass the test
3. **Verify**: Run full test suite
4. **Document**: Add comments if behavior is non-obvious
5. **Commit**: `fix(module): Description of bug fix`

### Refactoring

1. **Tests First**: Ensure tests cover current behavior
2. **Small Steps**: Make incremental changes
3. **Test After Each Step**: Verify tests still pass
4. **No Behavior Change**: Functionality remains identical
5. **Commit Often**: Small, logical commits

---

## Documentation Standards

### Code Comments

- **Why, not What**: Explain reasoning, not syntax
- **Complex Logic**: Always comment non-obvious algorithms
- **Public APIs**: JSDoc comments on all exported functions
- **TODOs**: Include context and link to issues

### JSDoc Example

```typescript
/**
 * Authenticate user with email and password
 *
 * @param credentials - User email and password
 * @returns Authentication response with user and JWT token
 * @throws {ApiError} 401 if credentials are invalid
 * @throws {ApiError} 404 if user not found
 */
async authenticate(credentials: AuthCredentials): Promise<AuthResponse> {
  // Implementation
}
```

---

## Troubleshooting

### Build Errors

```bash
# Clean build artifacts
rm -rf dist/

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### Test Failures

```bash
# Run specific test file
npm test -- failing-test.test.ts

# Run with verbose output
npm test -- --verbose

# Run in watch mode to debug
npm run test:watch
```

### Database Issues

```bash
# Reset database
npm run db:reset

# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed
```

---

## Git Workflow Summary

### Daily Checklist

- [ ] Pull latest changes: `git pull origin main`
- [ ] Review PLAN.md for today's tasks
- [ ] Update PLAN.md status (🚧 IN PROGRESS)
- [ ] Commit PLAN.md update
- [ ] Develop features/fixes
- [ ] Run tests: `npm test`
- [ ] Update PLAN.md with completed tasks (✅)
- [ ] Commit work with descriptive message
- [ ] Push to remote: `git push origin main`

### Phase Completion Checklist

- [ ] All tasks in PLAN.md marked complete `[x]`
- [ ] All tests passing: `npm test`
- [ ] Coverage meets standards: `npm run test:coverage`
- [ ] PLAN.md status updated (✅ COMPLETE)
- [ ] Documentation updated (README, PLAN.md)
- [ ] Phase completion commit with summary
- [ ] Tag phase: `git tag phase-X-complete`
- [ ] Push with tags: `git push origin main --tags`

---

## Important Reminders

### ⚠️ CRITICAL RULES

1. **NEVER commit broken code** (unless explicitly marked WIP)
2. **ALWAYS update PLAN.md** when completing tasks
3. **ALWAYS commit at task/day completion**
4. **ALWAYS run tests before committing**
5. **NEVER decrease test coverage** without justification
6. **ALWAYS follow clean architecture** dependency flow
7. **ALWAYS validate inputs** at application layer
8. **ALWAYS log significant operations** with correlation IDs

### 🎯 Best Practices

- **Small, focused commits** are better than large monolithic ones
- **Test-driven development** catches bugs early
- **Keep PLAN.md current** - it's your roadmap and progress tracker
- **Document as you go** - don't leave it for later
- **Review code before committing** - does it meet standards?
- **Think about maintainability** - will you understand this in 6 months?

---

## Quick Reference

### Common Commands

```bash
# Development
npm run dev              # Start dev server with watch mode
npm run build            # TypeScript compilation
npm test                 # Run all tests
npm run test:coverage    # Run tests with coverage
npm run lint             # Run ESLint
npm run format           # Format code with Prettier

# Git
git status               # Check current changes
git add .                # Stage all changes
git commit -m "message"  # Commit with message
git push origin main     # Push to remote
git pull origin main     # Pull latest changes
git tag -a "v1.0.0"      # Create annotated tag

# Docker
docker-compose up -d     # Start services
docker-compose down      # Stop services
docker-compose logs -f   # Follow logs
```

### Key Files

- `docs/project/PLAN.md` - Project roadmap and status
- `README.md` - Project overview and setup
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variable template

---

**Remember**: Disciplined development practices lead to maintainable, high-quality software. Take the time to commit properly, keep documentation current, and maintain test coverage. Your future self (and your team) will thank you.

**Version**: 1.0.0
**Last Updated**: 2025-11-11
**Maintainer**: Development Team
