#!/usr/bin/env python3
"""
Validate that every relative markdown link in every *.md in the repo points at
an existing file. External URLs, anchors, and mailto: are skipped.
"""
from __future__ import annotations
import os
import re
import sys
from pathlib import Path

LINK_RE = re.compile(r"\]\(([^)]+)\)")
SKIP_PREFIXES = ("http://", "https://", "mailto:", "#", "tel:")
SKIP_DIRS = {".git", "node_modules", ".next", "dist", ".turbo", ".vercel"}

repo_root = Path(".").resolve()
broken: list[tuple[Path, str, Path]] = []
checked = 0

for md in repo_root.rglob("*.md"):
    if any(part in SKIP_DIRS for part in md.parts):
        continue
    text = md.read_text(encoding="utf-8", errors="replace")
    for match in LINK_RE.finditer(text):
        raw = match.group(1).strip()
        if not raw or raw.startswith(SKIP_PREFIXES):
            continue
        # Strip trailing #anchor and ?query
        target = raw.split("#", 1)[0].split("?", 1)[0]
        if not target:
            continue
        # Resolve relative to the file's directory
        resolved = (md.parent / target).resolve()
        checked += 1
        if not resolved.exists():
            broken.append((md.relative_to(repo_root), raw, resolved))

if broken:
    print(f"❌ {len(broken)} broken link(s) (checked {checked}):")
    for f, link, resolved in broken:
        print(f"  {f} → {link}   (resolves to {resolved})")
    sys.exit(1)

print(f"✓ All {checked} internal markdown links resolve.")
