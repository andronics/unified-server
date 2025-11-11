# CI/CD Documentation

This document describes the continuous integration and deployment workflows for the Unified Multi-Protocol Server.

## Overview

The project uses **GitHub Actions** for automated testing, building, and deployment. Three main workflows are configured:

1. **CI (Continuous Integration)** - Runs on every push and pull request
2. **CD (Continuous Deployment)** - Deploys on main branch and version tags
3. **Dependencies** - Weekly dependency updates and security audits

---

## CI Workflow (`.github/workflows/ci.yml`)

### Triggers
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

### Jobs

#### 1. **Lint & Format Check**
- Runs ESLint for code quality
- Checks code formatting with Prettier
- Continues even if linting fails (informational)

#### 2. **Build TypeScript**
- Compiles TypeScript to JavaScript
- Uploads build artifacts for later use
- **Fails the build if compilation errors occur**

#### 3. **Test Suite**
Runs all tests with PostgreSQL and Redis services:
- **Unit Tests** (`tests/unit/`)
- **Integration Tests** (`tests/integration/`)
- **E2E Tests** (`tests/e2e/`)

**Services Started:**
- PostgreSQL 16 (port 5432)
- Redis 7 (port 6379)

**Environment Variables:**
```bash
NODE_ENV=test
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=unified_server_test
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=test-secret-key-for-ci
```

#### 4. **Test Coverage**
- Generates comprehensive coverage report
- Uploads to Codecov (if configured)
- Creates coverage summary in GitHub Actions
- Uploads coverage artifacts (30 days retention)

**Coverage Requirements:**
- Statements: 80%+
- Branches: 68%+
- Functions: 68%+
- Lines: 80%+

#### 5. **Docker Build Test**
- Builds Docker image using Buildx
- Tests image functionality
- Uses layer caching for faster builds
- Does NOT push (test only)

#### 6. **Security Audit**
- Runs `npm audit --production`
- Runs Snyk security scan (if token configured)
- Continues even if vulnerabilities found

#### 7. **CI Summary**
- Aggregates all job results
- Creates summary table
- **Fails if build or test jobs failed**

### Required Secrets
- `SNYK_TOKEN` (optional) - For Snyk security scanning

---

## CD Workflow (`.github/workflows/cd.yml`)

### Triggers
- Push to `main` branch
- Version tags (`v*`)
- Manual workflow dispatch

### Jobs

#### 1. **Docker Publish**
Builds and publishes multi-platform Docker images:
- Platforms: `linux/amd64`, `linux/arm64`
- Registries: GitHub Container Registry (ghcr.io)
- Optional: Docker Hub (if credentials provided)

**Image Tags:**
- `main` - Latest from main branch
- `main-<sha>` - Specific commit from main
- `v1.2.3` - Semantic version tag
- `v1.2` - Minor version
- `v1` - Major version
- `latest` - Latest stable release (main branch only)

**Metadata:**
- `BUILD_DATE` - Commit timestamp
- `VCS_REF` - Git commit SHA
- `VERSION` - Git ref name

#### 2. **Create GitHub Release**
Triggered on version tags (`v*`):
- Generates changelog from commits
- Creates GitHub release
- Attaches release notes

#### 3. **Deploy to Staging**
Triggered on push to `main`:
- Deploys to staging environment
- Uses image: `ghcr.io/owner/repo:main-<sha>`
- Environment: `staging`

**Placeholder Commands:**
```bash
# Add your deployment commands here
# Examples:
# - kubectl set image deployment/app app=ghcr.io/${{ github.repository }}:$TAG
# - ssh user@server "docker pull ... && docker-compose up -d"
# - curl -X POST https://your-webhook-url
```

#### 4. **Deploy to Production**
Triggered on version tags (`v*`):
- Deploys to production environment
- Uses image: `ghcr.io/owner/repo:v1.2.3`
- Environment: `production`
- Requires GitHub environment protection rules

#### 5. **Deployment Notification**
- Sends notifications after deployment
- Reports success/failure status
- Placeholder for Slack, Discord, Email, etc.

### Required Secrets
- `DOCKER_USERNAME` (optional) - Docker Hub username
- `DOCKER_PASSWORD` (optional) - Docker Hub password
- `GITHUB_TOKEN` - Automatically provided

### Required Environments
Configure in GitHub repository settings → Environments:

**staging:**
- URL: `https://staging.yourdomain.com`
- Protection rules: Optional

**production:**
- URL: `https://yourdomain.com`
- Protection rules: **Recommended**
  - Required reviewers
  - Wait timer
  - Deployment branches: Only tags

---

## Dependencies Workflow (`.github/workflows/dependencies.yml`)

### Triggers
- **Schedule**: Every Monday at 9 AM UTC
- Manual workflow dispatch

### Jobs

#### 1. **Update Dependencies**
- Checks for outdated packages
- Creates summary of available updates
- Creates GitHub issue with update recommendations

**Issue Format:**
```markdown
## Outdated Dependencies

| Package | Current | Wanted | Latest |
|---------|---------|--------|--------|
| express | 4.18.0  | 4.18.2 | 4.19.0 |
...
```

Labels: `dependencies`, `maintenance`

#### 2. **Security Audit**
- Runs `npm audit`
- Creates vulnerability summary
- Creates GitHub issue for critical/high vulnerabilities

