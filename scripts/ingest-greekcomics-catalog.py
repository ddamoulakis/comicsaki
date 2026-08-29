#!/usr/bin/env python3
"""
Build a compact Greek catalog JSON from the greekcomics.gr scrape CSV.

Reads front covers only (skips οπισθόφυλλα), one image per title+issue.
Does not copy the 58GB cover folder into the app bundle.

  python scripts/ingest-greekcomics-catalog.py
  python scripts/ingest-greekcomics-catalog.py --csv "C:\\path\\covers.csv"
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "data" / "greekcomics_scrape" / "covers.csv"
DESKTOP_CSV = (
    Path.home()
    / "Desktop"
    / "Αρχειο Ελληνικών Κομικ"
    / "greekcomics_scrape"
    / "covers.csv"
)
OUT_PATH = ROOT / "data" / "greekcomicsCatalog.json"

YEAR_SUFFIX = re.compile(r"\s*\((?:~)?(?:19|20)\d{2}\)\s*$")
YEAR_IN_TEXT = re.compile(r"(?:19|20)\d{2}")
ISSUE_FILE = re.compile(r"_(\d+)([a-z])?$", re.I)
ISSUE_BACK_STEM = re.compile(r"_\d+z$", re.I)

PUBLISHER_MAP = {
    "ANUBIS": "Anubis",
    "JEMMA PRESS": "Jemma Press",
    "POLARIS": "Polaris",
    "GUTENBERG": "Gutenberg",
    "ΑΥΤΟΕΚΔΟΣΗ": "Αυτοέκδοση",
    "ΜΙΚΡΟΣ ΗΡΩΣ": "Μικρός Ήρως",
    "ΜΑΜΟΥΘ": "Μαμούθ Comix",
    "ΜΑΜΟΥΘ COMIX": "Μαμούθ Comix",
    "MAMOUTH": "Μαμούθ Comix",
    "MAMOUTH COMIX": "Μαμούθ Comix",
    "ΟΞΥ": "Οξύ / Brainfood",
    "BRAINFOOD": "Οξύ / Brainfood",
    "ΚΑΚΤΟΣ": "Κάκτος",
    "ΠΑΤΑΚΗ": "Πατάκη",
    "ΜΕΤΑΙΧΜΙΟ": "Μεταίχμιο",
    "ΔΙΟΠΤΡΑ": "Διόπτρα",
    "ΚΑΘΗΜΕΡΙΝΗ": "Καθημερινή",
}


def resolve_csv(cli_path: str | None) -> Path:
    if cli_path:
        path = Path(cli_path)
        if not path.is_file():
            raise SystemExit(f"CSV not found: {path}")
        return path
    for path in (DEFAULT_CSV, DESKTOP_CSV):
        if path.is_file():
            return path
    raise SystemExit(
        "covers.csv not found. Pass --csv or place it at data/greekcomics_scrape/covers.csv"
    )


def clean_title(raw: str) -> str:
    t = (raw or "").strip().strip('"').strip()
    t = YEAR_SUFFIX.sub("", t).strip()
    t = t.lstrip("#").strip()
    t = re.sub(r"\s+", " ", t)
    return t


def parse_year(value: str, title: str) -> int | None:
    text = f"{value} {title}"
    years = [int(y) for y in YEAR_IN_TEXT.findall(text) if 1930 <= int(y) <= 2030]
    return years[0] if years else None


def pretty_publisher(raw: str) -> str:
    p = re.sub(r"\s+", " ", (raw or "").strip())
    if not p:
        return ""
    mapped = PUBLISHER_MAP.get(p.upper())
    if mapped:
        return mapped
    mapped = PUBLISHER_MAP.get(p)
    if mapped:
        return mapped
    return p.title() if p.isascii() and p.isupper() else p


def file_from_local_path(local_path: str, cov_id: str) -> str:
    name = Path(local_path.replace("\\", "/")).name
    prefix = f"{cov_id}_"
    if name.startswith(prefix):
        return name[len(prefix) :]
    return name


def is_backcover_row(row: dict[str, str], cov_id: str = "", filename: str = "") -> bool:
    if str(row.get("is_backcover") or "0").strip() not in {"0", ""}:
        return True
    label = str(row.get("issue_label") or "")
    if re.search(r"οπισθ|back\s*cover|\bbc\b", label, re.I):
        return True
    if not filename:
        cov_id = cov_id or str(row.get("cov_id") or "").strip()
        local_path = str(row.get("local_path") or "").strip()
        filename = file_from_local_path(local_path, cov_id) if local_path else ""
    if filename and ISSUE_BACK_STEM.search(Path(filename).stem):
        return True
    return False


def is_backcover_filename(filename: str) -> bool:
    return bool(filename and ISSUE_BACK_STEM.search(Path(filename).stem))


def cover_rank(filename: str) -> tuple[int, str]:
    stem = Path(filename).stem
    m = ISSUE_FILE.search(stem)
    if m and not m.group(2):
        return (0, filename)
    if m:
        return (1, filename)
    return (2, filename)


def infer_format_code(name: str, issue_count: int) -> str:
    u = name.upper()
    if "GRAPHIC NOVEL" in u:
        return "n"
    if "(ΤΟΜΟΙ)" in u or "ΤΟΜΟΙ)" in u or "ΤΟΜΟΣ" in u or re.search(r"VOL\.?\s*\d", u):
        return "v"
    if re.search(r"ΜΠΛΕΚ|ΜΙΚΥ|ΚΟΜΙΞ|ΚΟΜΙΧ|ΑΛΜΑΝΑΚ", u):
        return "t"
    if issue_count <= 1:
        return "n"
    if issue_count >= 48:
        return "t"
    return "v"


def expected_image_path(cov_id: str, filename: str) -> str:
    folder = (int(cov_id) // 100) * 100
    return f"{folder}/{cov_id}/{filename}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", help="Path to covers.csv")
    parser.add_argument("--out", default=str(OUT_PATH), help="Output JSON path")
    args = parser.parse_args()

    csv_path = resolve_csv(args.csv)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # series[cov_id][issue_number] = best row
    picked: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    series_meta: dict[str, dict[str, str | int | None]] = {}
    rows_in = 0
    skipped_back = 0
    folder_mismatch = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows_in += 1
            cov_id = str(row.get("cov_id") or "").strip()
            local_path = str(row.get("local_path") or "").strip()
            filename = file_from_local_path(local_path, cov_id) if local_path and cov_id else ""
            if is_backcover_row(row, cov_id, filename):
                skipped_back += 1
                continue
            if not cov_id:
                continue
            if not filename:
                continue
            issue = str(row.get("issue_number") or "").strip() or "1"
            image_url = str(row.get("image_url") or "")
            expected = expected_image_path(cov_id, filename)
            if expected not in image_url:
                folder_mismatch += 1

            title_raw = str(row.get("title") or "").strip()
            current = picked[cov_id].get(issue)
            candidate = {
                "cov_id": cov_id,
                "issue": issue,
                "title": title_raw,
                "publisher": str(row.get("publisher") or "").strip(),
                "year": str(row.get("year") or "").strip(),
                "file": filename,
                "gallery_url": str(row.get("gallery_url") or "").strip(),
            }
            if current is None or cover_rank(filename) < cover_rank(current["file"]):
                picked[cov_id][issue] = candidate

            if cov_id not in series_meta:
                name = clean_title(title_raw)
                series_meta[cov_id] = {
                    "name": name or title_raw,
                    "publisher": pretty_publisher(candidate["publisher"]),
                    "year": parse_year(candidate["year"], title_raw),
                    "raw": title_raw,
                    "gallery": candidate["gallery_url"],
                }

    series_out = []
    issue_count = 0
    for cov_id in sorted(picked.keys(), key=lambda x: int(x) if x.isdigit() else x):
        meta = series_meta[cov_id]
        issues = []
        for issue_number, row in sorted(
            picked[cov_id].items(),
            key=lambda kv: (int(kv[0]) if str(kv[0]).isdigit() else 10_000, kv[0]),
        ):
            year = parse_year(row["year"], row["title"])
            item: dict[str, str | int] = {"n": issue_number, "f": row["file"]}
            if year:
                item["y"] = year
            issues.append(item)
            issue_count += 1
        payload: dict[str, object] = {
            "id": cov_id,
            "n": meta["name"],
            "p": meta["publisher"],
            "i": issues,
        }
        if meta["year"]:
            payload["y"] = meta["year"]
        if meta["gallery"]:
            payload["g"] = meta["gallery"]
        payload["fmt"] = infer_format_code(meta["name"] or "", len(issues))
        series_out.append(payload)

    doc = {
        "source": "greekcomics.gr",
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "series": series_out,
    }
    out_path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(
        f"CSV {csv_path}\n"
        f"rows={rows_in} backcovers_skipped={skipped_back} "
        f"series={len(series_out)} issues={issue_count} "
        f"folder_mismatch={folder_mismatch}\n"
        f"wrote {out_path} ({size_mb:.2f} MB)"
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
