# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`changelog.py` is a standalone Python 3 script (no third-party dependencies) that reads a git repository's commit history and generates a structured, emoji-enhanced `CHANGELOG.md` using the [Conventional Commits](https://www.conventionalcommits.org/) spec.

## Running the Script

```bash
# All commits on current branch → stdout
python3 changelog.py

# Since a tag
python3 changelog.py --from v1.0.0

# Range, write to file
python3 changelog.py --from v1.0.0 --to v2.0.0 -o CHANGELOG.md

# Custom title, different repo
python3 changelog.py --repo /path/to/repo --title "My Project v2.0.0"
```

There are no tests, no build step, and no linter configured. The script runs directly with the system Python 3.

## Architecture

All logic lives in `changelog.py` as four sequential stages:

1. **`get_commits`** — calls `git log` with a `---COMMIT-END---` separator and parses raw output into `(hash, date, message)` tuples.
2. **`parse_commit`** — matches each commit's first line against `CONVENTIONAL_RE` and its body against `BREAKING_RE`. Returns `(type, scope, description, is_breaking)`. Non-matching commits return an empty type and are silently skipped in grouping (but shown flat if *no* conventional commits exist at all).
3. **`generate_changelog`** — groups parsed commits into a `defaultdict` keyed by type, then renders markdown in the order defined by `TYPE_ORDER`. Breaking changes get their own `⚠️ BREAKING CHANGES` section at the top.
4. **`main`** — argparse entry point; writes to stdout or a file.

## Key Conventions

- `TYPE_ORDER` controls section rendering order and must stay in sync with `TYPE_LABELS`. Adding a new commit type requires updating both constants.
- Commit type matching is **case-insensitive** (`re.IGNORECASE`), but is stored lowercase.
- Breaking changes are detected two ways: a `!` after the type (`feat!:`) or a `BREAKING CHANGE:` line anywhere in the commit body. Both set `is_breaking=True`.
- The `--from` ref is **exclusive** (git range `from..to`); omitting it means all commits reachable from `--to` (default `HEAD`).
- The git subprocess exits the whole script on non-zero return code (`sys.exit(1)`).
