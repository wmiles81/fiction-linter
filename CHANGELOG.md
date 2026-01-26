# Change Log

All notable changes to the "fiction-linter" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.3] - 2026-01-26
- Added `NameValidator` to lint character names against the SPE `name_collider.yaml` and entropy budgets.
- Included default SPE resource configuration files in `resources/spe_defaults/`.
- Integrated `js-yaml` for parsing configuration files.

## [0.0.2] - 2026-01-26
- Implemented `PatternLinter` for detecting simpler text patterns (clichés, filter words).
- Added `SPEController` to manage Semantic Physics Engine configuration paths.
- Added support for `fiction-linter.spePath` configuration setting.

## [0.0.1] - 2026-01-26
- Initial release of the Fiction Linter extension.
- Basic extension scaffolding and VS Code integration.