**Issue Format:**
```markdown
## Security Vulnerabilities Detected

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 5     |
| Moderate | 3     |
| Low      | 1     |
```

Labels: `security`, `critical`

---

## Setup Instructions

### 1. Enable GitHub Actions
GitHub Actions is enabled by default for public repositories. For private repos:
- Go to repository **Settings** → **Actions** → **General**
- Enable "Allow all actions and reusable workflows"

### 2. Configure Secrets
Go to repository **Settings** → **Secrets and variables** → **Actions**:

**Required:**
- None (GitHub provides `GITHUB_TOKEN` automatically)

**Optional:**
- `DOCKER_USERNAME` - Docker Hub username (for Docker Hub publishing)
- `DOCKER_PASSWORD` - Docker Hub token (for Docker Hub publishing)
- `SNYK_TOKEN` - Snyk API token (for security scanning)

### 3. Configure Environments
Go to repository **Settings** → **Environments**:

**Create `staging` environment:**
- Name: `staging`
- URL: Your staging URL
- Protection rules: None (or optional)

**Create `production` environment:**
- Name: `production`
- URL: Your production URL
- Protection rules:
  - ✅ Required reviewers: 1+
  - ✅ Wait timer: 5 minutes
  - ✅ Deployment branches: Only tags matching `v*`

### 4. Configure Codecov (Optional)
For coverage reporting:
1. Sign up at https://codecov.io
2. Connect your GitHub repository
3. Codecov token is automatic for public repos
4. For private repos, add `CODECOV_TOKEN` secret

### 5. Update Badge URLs
In `README.md`, replace `YOUR_USERNAME` with your GitHub username:
```markdown
[![CI](https://github.com/YOUR_USERNAME/unified-server/actions/workflows/ci.yml/badge.svg)]
```

---

## Customizing Workflows

### Modify Test Commands
Edit `.github/workflows/ci.yml`:
```yaml
- name: Run unit tests
  run: npm test -- tests/unit
  # Change to: npm run test:unit
```

### Add Deployment Commands
Edit `.github/workflows/cd.yml`:
```yaml
- name: Deploy to production server
  run: |
    # Add your deployment commands
    kubectl set image deployment/app app=ghcr.io/${{ github.repository }}:${{ github.ref_name }}
```

### Change Test Database
Edit service configuration in `.github/workflows/ci.yml`:
```yaml
services:
  postgres:
    image: postgres:16  # Change version
    env:
      POSTGRES_DB: unified_server_test
      POSTGRES_USER: test_user     # Change credentials
      POSTGRES_PASSWORD: test_pass
```

### Add Notification Services
Edit `.github/workflows/cd.yml`:
```yaml
- name: Send notification
  run: |
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
      -H 'Content-Type: application/json' \
      -d '{"text":"Deployment completed to production"}'
```

---

## Workflow Status

Check workflow status:
- **GitHub UI**: Repository → Actions tab
- **Badge**: Shows in README.md
- **API**: `https://api.github.com/repos/owner/repo/actions/runs`

### Recent Runs
```bash
# Using GitHub CLI
gh run list --workflow=ci.yml --limit 5
gh run view <run-id>
```

---

## Troubleshooting

### Tests Failing in CI but Pass Locally

**Possible causes:**
1. **Environment differences**: CI uses PostgreSQL/Redis in containers
2. **Timing issues**: CI may be slower/faster than local
3. **Missing environment variables**: Check test environment vars
4. **Database state**: Tests may not be cleaning up properly

**Solutions:**
```bash
# Run tests with CI environment locally
docker-compose -f docker-compose.test.yml up -d
npm run test:ci

# Check test isolation
npm test -- --run --no-coverage
```

### Docker Build Failing

**Check:**
1. Dockerfile syntax
2. Build context includes all necessary files
3. `.dockerignore` not excluding required files
4. Multi-platform build compatibility

**Debug locally:**
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t test .
```

### Coverage Not Uploading to Codecov

**Check:**
1. Codecov token configured (private repos only)
2. Coverage files generated (`coverage/coverage-final.json`)
3. Codecov action version compatibility

**Manual upload:**
```bash
npx codecov --token=$CODECOV_TOKEN
```

### Deployment Not Triggered

**Check:**
1. Workflow trigger conditions match
2. GitHub environments configured correctly
3. Required reviewers approved (for production)
4. Tag format matches pattern (e.g., `v1.0.0`)

---

## Best Practices

### 1. **Protect Main Branch**
Go to **Settings** → **Branches** → **Branch protection rules**:
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- ✅ Select: `lint`, `build`, `test`, `coverage`

### 2. **Use Semantic Versioning**
```bash
# Create version tags
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### 3. **Review Dependency Updates**
- Check weekly dependency issues
- Test updates in a separate branch
- Update one major dependency at a time

### 4. **Monitor Security Alerts**
- Review security audit issues immediately
- Prioritize critical/high vulnerabilities
- Run `npm audit fix` to auto-fix

### 5. **Keep Workflows Updated**
- Update action versions quarterly
- Review workflow changes in GitHub Actions blog
- Test workflow changes in feature branches

---

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Codecov Documentation](https://docs.codecov.com/)
- [Semantic Versioning](https://semver.org/)

---

**Last Updated**: 2025-11-11
**Version**: 1.0.0
