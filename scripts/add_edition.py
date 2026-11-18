#!/usr/bin/env python3
"""Validate edition files and rebuild editions/index.json.

Usage:
  python3 scripts/add_edition.py                 # validate all editions, rebuild manifest
  python3 scripts/add_edition.py path/to/new.json  # copy a new edition in first, then do the above

The site reads editions/index.json to list editions, so never edit that file
by hand: it is regenerated from the edition files every time this runs.
Exits non-zero (and changes nothing) if any edition fails validation.
"""
import datetime
import json
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
EDITIONS = ROOT / "editions"
MANIFEST = EDITIONS / "index.json"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TAG_TYPES = {"frontier", "enterprise", "security", "policy", "economics", "analytics"}
REQUIRED = ["date", "number", "title", "subtitle", "intro", "items", "reflection", "questions", "colophon"]
GENERIC_PATHS = {"", "/", "/news", "/news/", "/blog", "/blog/", "/newsroom", "/newsroom/"}


def check_url(url, where, errors):
    try:
        p = urlparse(url)
    except ValueError:
        errors.append(f"{where}: unparsable URL {url!r}")
        return
    if p.scheme != "https" or not p.netloc:
        errors.append(f"{where}: URL must be https with a host: {url!r}")
    elif p.path in GENERIC_PATHS and not p.query:
        errors.append(f"{where}: URL looks like a homepage or index, not a specific article: {url!r}")


def validate(path):
    errors = []
    try:
        ed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        return None, [f"{path.name}: not valid JSON ({e})"]
    if not isinstance(ed, dict):
        return None, [f"{path.name}: top level must be an object"]

    for key in REQUIRED:
        if key not in ed:
            errors.append(f"{path.name}: missing field {key!r}")
    date = ed.get("date", "")
    if not DATE_RE.match(str(date)):
        errors.append(f"{path.name}: date must be YYYY-MM-DD")
    elif path.stem != date:
        errors.append(f"{path.name}: file name must equal the date ({date}.json)")
    else:
        if datetime.date.fromisoformat(date) > datetime.date.today() + datetime.timedelta(days=1):
            errors.append(f"{path.name}: date is in the future")
    if not isinstance(ed.get("number"), int) or ed.get("number", 0) < 1:
        errors.append(f"{path.name}: number must be a positive integer")

    items = ed.get("items") or []
    if not (4 <= len(items) <= 7):
        errors.append(f"{path.name}: expected 4-7 items, found {len(items)}")
    for i, it in enumerate(items, 1):
        where = f"{path.name} item {i}"
        for key in ("tag", "tagType", "title", "news", "why", "sources"):
            if not it.get(key):
                errors.append(f"{where}: missing {key!r}")
        if it.get("tagType") and it["tagType"] not in TAG_TYPES:
            errors.append(f"{where}: unknown tagType {it['tagType']!r}")
        srcs = it.get("sources") or []
        if not (1 <= len(srcs) <= 3):
            errors.append(f"{where}: needs 1-3 sources, found {len(srcs)}")
        for s in srcs:
            if not s.get("label"):
                errors.append(f"{where}: source without label")
            check_url(s.get("url", ""), where, errors)
    return ed, errors


def main(argv):
    if len(argv) > 1:
        src = Path(argv[1])
        ed, errs = validate(src)
        if errs:
            print("\n".join(errs))
            return 1
        dest = EDITIONS / f"{ed['date']}.json"
        if dest.exists() and dest.resolve() != src.resolve():
            print(f"{dest.name} already exists; refusing to overwrite")
            return 1
        if dest.resolve() != src.resolve():
            shutil.copyfile(src, dest)

    entries, all_errors, numbers = [], [], {}
    for path in sorted(EDITIONS.glob("????-??-??.json")):
        ed, errs = validate(path)
        all_errors += errs
        if ed is None:
            continue
        n = ed.get("number")
        if n in numbers:
            all_errors.append(f"{path.name}: number {n} also used by {numbers[n]}")
        numbers[n] = path.name
        entries.append({"date": ed.get("date"), "number": n, "title": ed.get("title", "")})

    if all_errors:
        print("\n".join(all_errors))
        return 1
    entries.sort(key=lambda e: e["date"], reverse=True)
    MANIFEST.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"OK: {len(entries)} editions, manifest rebuilt")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
