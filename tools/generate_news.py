#!/usr/bin/env python3
"""
Fetch AI news from RSS feeds and summarize with Claude API.

Usage:
    python tools/generate_news.py
    python tools/generate_news.py --count 10
"""

import argparse
import json
import os
import sys
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

try:
    import anthropic
except ImportError:
    print("Error: 'anthropic' package not installed. Run: pip install anthropic")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print("Error: 'python-dotenv' package not installed. Run: pip install python-dotenv")
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
NEWS_PATH = PROJECT_ROOT / "data" / "news.json"
ENV_PATH = PROJECT_ROOT / ".env"

# RSS feeds for AI news
RSS_FEEDS = [
    {
        "name": "The Verge AI",
        "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "source": "The Verge",
    },
    {
        "name": "TechCrunch AI",
        "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "source": "TechCrunch",
    },
    {
        "name": "Ars Technica AI",
        "url": "https://feeds.arstechnica.com/arstechnica/technology-lab",
        "source": "Ars Technica",
    },
    {
        "name": "MIT Tech Review AI",
        "url": "https://www.technologyreview.com/feed/",
        "source": "MIT Tech Review",
    },
    {
        "name": "VentureBeat AI",
        "url": "https://venturebeat.com/category/ai/feed/",
        "source": "VentureBeat",
    },
]

SYSTEM_PROMPT = """You are a news curator for an AI learning app. Your audience is a product designer who is learning about AI, coding, and design tools.

Given a list of recent AI news articles (titles, snippets, links, sources), select the most interesting and relevant ones and write a concise, engaging summary for each.

For each selected article, output a JSON object with:
- "title": A clear, concise headline (rewrite if needed for clarity)
- "summary": 2-3 sentences explaining what happened and why it matters. Write for someone who is curious but not deeply technical.
- "source": The publication name
- "url": The original article URL
- "date": The publication date (YYYY-MM-DD)
- "tags": 2-3 relevant tags (e.g., "openai", "design-tools", "coding", "models", "research")

Output ONLY a valid JSON array. No explanation, no markdown code fences, no extra text.

Prioritize news about:
1. AI tools relevant to designers and coders (Claude, ChatGPT, Copilot, Figma AI, etc.)
2. New model releases or major updates
3. AI in design, UX, and product development
4. Practical AI applications and workflows
5. AI industry trends and policy

Skip: purely academic papers, enterprise sales announcements, crypto/blockchain crossover."""


def fetch_rss(feed_info, days_back=10):
    """Fetch and parse RSS feed, return recent articles."""
    articles = []
    cutoff = datetime.now() - timedelta(days=days_back)

    try:
        req = Request(feed_info["url"], headers={"User-Agent": "LittleByLittle/1.0"})
        with urlopen(req, timeout=15) as response:
            content = response.read()
        root = ET.fromstring(content)
    except (URLError, ET.ParseError, Exception) as e:
        print(f"  Warning: Could not fetch {feed_info['name']}: {e}")
        return []

    # Handle both RSS 2.0 and Atom feeds
    ns = {"atom": "http://www.w3.org/2005/Atom"}

    # Try RSS 2.0 format
    for item in root.findall(".//item"):
        title = item.findtext("title", "").strip()
        link = item.findtext("link", "").strip()
        description = item.findtext("description", "").strip()
        pub_date = item.findtext("pubDate", "")

        if not title or not link:
            continue

        # Parse date (best effort)
        parsed_date = parse_date(pub_date)
        if parsed_date and parsed_date < cutoff:
            continue

        # Clean description (strip HTML tags)
        description = strip_html(description)[:500]

        articles.append({
            "title": title,
            "link": link,
            "description": description,
            "source": feed_info["source"],
            "date": parsed_date.strftime("%Y-%m-%d") if parsed_date else date.today().isoformat(),
        })

    # Try Atom format if no RSS items found
    if not articles:
        for entry in root.findall("atom:entry", ns):
            title = entry.findtext("atom:title", "", ns).strip()
            link_el = entry.find("atom:link[@rel='alternate']", ns)
            if link_el is None:
                link_el = entry.find("atom:link", ns)
            link = link_el.get("href", "") if link_el is not None else ""
            summary = entry.findtext("atom:summary", "", ns).strip()
            updated = entry.findtext("atom:updated", "", ns)

            if not title or not link:
                continue

            parsed_date = parse_date(updated)
            if parsed_date and parsed_date < cutoff:
                continue

            summary = strip_html(summary)[:500]

            articles.append({
                "title": title,
                "link": link,
                "description": summary,
                "source": feed_info["source"],
                "date": parsed_date.strftime("%Y-%m-%d") if parsed_date else date.today().isoformat(),
            })

    return articles[:10]  # Limit per source


def parse_date(date_str):
    """Best-effort date parsing."""
    if not date_str:
        return None
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).replace(tzinfo=None)
        except ValueError:
            continue
    return None


def strip_html(text):
    """Remove HTML tags from text."""
    import re
    return re.sub(r"<[^>]+>", "", text).strip()


def curate_news(client, raw_articles, count=10):
    """Send raw articles to Claude for curation and summarization."""
    if not raw_articles:
        print("  No articles to curate.")
        return []

    articles_text = json.dumps(raw_articles[:40], indent=2)  # Send top 40 candidates

    user_prompt = f"""Here are {len(raw_articles[:40])} recent AI news articles. Select the {count} most interesting and relevant ones, and write a summary for each.

Today's date: {date.today().isoformat()}

Articles:
{articles_text}"""

    try:
        print(f"  Calling Claude API to curate {count} news items...")
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        response_text = message.content[0].text.strip()

        # Strip markdown code fences if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            lines = [l for l in lines[1:] if l.strip() != "```"]
            response_text = "\n".join(lines)

        news_items = json.loads(response_text)

        if not isinstance(news_items, list):
            raise ValueError("Response is not a JSON array")

        # Add IDs
        today = date.today().isoformat()
        for i, item in enumerate(news_items, 1):
            item["id"] = f"news-{today}-{i:03d}"

        return news_items

    except Exception as e:
        print(f"  Error curating news: {e}")
        return []


def save_news(news_items):
    """Save news to data/news.json (replace, not append — only latest week)."""
    NEWS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(NEWS_PATH, "w", encoding="utf-8") as f:
        json.dump(news_items, f, indent=2, ensure_ascii=False)
    print(f"  Saved {len(news_items)} news items to {NEWS_PATH}")


def main():
    parser = argparse.ArgumentParser(description="Fetch and curate AI news")
    parser.add_argument("--count", type=int, default=10, help="Number of news items (default: 10)")
    args = parser.parse_args()

    load_dotenv(ENV_PATH)
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print(f"Error: ANTHROPIC_API_KEY not found. Add it to {ENV_PATH}")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    # Fetch from all RSS feeds
    print("Fetching AI news from RSS feeds...")
    all_articles = []
    for feed in RSS_FEEDS:
        print(f"  Fetching {feed['name']}...")
        articles = fetch_rss(feed)
        all_articles.extend(articles)
        print(f"    Found {len(articles)} recent articles")

    print(f"\nTotal candidates: {len(all_articles)}")

    if not all_articles:
        print("No articles found. Keeping existing news.json if present.")
        return

    # Curate with Claude
    news_items = curate_news(client, all_articles, count=args.count)

    if news_items:
        save_news(news_items)
        print(f"\n--- Summary ---")
        print(f"Curated {len(news_items)} news items")
        for item in news_items:
            print(f"  [{item.get('source', '?')}] {item.get('title', '?')}")
    else:
        print("No news items curated.")


if __name__ == "__main__":
    main()
