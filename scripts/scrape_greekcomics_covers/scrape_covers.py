#!/usr/bin/env python3
"""
Scrape greekcomics.gr GC Covers -> CSV + downloaded cover images.

Site structure (after login):
  1) Title index:
     https://www.greekcomics.gr/forums/index.php?app=covers&controller=covers&kind=0
     -> rows with title, publisher, cov_id
  2) Cover gallery per title:
     ...?app=covers&cov_id=<ID>&page=<N>
     -> lightbox anchors to chimage.php?image=... with data-caption="Issue ..."

Persistent Chromium profile keeps your login.

Setup
-----
  cd scripts/scrape_greekcomics_covers
  python -m venv .venv
  .\\.venv\\Scripts\\activate
  pip install -r requirements.txt
  playwright install chromium

  python scrape_covers.py --login          # sign in once in the opened window
  python scrape_covers.py --max-titles 3   # smoke test
  python scrape_covers.py                  # full scrape (resume-safe)

Optional env auto-login: GC_EMAIL / GC_PASSWORD
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

from playwright.sync_api import BrowserContext, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "data" / "greekcomics_scrape"
COVERS_DIR = OUT_DIR / "covers"
PROFILE_DIR = OUT_DIR / "browser_profile"
DEBUG_DIR = OUT_DIR / "debug"
CSV_PATH = OUT_DIR / "covers.csv"
TITLES_PATH = OUT_DIR / "titles.json"

BASE = "https://www.greekcomics.gr"
FORUMS = f"{BASE}/forums/index.php"
LOGIN_URL = f"{FORUMS}?/login/"
INDEX_URL = f"{FORUMS}?app=covers&controller=covers&kind={{kind}}"
GALLERY_URL = f"{FORUMS}?app=covers&cov_id={{cov_id}}&page={{page}}"

CSV_FIELDS = [
    "id",
    "cov_id",
    "title",
    "publisher",
    "year",
    "issue_label",
    "issue_number",
    "is_backcover",
    "kind",
    "gallery_url",
    "image_url",
    "thumb_url",
    "local_path",
    "scraped_at",
]


@dataclass
class TitleRow:
    cov_id: str
    title: str
    publisher: str = ""
    year: str = ""
    issue_list_url: str = ""
    gallery_url: str = ""
    range_label: str = ""


@dataclass
class CoverRow:
    id: str
    cov_id: str
    title: str = ""
    publisher: str = ""
    year: str = ""
    issue_label: str = ""
    issue_number: str = ""
    is_backcover: str = "0"
    kind: str = "0"
    gallery_url: str = ""
    image_url: str = ""
    thumb_url: str = ""
    local_path: str = ""
    scraped_at: str = ""

    def to_csv(self) -> dict[str, str]:
        return {k: getattr(self, k) for k in CSV_FIELDS}


def ensure_dirs() -> None:
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)


def abs_url(url: str, base: str = FORUMS) -> str:
    if not url:
        return ""
    if url.startswith("http"):
        return url
    if url.startswith("/"):
        return BASE + url
    if url.startswith("chimage.php"):
        return f"{BASE}/forums/{url}"
    return f"{BASE}/forums/{url.lstrip('./')}"


def parse_year(title: str) -> str:
    m = re.search(r"\((19|20)\d{2}\)", title)
    return m.group(0).strip("()") if m else ""


def parse_issue_bits(caption: str) -> tuple[str, str, str]:
    """Return (label, number, is_backcover)."""
    label = (caption or "").strip()
    back = "1" if re.search(r"οπισθ|back\s*cover|bc\b", label, re.I) else "0"
    m = re.search(r"(\d{1,4})", label)
    num = m.group(1) if m else ""
    return label, num, back


def cover_id(cov_id: str, image_url: str, caption: str) -> str:
    # Prefer filename stem from chimage.php?image=1200/1253/Feugates_0001.jpg
    m = re.search(r"image=([^&]+)", image_url)
    if m:
        stem = Path(m.group(1)).stem
        stem = re.sub(r"^tn_", "", stem)
        return f"{cov_id}_{stem}"
    slug = re.sub(r"[^\w\-]+", "_", caption.strip())[:40] or "cover"
    return f"{cov_id}_{slug}"


def load_done_ids(csv_path: Path) -> set[str]:
    if not csv_path.exists():
        return set()
    done: set[str] = set()
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("id"):
                done.add(row["id"])
    return done


def append_csv(row: CoverRow) -> None:
    write_header = not CSV_PATH.exists()
    with CSV_PATH.open("a", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        if write_header:
            w.writeheader()
        w.writerow(row.to_csv())


def is_covers_accessible(page: Page) -> bool:
    title = page.title().lower()
    html = page.content().lower()
    if "permission" in title or "don't have permission" in html or "δεν έχεις δικαίωμα" in html:
        return False
    if "sign in" in title and "/login" in page.url:
        return False
    return "cov_id=" in html or "λίστα κυκλοφορίας" in html or "greekcomics covers" in html


def try_auto_login(page: Page, email: str, password: str) -> bool:
    page.goto(LOGIN_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(800)
    email_sel = 'input[name="auth"], input[name="email"], input[type="email"], input[placeholder*="Email" i]'
    pass_sel = 'input[name="password"], input[type="password"]'
    if page.locator(email_sel).count() == 0:
        return False
    page.fill(email_sel, email)
    page.fill(pass_sel, password)
    remember = page.locator('input[name="rememberMe"], input[name="remember_me"]')
    if remember.count():
        try:
            remember.first.check(force=True)
        except Exception:
            pass
    page.locator('button[type="submit"], input[type="submit"], button:has-text("Sign In")').first.click()
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(1500)
    return "login" not in page.url.lower()


def ensure_login(page: Page, *, interactive: bool = True) -> None:
    email = os.environ.get("GC_EMAIL", "").strip()
    password = os.environ.get("GC_PASSWORD", "").strip()

    page.goto(INDEX_URL.format(kind="0"), wait_until="domcontentloaded")
    page.wait_for_timeout(1200)
    if is_covers_accessible(page):
        print("Session OK - covers accessible.")
        return

    if email and password:
        print("Trying auto-login from GC_EMAIL / GC_PASSWORD ...")
        if try_auto_login(page, email, password):
            page.goto(INDEX_URL.format(kind="0"), wait_until="domcontentloaded")
            page.wait_for_timeout(1000)
            if is_covers_accessible(page):
                print("Auto-login succeeded.")
                return
        print("Auto-login failed - falling back to manual login.")

    if not interactive:
        raise SystemExit("Not logged in. Run: python scrape_covers.py --login")

    print("\n=== MANUAL LOGIN ===")
    print("1) Στο παράθυρο Chromium πάτα Sign In")
    print("2) Βάλε email + password του greekcomics.gr")
    print("3) Περίμενε - το script θα εντοπίσει μόνο του όταν μπεις.\n")
    page.goto(LOGIN_URL, wait_until="domcontentloaded")

    deadline = time.time() + 600  # 10 minutes
    while time.time() < deadline:
        page.wait_for_timeout(3000)
        try:
            # If still on login, keep waiting; otherwise probe covers
            if "/login" in page.url.lower() or "sign in" in page.title().lower():
                print("... ακόμα στο login, περιμένω")
                continue
            page.goto(INDEX_URL.format(kind="0"), wait_until="domcontentloaded")
            page.wait_for_timeout(1200)
            if is_covers_accessible(page):
                print("Login confirmed - covers accessible.")
                return
            print("... συνδέθηκες αλλά όχι ακόμα πρόσβαση στα covers, ξαναδοκιμάζω")
        except Exception as e:
            print(f"... waiting ({e})")

    raise SystemExit("Timeout: δεν εντοπίστηκε login σε 10 λεπτά.")


def parse_titles_from_html(html: str, kind: str = "0") -> list[TitleRow]:
    """Parse the huge covers index HTML without slow DOM walks."""
    titles: list[TitleRow] = []
    seen: set[str] = set()

    # Each title block has an issueList link with cov_id
    for m in re.finditer(
        r'href="([^"]*controller=issueList[^"]*cov_id=(\d+)[^"]*)"',
        html,
        flags=re.I,
    ):
        href_raw, cov_id = m.group(1), m.group(2)
        if cov_id in seen:
            continue
        seen.add(cov_id)

        # Look at a window before this link for title + publisher anchors
        start = max(0, m.start() - 1200)
        window = html[start : m.start()]

        links = re.findall(
            r'href="([^"]+)"[^>]*>(.*?)</a>',
            window,
            flags=re.I | re.S,
        )
        title = ""
        publisher = ""
        for href, inner in links:
            text = re.sub(r"<[^>]+>", "", inner)
            text = re.sub(r"\s+", " ", text).strip()
            if not text or re.search(r"λίστα κυκλοφορίας", text, re.I):
                continue
            href_n = href.replace("&amp;", "&")
            if "controller=publishers" in href_n:
                publisher = text
                continue
            if "cov_id=" in href_n:
                continue
            if len(text) > 1:
                title = text

        if not title:
            # Fallback: strip tags from end of window
            chunk = re.sub(r"<[^>]+>", " ", window)
            chunk = re.sub(r"\s+", " ", chunk).strip()
            title = chunk[-180:]

        year = parse_year(title)
        issue_list_url = abs_url(href_raw.replace("&amp;", "&"))
        gallery_url = GALLERY_URL.format(cov_id=cov_id, page=1)

        # Optional range label after the issueList link
        after = html[m.end() : m.end() + 400]
        range_m = re.search(r">(\[[^\]]+\])</a>", after)
        range_label = range_m.group(1) if range_m else ""

        titles.append(
            TitleRow(
                cov_id=cov_id,
                title=title,
                publisher=publisher,
                year=year,
                issue_list_url=issue_list_url,
                gallery_url=gallery_url,
                range_label=range_label,
            )
        )

    return titles


def scrape_titles(page: Page, kind: str) -> list[TitleRow]:
    url = INDEX_URL.format(kind=kind)
    print(f"Loading title index: {url}", flush=True)
    # Huge page - don't wait for full load/networkidle
    page.goto(url, wait_until="commit", timeout=300000)
    print("Waiting for title links...", flush=True)
    page.wait_for_selector(
        'a[href*="controller=issueList"][href*="cov_id="]',
        timeout=300000,
    )
    # Give the rest of the list a moment to stream in
    page.wait_for_timeout(3000)
    if not is_covers_accessible(page):
        raise SystemExit("Cannot read title index - login required.")

    print("Reading HTML...", flush=True)
    html = page.content()
    (DEBUG_DIR / f"index_kind{kind}.html").write_text(html, encoding="utf-8")
    print(f"HTML size: {len(html):,} bytes - parsing...", flush=True)

    titles = parse_titles_from_html(html, kind=kind)
    TITLES_PATH.write_text(
        json.dumps([t.__dict__ for t in titles], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Found {len(titles)} titles -> {TITLES_PATH}", flush=True)
    return titles


EXTRACT_GALLERY_JS = r"""
() => {
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return u || ''; } };
  const bodyText = document.body.innerText || '';

  let title = '';
  let publisher = '';
  const pubMatch = bodyText.match(/Publisher:\s*([^\n]+)/i);
  if (pubMatch) publisher = pubMatch[1].replace(/\s+/g, ' ').trim();

  const yearLine = bodyText.split('\n').map(s => s.trim()).find(s => /\((19|20)\d{2}\)/.test(s) && s.length < 200);
  if (yearLine) title = yearLine;

  const covers = [];
  const seen = new Set();
  for (const a of Array.from(document.querySelectorAll('a[data-ipslightbox], a[href*="chimage.php"]'))) {
    const href = abs(a.getAttribute('href') || '');
    if (!/chimage\.php/i.test(href)) continue;
    let imageUrl = href;
    if (/[?&]image=[^&]*tn_/i.test(imageUrl)) {
      imageUrl = imageUrl.replace(/([?&]image=[^&]*)tn_/, '$1');
    }
    const img = a.querySelector('img');
    const thumb = abs(img?.getAttribute('src') || '');
    const caption = (a.getAttribute('data-caption') || img?.getAttribute('alt') || a.getAttribute('title') || '').trim();
    if (seen.has(imageUrl)) continue;
    seen.add(imageUrl);
    covers.push({ imageUrl, thumbUrl: thumb, caption });
  }

  const pages = new Set();
  for (const a of Array.from(document.querySelectorAll('a[href*="cov_id="][href*="page="]'))) {
    const m = (a.getAttribute('href') || '').match(/page=(\d+)/i);
    if (m) pages.add(Number(m[1]));
  }

  return { title, publisher, covers, pages: Array.from(pages).sort((a,b)=>a-b), url: location.href };
}
"""


def download_image(page: Page, image_url: str, dest_stem: Path) -> Path | None:
    if not image_url:
        return None
    url = abs_url(image_url)
    try:
        resp = page.request.get(url, timeout=90000)
        if not resp.ok:
            print(f"  ! image HTTP {resp.status}: {url}")
            return None
        ctype = (resp.headers.get("content-type") or "").lower()
        ext = ".jpg"
        if "png" in ctype or url.lower().endswith(".png"):
            ext = ".png"
        elif "webp" in ctype:
            ext = ".webp"
        elif "gif" in ctype:
            ext = ".gif"
        out = dest_stem.with_suffix(ext)
        out.write_bytes(resp.body())
        return out
    except Exception as e:
        print(f"  ! download failed: {e}")
        return None


def scrape_gallery_pages(
    page: Page,
    title: TitleRow,
    *,
    kind: str,
    done: set[str],
    delay: float,
) -> int:
    added = 0
    page_num = 1
    seen_pages: set[int] = set()
    publisher = title.publisher
    series_title = title.title
    year = title.year

    while page_num and page_num not in seen_pages:
        seen_pages.add(page_num)
        url = GALLERY_URL.format(cov_id=title.cov_id, page=page_num)
        page.goto(url, wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(600)
        data = page.evaluate(EXTRACT_GALLERY_JS)

        if data.get("title"):
            series_title = data["title"]
            if not year:
                year = parse_year(series_title)
        if data.get("publisher"):
            publisher = data["publisher"]

        covers = data.get("covers") or []
        print(f"  cov_id={title.cov_id} page={page_num}: {len(covers)} covers - {series_title[:60]}")

        for c in covers:
            image_url = abs_url(c.get("imageUrl") or "")
            thumb_url = abs_url(c.get("thumbUrl") or "")
            caption = c.get("caption") or ""
            label, num, back = parse_issue_bits(caption)
            cid = cover_id(title.cov_id, image_url, caption)
            if cid in done:
                continue

            row = CoverRow(
                id=cid,
                cov_id=title.cov_id,
                title=series_title,
                publisher=publisher,
                year=year,
                issue_label=label,
                issue_number=num,
                is_backcover=back,
                kind=str(kind),
                gallery_url=url,
                image_url=image_url,
                thumb_url=thumb_url,
                scraped_at=time.strftime("%Y-%m-%dT%H:%M:%S"),
            )
            saved = download_image(page, image_url, COVERS_DIR / cid)
            if saved:
                row.local_path = str(saved.relative_to(OUT_DIR)).replace("\\", "/")
            append_csv(row)
            done.add(cid)
            added += 1
            time.sleep(delay)

        pages = data.get("pages") or []
        nxt = None
        for p in pages:
            if p not in seen_pages:
                nxt = p
                break
        page_num = nxt if nxt else 0

    return added


def run_inspect(page: Page, kind: str) -> None:
    titles = scrape_titles(page, kind)
    sample = titles[:5]
    (DEBUG_DIR / "titles_sample.json").write_text(
        json.dumps([t.__dict__ for t in sample], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    if not sample:
        print("No titles found.")
        return
    t0 = sample[0]
    page.goto(t0.gallery_url or GALLERY_URL.format(cov_id=t0.cov_id, page=1), wait_until="domcontentloaded")
    page.wait_for_timeout(800)
    gallery = page.evaluate(EXTRACT_GALLERY_JS)
    (DEBUG_DIR / "gallery_sample.json").write_text(
        json.dumps(gallery, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DEBUG_DIR / "gallery_sample.html").write_text(page.content(), encoding="utf-8")
    print(f"Sample title: {t0.title} (cov_id={t0.cov_id})")
    print(f"Gallery covers: {len(gallery.get('covers') or [])}")
    for c in (gallery.get("covers") or [])[:5]:
        print(" -", c.get("caption"), c.get("imageUrl"))


def run_scrape(
    page: Page,
    *,
    kind: str,
    max_titles: int | None,
    delay: float,
    start_cov: str | None,
    from_index: int = 0,
) -> None:
    done = load_done_ids(CSV_PATH)
    print(f"Resume: {len(done)} covers already in CSV")

    titles = scrape_titles(page, kind)
    total_titles = len(titles)
    if start_cov:
        titles = [t for t in titles if int(t.cov_id) >= int(start_cov)]
    if from_index > 0:
        titles = titles[from_index:]
        print(f"Skipping first {from_index} titles -> remaining {len(titles)}")
    if max_titles is not None:
        titles = titles[:max_titles]

    total_new = 0
    for i, t in enumerate(titles, 1):
        idx = from_index + i
        print(f"\n[{idx}/{total_titles}] {t.cov_id} - {t.title[:70]}")
        try:
            total_new += scrape_gallery_pages(page, t, kind=kind, done=done, delay=delay)
        except Exception as e:
            print(f"  ! failed cov_id={t.cov_id}: {e}")
            (DEBUG_DIR / f"error_{t.cov_id}.txt").write_text(str(e), encoding="utf-8")
        time.sleep(delay)

    print(f"\nDone. New covers: {total_new}. CSV: {CSV_PATH}")


def open_context(headless: bool) -> tuple[Any, BrowserContext]:
    ensure_dirs()
    pw = sync_playwright().start()
    context = pw.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        headless=headless,
        viewport={"width": 1400, "height": 900},
        locale="el-GR",
        accept_downloads=True,
        args=["--disable-blink-features=AutomationControlled"],
    )
    return pw, context


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape greekcomics.gr covers -> CSV + images")
    parser.add_argument("--login", action="store_true", help="Open browser and authenticate")
    parser.add_argument("--inspect", action="store_true", help="Dump sample titles + gallery JSON")
    parser.add_argument("--kind", default="0", help="Index kind= (default 0)")
    parser.add_argument("--max-titles", type=int, default=None, help="Only first N titles")
    parser.add_argument("--from-index", type=int, default=0, help="Skip first N titles (0-based resume)")
    parser.add_argument("--start-cov", default=None, help="Skip titles with cov_id < this")
    parser.add_argument("--delay", type=float, default=0.25, help="Delay between requests")
    parser.add_argument("--headless", action="store_true", help="Headless after login exists")
    args = parser.parse_args()

    ensure_dirs()
    headless = bool(args.headless) and not args.login
    pw, context = open_context(headless=headless)
    try:
        page = context.pages[0] if context.pages else context.new_page()
        ensure_login(page, interactive=True)

        extra = [a for a in sys.argv[1:] if a not in ("--login", "--headless")]
        if args.login and not args.inspect and not extra:
            print(f"Profile saved at {PROFILE_DIR}")
            print("Next: python scrape_covers.py --inspect")
            return

        if args.inspect:
            run_inspect(page, args.kind)
            return

        run_scrape(
            page,
            kind=args.kind,
            max_titles=args.max_titles,
            delay=args.delay,
            start_cov=args.start_cov,
            from_index=args.from_index,
        )
    finally:
        context.close()
        pw.stop()


if __name__ == "__main__":
    main()
