# Contributing to mailgate

Thank you for considering contributing! This guide will get you up and running quickly.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Messages](#commit-messages)
- [Pull Request Checklist](#pull-request-checklist)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).
By participating, you agree to uphold this standard.

---

## Getting Started

```sh
# 1. Fork and clone the repo
git clone https://github.com/<your-username>/mailgate.git
cd mailgate

# 2. Install dependencies
npm install

# 3. Run the test suite
npm test

# 4. Run the linter
npm run lint

# 5. Check formatting
npm run format:check
```

Node.js **18 or higher** is required.

---

## Development Workflow

### Branch naming

| Type    | Pattern              | Example                        |
| ------- | -------------------- | ------------------------------ |
| Feature | `feat/<short-name>`  | `feat/batch-validation`        |
| Bug fix | `fix/<short-name>`   | `fix/levenshtein-edge-case`    |
| Chore   | `chore/<short-name>` | `chore/update-disposable-list` |
| Docs    | `docs/<short-name>`  | `docs/add-express-example`     |

### Running tests

```sh
npm test                # run all tests once
npm run test:watch      # re-run on file change (Node 20+)
npm run test:coverage   # generate coverage report
```

### Linting & formatting

```sh
npm run lint            # check for errors
npm run lint:fix        # auto-fix what's possible
npm run format          # reformat all files
npm run format:check    # verify formatting (used in CI)
```

---

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

| Type       | When to use                             |
| ---------- | --------------------------------------- |
| `feat`     | New feature visible to users            |
| `fix`      | Bug fix                                 |
| `docs`     | Documentation only                      |
| `test`     | Adding or updating tests                |
| `chore`    | Build, CI, tooling — no production code |
| `refactor` | Code change that isn't a fix or feature |
| `perf`     | Performance improvement                 |

**Examples:**

```
feat(validator): add support for batch email validation
fix(typo-check): prevent false positive for me.com vs msn.com
chore(deps): update express to 4.21.0
docs: add PHP integration example to README
```

---

## Pull Request Checklist

Before submitting your PR, ensure:

- [ ] Tests pass: `npm test`
- [ ] Linter passes: `npm run lint`
- [ ] Formatting passes: `npm run format:check`
- [ ] New code has test coverage
- [ ] `CHANGELOG.md` updated (for user-visible changes)
- [ ] Commit messages follow Conventional Commits

---

## Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- Node.js version (`node --version`)
- mailgate version (`npm list mailgate`)
- Minimal reproduction code
- Actual vs expected behaviour

---

## Suggesting Features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md) and include:

- The problem you're trying to solve
- Your proposed solution
- Alternatives you've considered

---

## Security Issues

Please **do not** open a public issue for security vulnerabilities.
Instead, follow the process in [SECURITY.md](./SECURITY.md).
