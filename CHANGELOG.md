# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-08-29

### Added

- **Test suite** — comprehensive unit tests for `validateEmail()` and integration tests for the HTTP server, using the Node.js built-in `node:test` runner (zero extra runtime dependencies).
- **CI pipeline** — GitHub Actions workflow running the full test matrix on Node 18, 20 and 22 for every push and pull request.
- **Automated releases** — GitHub Actions `release.yml` publishes to npm with provenance on semver tags and creates a GitHub Release with auto-generated notes.
- **CodeQL security scanning** — weekly static analysis of JavaScript code via GitHub Code Scanning.
- **Dependabot** — automated weekly dependency updates for both npm packages and GitHub Actions, grouped to reduce PR noise.
- **ESLint** — `eslint:recommended` ruleset with Node.js globals and additional best-practice rules.
- **Prettier** — enforced code formatting via `.prettierrc`.
- **SECURITY.md** — vulnerability reporting policy with response SLAs and responsible disclosure process.
- **CONTRIBUTING.md** — developer setup guide, branch naming convention, and PR checklist.
- **CODE_OF_CONDUCT.md** — Contributor Covenant 2.1.
- **Issue templates** — structured bug report and feature request templates.
- **Pull request template** — checklist for contributors.
- **`npm run lint`**, **`npm run format:check`**, **`npm run test:coverage`** scripts.

### Changed

- Minimum supported Node.js version raised from 16 to 18 (LTS; Node 16 reached end-of-life September 2023).
- `CHANGELOG.md` added to published npm package files.

---

## [1.0.1] - 2026-08-28

### Fixed

- Parked-domain MX patterns corrected to avoid over-blocking legitimate providers.
- Gibberish username detector no longer flags usernames containing 4-digit years (e.g. `john1995`).

---

## [1.0.0] - 2026-08-28

### Added

- Initial release.
- `validateEmail(email)` with offline disposable-domain check (8,400+ domains), live MX/DNS validation, typo-squatting detection, role-address flagging, gibberish username heuristics, and high-risk TLD detection.
- HTTP REST server (`src/server.js`) with `/api/v1/verify` and `/api/v1/check-email` endpoints, built-in rate limiting (60 req/min per IP).
- CLI tool (`bin/cli.js`) — `npx mailgate user@example.com`.
- MIT licence.

[1.1.0]: https://github.com/vikas-6/mailgate/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/vikas-6/mailgate/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/vikas-6/mailgate/releases/tag/v1.0.0
