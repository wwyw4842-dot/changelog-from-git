# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

A single-file CLI tool that generates a structured, emoji-enhanced
`CHANGELOG.md` from a git repository's history. It parses
[Conventional Commits](https://www.conventionalcommits.org/), groups entries by
type, and detects `BREAKING CHANGE:` footers.

## Layout

- `changelog.py` — the entire program. No packages, no submodules.
- `README.md` — user-facing usage and example output.

There are **no dependencies** beyond the Python 3 standard library
(`argparse`, `subprocess`, `re`, `collections`, `datetime`, `typing`). There is
no `requirements.txt`, virtualenv, build step, or package manifest.

## Running

```bash
python3 changelog.py                          # all commits on current branch → stdout
python3 changelog.py --from v1.0.0            # since the v1.0.0 tag
python3 changelog.py --from v1.0.0 --to HEAD  # explicit range
python3 changelog.py --repo /path/to/repo     # target a different repo
python3 changelog.py -o CHANGELOG.md          # write to file instead of stdout
python3 changelog.py --title "My Project"     # custom title (replaces version header)
```

## Code structure (`changelog.py`)

The flow is a straight pipeline; functions are small and independent:

- `run_git(repo, args)` — wraps `git -C <repo> ...` via `subprocess`, exits with
  code 1 on git failure.
- `get_commits(repo, from_ref, to_ref)` — runs `git log` with a custom
  `---COMMIT-END---` delimiter and `%H%n%ai%n%B` format, returns
  `(hash, date, message)` tuples. Merges are excluded (`--no-merges`).
- `parse_commit(message)` — matches the first line against `CONVENTIONAL_RE`,
  returns `(type, scope, description, is_breaking)`. Non-conforming messages
  return an empty type with the raw first line as the description.
- `generate_changelog(...)` — groups parsed commits, builds the markdown
  string. Emits a `### Commits` flat list fallback when no conventional commits
  are found.
- `main()` — argument parsing and output (stdout or `--output` file).

Module-level config worth knowing:

- `CONVENTIONAL_RE` / `BREAKING_RE` — the regexes that define what counts as a
  conventional commit and a breaking-change footer.
- `TYPE_LABELS` — maps commit type → emoji section header.
- `TYPE_ORDER` — controls the order sections appear in the output.

To add or change a commit type: update **all three** of `CONVENTIONAL_RE`'s
type alternation, `TYPE_LABELS`, and `TYPE_ORDER` to keep them in sync.

## Conventions

- Python 3, standard-library only — do not add third-party dependencies without
  a strong reason.
- Type hints on function signatures; module-level constants in `UPPER_SNAKE`.
- This project dogfoods Conventional Commits. Write commit messages as
  `type(scope): description` (e.g. `feat: add --since flag`,
  `fix(parser): handle empty body`) so the tool can categorize its own history.
- No test suite currently exists. If you add behavior, verify manually by
  running `changelog.py` against this repo and eyeballing the output.

## Git workflow for this environment

- Develop on the branch you were assigned for the session; create it locally if
  needed.
- Push with `git push -u origin <branch>`, then open a **draft** PR if one does
  not already exist.
- Use the GitHub MCP tools (`mcp__github__*`) for GitHub operations — the `gh`
  CLI is not available here.
