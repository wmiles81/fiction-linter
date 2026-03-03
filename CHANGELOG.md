# Change Log

All notable changes to the "fiction-linter" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.1] - 2026-02-06
### Fixed
- **Engine Compatibility**: Relaxed VS Code engine requirement to `^1.95.0` to support current stable versions.
- **Network Stability**: Migrated from legacy `https` module to modern `fetch` API for reliable model communication.

## [1.0.0] - 2026-02-01
### Added
- **Official Release**: Marking the extension as stable version 1.0.0.
- **AI Model Management**: Complete integration of secure API key storage and dynamic model fetching.
- **Refined Scanner**: Improved AI scanner with chapter-constrained analysis and smart cancellation.

## [0.1.7] - 2026-02-01
### Added
- **AI Model Management View**: New Activity Bar view to manage AI models.
- **Support for OpenRouter**: Select models from OpenRouter (Claude, Llama, etc.).
- **Secure API Key Storage**: API keys are now stored in secure storage instead of settings.
- **Dynamic Model Fetching**: Automatically lists available models from the selected provider.

## [0.1.5] - 2026-01-31
### Added
- **AI Scan Button**: New status bar button (`$(search) AI Scan`) to trigger a deep AI analysis of the current document.
- **Chapter Detection**: The scanner now intelligently detects the current chapter based on cursor position (`## Chapter X`) and limits the scan to that chapter.
- **Progressive Scanning**: Scans are performed in small chunks (default 5 paragraphs) to provide immediate feedback and allow cancellation.
- **Smart Cancellation**: Click the scan button again (`$(sync~spin) Stop Scan`) to instantly cancel an active scan.

### Fixed
- **Activation**: Fixed extension not activating automatically when opening Markdown files.
- **Scope Safety**: Prevented the scanner from accidentally scanning the Output panel or non-text files.

## [0.1.0] - 2026-01-27
### Changed
- **Performance**: Optimized Pattern Linter to use O(1) matching via Regex caching (was O(N*M)).
- **Stability**: Added debounce (500ms) to the main lint loop to prevent editor freezing.
- **Dependencies**: Removed 'antigravity' dependencies from package.json to fix installation issues.
- **Docs**: Updated README with AI feature documentation and configuration.

## [0.0.6] - 2026-01-27
### Added
- **Global Toggle**: Added a Status Bar item (`$(eye)`) and command `fiction-linter.toggle` to instantly enable/disable all linting.
- **Config Setting**: Added `fiction-linter.enabled` setting.

## [0.0.5] - 2026-01-27
- **Dialogue Exclusion**: Added `exclude_dialogue` configuration in `cliche_collider.yaml` to ignore specific patterns inside quotes.
- **Simile Detection**: Added blue-squiggle detection for similes ("like a", "as a").
- **Simile Counting**: Hover text for similes now displays the total count of similes in the document.

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
