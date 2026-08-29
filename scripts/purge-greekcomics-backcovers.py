#!/usr/bin/env python3
"""
Remove οπισθόφυλλα rows from greekcomics covers.csv (and optionally delete image files).

  python scripts/purge-greekcomics-backcovers.py
  python scripts/purge-greekcomics-backcovers.py --delete-files
"""
from __future__ import annotations

import argparse
import csv
import importlib.util
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

_spec = importlib.util.spec_from_file_location(
    "ingest_greekcomics_catalog",
    ROOT / "scripts" / "ingest-greekcomics-catalog.py",
)
_ingest = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_ingest)
is_backcover_row = _ingest.is_backcover_row
resolve_csv = _ingest.resolve_csv

COVER_DIRS = [
    ROOT / "data" / "greekcomics_scrape" / "covers",
    Path.home() / "Desktop" / "Αρχειο Ελληνικών Κομικ" / "greekcomics_scrape" / "covers",
]


def cover_file_paths(local_path: str) -> list[Path]:
    rel = local_path.replace("\\", "/").lstrip("/")
    if rel.startswith("covers/"):
        rel = rel[len("covers/") :]
    paths: list[Path] = []
    for base in COVER_DIRS:
        direct = base / rel
        if direct.is_file():
            paths.append(direct)
        flat = base / Path(rel).name
        if flat.is_file() and flat not in paths:
            paths.append(flat)
    return paths


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", help="Path to covers.csv")
    parser.add_argument(
        "--delete-files",
        action="store_true",
        help="Also delete local back-cover image files",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Do not create covers.csv.bak before rewriting",
    )
    args = parser.parse_args()

    csv_path = resolve_csv(args.csv)
    rows: list[dict[str, str]] = []
    removed = 0
    deleted_files = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames or []
        for row in reader:
            if is_backcover_row(row):
                removed += 1
                if args.delete_files:
                    for path in cover_file_paths(str(row.get("local_path") or "")):
                        try:
                            path.unlink()
                            deleted_files += 1
                        except OSError:
                            pass
                continue
            rows.append(row)

    if removed == 0:
        print(f"No back covers found in {csv_path}")
        return

    if not args.no_backup:
        backup = csv_path.with_suffix(csv_path.suffix + ".bak")
        shutil.copy2(csv_path, backup)
        print(f"backup {backup}")

    with csv_path.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    print(
        f"CSV {csv_path}\n"
        f"removed_backcovers={removed} kept_rows={len(rows)} "
        f"deleted_files={deleted_files if args.delete_files else 0}"
    )
    print("Run: npm run ingest:greekcomics")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
