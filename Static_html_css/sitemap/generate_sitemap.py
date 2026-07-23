#!/usr/bin/env python3
"""Generate sitemap-data.js by scanning all HTML files in Static_html_css.

Run from any directory:
    python Static_html_css/sitemap/generate_sitemap.py

The script uses only Python's standard library. It discovers pages and internal
HTML links automatically, so newly added pages are included without editing the
sitemap by hand.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

SITE_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_FILE = Path(__file__).resolve().with_name("sitemap-data.js")
EXCLUDED_DIRS = {".git", "node_modules", "__pycache__"}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.h1_parts: list[str] = []
        self.description = ""
        self.links: list[dict[str, str]] = []
        self._in_title = False
        self._in_h1 = False
        self._current_link: dict[str, str] | None = None
        self._link_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): value or "" for key, value in attrs}
        tag = tag.lower()
        if tag == "title":
            self._in_title = True
        elif tag == "h1" and not self.h1_parts:
            self._in_h1 = True
        elif tag == "meta" and attributes.get("name", "").lower() == "description":
            self.description = attributes.get("content", "").strip()
        elif tag == "a" and attributes.get("href"):
            self._current_link = {
                "href": attributes["href"].strip(),
                "class": attributes.get("class", ""),
            }
            self._link_text = []

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "title":
            self._in_title = False
        elif tag == "h1":
            self._in_h1 = False
        elif tag == "a" and self._current_link is not None:
            text = re.sub(r"\s+", " ", "".join(self._link_text)).strip()
            self._current_link["text"] = text or "Open page"
            self.links.append(self._current_link)
            self._current_link = None
            self._link_text = []

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
        if self._in_h1:
            self.h1_parts.append(data)
        if self._current_link is not None:
            self._link_text.append(data)


def clean_text(parts: list[str]) -> str:
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def friendly_module(path: Path) -> str:
    first = path.parts[0] if len(path.parts) > 1 else "Shared"
    names = {
        "homepage": "Home",
        "shopping_cart": "Marketplace & Shopping",
        "Product_Review_Rating": "Reviews & Ratings",
        "Blog": "Blog",
        "discuss_forum": "Discussion Forum",
        "user_account": "User Account",
        "admin": "Administration",
        "sitemap": "Shared Pages",
    }
    return names.get(first, first.replace("_", " ").replace("-", " ").title())


def classify_page(relative_path: Path, title: str) -> str:
    name = relative_path.stem.lower()
    searchable = f"{name} {title.lower()}"
    if "thread-detail" in searchable or "blog-detail" in searchable:
        return "content"
    if "create" in searchable or "edit" in searchable or "checkout" in searchable:
        return "action"
    if "login" in searchable or "auth" in searchable or "profile" in searchable:
        return "account"
    if "admin" in relative_path.parts:
        return "administration"
    return "page"


def normalize_target(source: Path, href: str) -> tuple[str, str] | None:
    href = href.strip()
    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
        return None
    split = urlsplit(href)
    if split.scheme or split.netloc:
        return None
    raw_path = unquote(split.path).replace("\\", "/")
    if not raw_path.lower().endswith((".html", ".htm")):
        return None

    source_dir = source.parent
    target = (source_dir / raw_path).resolve()
    try:
        relative = target.relative_to(SITE_ROOT.resolve())
    except ValueError:
        return None

    target_text = relative.as_posix()
    fragment = split.fragment.strip()
    return target_text, fragment


def iter_html_files() -> list[Path]:
    files: list[Path] = []
    for path in SITE_ROOT.rglob("*.html"):
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        files.append(path)
    return sorted(files, key=lambda p: p.relative_to(SITE_ROOT).as_posix().lower())


def main() -> None:
    html_files = iter_html_files()
    known_paths = {path.relative_to(SITE_ROOT).as_posix() for path in html_files}
    pages: list[dict] = []
    broken_links: list[dict] = []

    for file_path in html_files:
        relative_path = file_path.relative_to(SITE_ROOT)
        parser = PageParser()
        try:
            parser.feed(file_path.read_text(encoding="utf-8-sig", errors="replace"))
        except OSError as exc:
            print(f"Warning: unable to read {relative_path}: {exc}")
            continue

        title = clean_text(parser.title_parts) or clean_text(parser.h1_parts) or relative_path.stem.replace("-", " ").title()
        heading = clean_text(parser.h1_parts) or title
        page_links: list[dict[str, str]] = []
        seen_links: set[tuple[str, str, str]] = set()

        for link in parser.links:
            normalized = normalize_target(file_path, link["href"])
            if normalized is None:
                continue
            target, fragment = normalized
            key = (target, fragment, link["text"])
            if key in seen_links:
                continue
            seen_links.add(key)
            link_item = {
                "text": link["text"],
                "target": target,
                "fragment": fragment,
                "exists": target in known_paths,
            }
            page_links.append(link_item)
            if target not in known_paths:
                broken_links.append({
                    "source": relative_path.as_posix(),
                    "text": link["text"],
                    "target": target,
                })

        pages.append({
            "path": relative_path.as_posix(),
            "url": "../" + relative_path.as_posix(),
            "title": title,
            "heading": heading,
            "description": parser.description,
            "module": friendly_module(relative_path),
            "type": classify_page(relative_path, title),
            "links": page_links,
        })

    modules: dict[str, list[dict]] = {}
    for page in pages:
        modules.setdefault(page["module"], []).append(page)

    preferred_order = [
        "Home",
        "Marketplace & Shopping",
        "Reviews & Ratings",
        "Blog",
        "Discussion Forum",
        "User Account",
        "Administration",
        "Shared Pages",
    ]
    ordered_modules = []
    for module_name in preferred_order + sorted(set(modules) - set(preferred_order)):
        if module_name in modules:
            ordered_modules.append({
                "name": module_name,
                "pages": modules[module_name],
            })

    payload = {
        "generatedAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "pageCount": len(pages),
        "moduleCount": len(ordered_modules),
        "brokenLinkCount": len(broken_links),
        "modules": ordered_modules,
        "brokenLinks": broken_links,
    }

    OUTPUT_FILE.write_text(
        "// Automatically generated by generate_sitemap.py. Do not edit manually.\n"
        "window.SITEMAP_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Generated {OUTPUT_FILE.relative_to(SITE_ROOT.parent)} with {len(pages)} pages.")
    if broken_links:
        print(f"Found {len(broken_links)} internal HTML link(s) whose target file does not exist.")


if __name__ == "__main__":
    main()
