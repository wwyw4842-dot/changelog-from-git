#!/usr/bin/env python3
"""
Generate a structured CHANGELOG.md from git history.

Parses conventional commits and groups entries by type:
feat → Features, fix → Bug Fixes, refactor → Refactoring, etc.

Usage:
    python3 changelog.py [--from TAG] [--to TAG] [--repo PATH] [--output FILE]

Examples:
    python3 changelog.py                          # all commits on current branch
    python3 changelog.py --from v1.0.0            # since v1.0.0 tag
    python3 changelog.py --from v1.0.0 --to HEAD  # range
    python3 changelog.py --repo /path/to/repo     # different repo
    python3 changelog.py --output CHANGELOG.md    # write to file (default: stdout)
"""

import argparse
import subprocess
import re
import sys
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Tuple

# Conventional commit pattern: type(scope): description
# Also matches BREAKING CHANGE footers
CONVENTIONAL_RE = re.compile(
    r"^(?P<type>feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)"
    r"(?:\((?P<scope>[^)]+)\))?"
    r"(?P<breaking>!)?"
    r":\s+(?P<description>.+)$",
    re.IGNORECASE,
)

BREAKING_RE = re.compile(r"BREAKING\s*CHANGE:\s*(.+)", re.IGNORECASE)

TYPE_LABELS: Dict[str, str] = {
    "feat": "✨ Features",
    "fix": "🐛 Bug Fixes",
    "docs": "📚 Documentation",
    "style": "💄 Styling",
    "refactor": "♻️ Refactoring",
    "perf": "⚡ Performance",
    "test": "✅ Tests",
    "build": "📦 Build System",
    "ci": "👷 CI/CD",
    "chore": "🔧 Chores",
    "revert": "⏪ Reverts",
}

TYPE_ORDER = [
    "feat", "fix", "perf", "refactor", "style",
    "docs", "test", "build", "ci", "chore", "revert",
]


def run_git(repo: str, args: List[str]) -> str:
    """Run a git command and return stdout."""
    cmd = ["git", "-C", repo] + args
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"git error: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    return result.stdout


def get_commits(repo: str, from_ref: str, to_ref: str) -> List[Tuple[str, str, str]]:
    """Get commits as list of (hash, date, message). None date if unparseable."""
    range_spec = f"{from_ref}..{to_ref}" if from_ref else "HEAD"
    output = run_git(
        repo,
        [
            "log",
            range_spec,
            "--no-merges",
            "--format=%H%n%ai%n%B%n---COMMIT-END---",
        ],
    )
    commits = []
    for block in output.split("---COMMIT-END---"):
        block = block.strip()
        if not block:
            continue
        lines = block.split("\n")
        if len(lines) < 2:
            continue
        commit_hash = lines[0].strip()
        date_str = lines[1].strip()
        message = "\n".join(lines[2:]).strip()
        try:
            date = datetime.fromisoformat(date_str).strftime("%Y-%m-%d")
        except ValueError:
            date = "unknown"
        commits.append((commit_hash, date, message))
    return commits


def parse_commit(message: str) -> Tuple[str, str, str, bool]:
    """Parse a conventional commit message. Returns (type, scope, description, is_breaking)."""
    first_line = message.split("\n")[0].strip()

    # Check for breaking change in footer
    breaking = bool(BREAKING_RE.search(message))

    m = CONVENTIONAL_RE.match(first_line)
    if not m:
        return ("", "", first_line, breaking)

    commit_type = m.group("type").lower()
    scope = m.group("scope") or ""
    description = m.group("description")

    if m.group("breaking"):
        breaking = True

    return (commit_type, scope, description, breaking)


def generate_changelog(
    repo: str,
    from_ref: str,
    to_ref: str,
    title: str = None,
) -> str:
    """Generate a full CHANGELOG as a markdown string."""
    commits = get_commits(repo, from_ref, to_ref)
    if not commits:
        return "No commits found.\n"

    # Group by type
    groups: Dict[str, List[Tuple[str, str, str]]] = defaultdict(list)
    breaking_changes: List[str] = []

    for commit_hash, date, message in commits:
        commit_type, scope, description, is_breaking = parse_commit(message)
        if is_breaking:
            breaking_changes.append(
                f"- **{scope + ': ' if scope else ''}** {description} ({commit_hash[:7]})"
            )
        if commit_type in TYPE_LABELS:
            groups[commit_type].append((commit_hash[:7], date, scope, description))

    # Build output
    lines: List[str] = []

    # Title
    if title:
        lines.append(f"# {title}\n")
    else:
        version = to_ref.lstrip("v") if to_ref else "Unreleased"
        date_str = datetime.now().strftime("%Y-%m-%d")
        lines.append(f"## [{version}] - {date_str}\n")

    # Breaking changes section
    if breaking_changes:
        lines.append("### ⚠️ BREAKING CHANGES\n")
        for bc in breaking_changes:
            lines.append(bc)
        lines.append("")

    # Grouped entries
    for commit_type in TYPE_ORDER:
        entries = groups.get(commit_type, [])
        if not entries:
            continue
        lines.append(f"### {TYPE_LABELS[commit_type]}\n")
        for short_hash, date, scope, desc in entries:
            scope_str = f"**{scope}:** " if scope else ""
            lines.append(f"- {scope_str}{desc} ({short_hash})")
        lines.append("")

    if not groups and not breaking_changes:
        # No conventional commits found — list all commits flat
        lines.append("### Commits\n")
        for short, date, message in commits:
            first_line = message.split("\n")[0].strip()
            lines.append(f"- {first_line} ({short[:7]})")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Generate structured CHANGELOG from git history"
    )
    parser.add_argument("--from", dest="from_ref", default="", help="Starting ref/tag")
    parser.add_argument("--to", dest="to_ref", default="HEAD", help="Ending ref/tag (default: HEAD)")
    parser.add_argument("--repo", default=".", help="Path to git repository (default: .)")
    parser.add_argument("--output", "-o", help="Output file (default: stdout)")
    parser.add_argument("--title", help="Custom changelog title")
    args = parser.parse_args()

    changelog = generate_changelog(
        repo=args.repo,
        from_ref=args.from_ref,
        to_ref=args.to_ref,
        title=args.title,
    )

    if args.output:
        with open(args.output, "w") as f:
            f.write(changelog)
        print(f"Changelog written to {args.output}", file=sys.stderr)
    else:
        print(changelog)


if __name__ == "__main__":
    main()
