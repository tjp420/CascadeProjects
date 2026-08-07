# Changelog

All notable changes to the simplebeacon CLI package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-08-07

### Patch release from 1.1.1

### Features

- feat: add --format markdown audit report generator for scan command (6eccec285)
- feat: optimize walkAllFiles with concurrent readdir + stat batching
- feat: optimize walkProjectFiles with same concurrent pattern

### Bug Fixes

- fix: harden Stripe webhook endpoints — signature, handlers, tier detection (a258de7db)
- fix: restore SB-FICTION-008 regex to match test expectations (over-tightened regex required articles)

### Maintenance

- chore: add benchmark script for directory walk performance
- chore: add 21 tests for markdown report generation
- chore: add 17 tests for webhook hardening
