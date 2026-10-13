#!/usr/bin/env python3
"""Sends a "new PR" message with the PR description to the Telegram dev group topic.

Env: BOT_TOKEN CHAT_ID TOPIC_ID PR_TITLE PR_BODY PR_AUTHOR PR_URL PR_NUMBER
     BASE_BRANCH HEAD_BRANCH REPO_NAME

The PR description (Markdown) is converted to Telegram HTML: headings, bold,
inline code, links, lists and checkboxes. Exits 1 if the message is not sent.
"""
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

# Telegram limit is 4096 chars; leave room for the header and footer.
BODY_LIMIT = 3300
# Marks heading lines inside convert() before sections are assembled.
HEADING = "\x01"

HEADING_ICONS = [
    ("nima", "🎯"),
    ("bug", "🐞"),
    ("ro'yxat", "📋"),
    ("tekshir", "🧪"),
    ("skrinshot", "🖼"),
    ("breaking", "⚠️"),
    ("xavf", "⚠️"),
]


def env(name, required=True):
    value = os.environ.get(name, "")
    if required and not value:
        print(f"::error::{name} missing - Telegram message not sent")
        sys.exit(1)
    return value


def inline(text):
    """Escape HTML, then turn Markdown links, **bold** and `code` into tags."""
    # Code spans go to placeholders first so **bold `code`** still pairs up.
    codes = []

    def stash(m):
        codes.append(f"<code>{html.escape(m.group(1), quote=False)}</code>")
        return f"\x00{len(codes) - 1}\x00"

    text = re.sub(r"`([^`]+)`", stash, text)
    text = html.escape(text, quote=False)
    text = re.sub(
        r"\[([^\]]+)\]\((https?://[^)\s]+)\)",
        lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>',
        text,
    )
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], text)


def heading_icon(title):
    lower = title.lower()
    for key, icon in HEADING_ICONS:
        if key in lower:
            return icon
    return "▪️"


def convert(body):
    body = re.sub(r"<!--.*?-->", "", body or "", flags=re.S)
    lines = []
    done = total = 0
    for raw in body.replace("\r\n", "\n").split("\n"):
        line = raw.rstrip()
        if line.lstrip().startswith("🤖 Generated with"):
            continue
        m = re.match(r"^#{1,6}\s+(.*)$", line)
        if m:
            title = m.group(1).strip()
            lines.append(HEADING + f"{heading_icon(title)} <b>{inline(title)}</b>")
            continue
        m = re.match(r"^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$", line)
        if m:
            total += 1
            checked = m.group(2).lower() == "x"
            done += checked
            lines.append(f"{m.group(1)}{'✅' if checked else '⬜'} {inline(m.group(3))}")
            continue
        m = re.match(r"^(\s*)[-*]\s+(.*)$", line)
        if m:
            lines.append(f"{m.group(1)}• {inline(m.group(2))}")
            continue
        lines.append(inline(line))

    # Split into sections; drop empty template sections and extra blank lines.
    sections = [[]]
    for line in lines:
        if line.startswith(HEADING):
            sections.append([line[len(HEADING):]])
        elif line.strip() or (sections[-1] and sections[-1][-1].strip()):
            sections[-1].append(line)
    cleaned = list(sections[0])
    while cleaned and not cleaned[-1].strip():
        cleaned.pop()
    for section in sections[1:]:
        while section and not section[-1].strip():
            section.pop()
        if len(section) < 2:
            continue
        if cleaned:
            cleaned.append("")
        # No blank line right under a heading.
        cleaned += [section[0]] + [l for i, l in enumerate(section[1:]) if i or l.strip()]

    # Cut on whole lines so no HTML tag is left open.
    out, size = [], 0
    for line in cleaned:
        if size + len(line) + 1 > BODY_LIMIT:
            out.append("… <i>davomi PR'da</i>")
            break
        out.append(line)
        size += len(line) + 1
    return "\n".join(out), done, total


def main():
    # DRY_RUN=1 prints the message instead of sending it (local testing).
    dry_run = bool(os.environ.get("DRY_RUN"))
    bot_token = env("BOT_TOKEN", required=not dry_run)
    chat_id = env("CHAT_ID", required=not dry_run)
    topic_id = env("TOPIC_ID", required=False)

    e = lambda name: html.escape(env(name, required=False), quote=False)
    body, done, total = convert(os.environ.get("PR_BODY", ""))
    if not body:
        body = "<i>PR tavsifi yozilmagan</i>"
    checklist = f"\n📋 Tekshiruv ro'yxati: <b>{done}/{total}</b>" if total else ""

    text = (
        "🔔 <b>Yangi Pull Request ochildi!</b>\n\n"
        f"📦 Repo: <b>{e('REPO_NAME')}</b>\n"
        f"📌 Sarlavha: <b>{e('PR_TITLE')}</b>\n"
        f"👤 Kim tomonidan: <b>{e('PR_AUTHOR')}</b>\n"
        f"🔀 Branch: <code>{e('HEAD_BRANCH')}</code> → <code>{e('BASE_BRANCH')}</code>"
        f"{checklist}\n\n"
        f"{body}\n\n"
        f'🔗 <a href="{html.escape(env("PR_URL", required=False))}">PR #{e("PR_NUMBER")} ni ko\'rish</a>'
    )

    if dry_run:
        print(text)
        print(f"\n--- {len(text)} chars")
        return

    data = {
        "chat_id": chat_id,
        "parse_mode": "HTML",
        "disable_web_page_preview": "true",
        "text": text,
    }
    if topic_id:
        data["message_thread_id"] = topic_id

    request = urllib.request.Request(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        data=urllib.parse.urlencode(data).encode(),
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print(f"HTTP_STATUS:{response.status}")
    except urllib.error.HTTPError as err:
        # Response body never contains the bot token, safe to print.
        print(f"::error::Telegram sendMessage failed (HTTP {err.code}): {err.read().decode()}")
        sys.exit(1)
    except (urllib.error.URLError, TimeoutError) as err:
        print(f"::error::Telegram unreachable: {err}")
        sys.exit(1)


if __name__ == "__main__":
    main()
