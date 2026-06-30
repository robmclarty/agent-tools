# Changelog

All notable changes to this marketplace catalog are documented here.

This project uses [Semantic Versioning](https://semver.org/). The version tracks
the catalog itself — each listed plugin is versioned independently in its own
repository or npm package.

## 0.1.1

- Correct `plumbbob` source from github to npm (it ships a compiled CLI)
- Add MIT `LICENSE` for the catalog repo
- Add `scripts/validate-marketplace.sh` and a GitHub Actions workflow validating manifest structure and source reachability

## 0.1.0

- Initial marketplace catalog with `plumbbob` (npm) and `trellis` (github) plugins
- Add `/version` skill to bump the catalog version and update this changelog
