# Changelog Generator

Generate structured, emoji-enhanced CHANGELOG.md from git conventional commits.

## Usage

```bash
# Generate changelog for current repo
python3 changelog.py

# Generate since a tag
python3 changelog.py --from v1.0.0

# Write to file
python3 changelog.py --from v1.0.0 --to v2.0.0 -o CHANGELOG.md

# Custom title
python3 changelog.py --title "My Project v2.0.0"
```

## Features

- Parses [Conventional Commits](https://www.conventionalcommits.org/)
- Groups by type: Features, Bug Fixes, Docs, Refactoring, etc.
- Detects `BREAKING CHANGE:` footers
- Emoji section headers
- Scope support: `feat(cli): ...` renders as `**cli:** ...`
- Short commit hash links

## Example Output

```markdown
## [v2.0.0] - 2026-05-14

### ✨ Features

- **cli:** add --version flag (61b3887)

### 🐛 Bug Fixes

- resolve remaining ESLint warnings (499da66)

### ♻️ Refactoring

- extract FormatButton subcomponent (617979c)
```
