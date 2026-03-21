#!/usr/bin/env python3
"""
Generate flashcards for Little by Little using the Claude API.

Usage:
    python tools/generate_cards.py --category ux-product --count 10
    python tools/generate_cards.py --count 50  # distributes across all categories
"""

import argparse
import json
import os
import sys
import time
from datetime import date
from pathlib import Path

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

# Resolve paths relative to project root (one level up from tools/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CARDS_PATH = PROJECT_ROOT / "data" / "cards.json"
CATEGORIES_PATH = PROJECT_ROOT / "data" / "categories.json"
ENV_PATH = PROJECT_ROOT / ".env"

# Few-shot example card (ux-001, without diagram blocks)
EXAMPLE_CARD = {
    "id": "ux-001",
    "category": "ux-product",
    "type": "vocab",
    "front": "Affordance",
    "back": "<h4>Definition</h4><p><strong>A design property that signals how an object can be used.</strong> Coined by psychologist James Gibson (1977) and popularized in design by Don Norman in <em>The Design of Everyday Things</em> (1988).</p><h4>Two Types</h4><ul><li><strong>Perceived affordance</strong> — what the user <em>thinks</em> they can do based on visual cues</li><li><strong>Real affordance</strong> — what the object <em>actually</em> allows</li></ul><p>Good design aligns both. When they diverge, users get confused or frustrated.</p><h4>Examples in Digital Design</h4><div class='example-box'><div class='label'>Common affordances</div><ul><li>A raised button with a shadow <strong>affords pressing</strong> — the depth cue says \"push me\"</li><li>A scrollbar <strong>affords dragging</strong> — its shape and position signal movement</li><li>Underlined blue text <strong>affords clicking</strong> — learned convention from the early web</li><li>A text field with a blinking cursor <strong>affords typing</strong></li><li>A draggable handle (⠿) <strong>affords reordering</strong></li></ul></div><h4>Why It Matters</h4><p>When affordances are wrong, users need instructions. A door that requires a \"PUSH\" sign has <strong>failed affordance</strong> — the design itself should communicate the action. The same principle applies to interfaces: if you need a tooltip to explain a button, the affordance is weak.</p><h4>Design Insight</h4><p>Flat design trends removed many visual affordances (shadows, bevels, gradients). This led to \"mystery meat\" navigation where users couldn't tell what was clickable. Modern design balances minimalism with enough visual cues to guide interaction.</p>",
    "tags": ["ux", "fundamentals", "don-norman"],
    "difficulty": "beginner",
    "createdAt": "2026-03-18"
}

DEFAULT_MODEL = "claude-sonnet-4-6"
MODEL_BY_CATEGORY = {
    "articulation": "claude-opus-4-6",
}

SYSTEM_PROMPT = """You are a flashcard content writer for a learning app called Little by Little. You generate detailed, high-quality flashcard content in JSON format.

Your audience is an intermediate product designer who is a beginner at coding and English. Write clearly, avoid unnecessary jargon, and include practical examples.

Every card's "back" field must be HTML with:
- At least 2-3 <h4> subheaders organizing the content into sections
- 6-15 sentences of content across those sections
- <p> tags for paragraphs, <strong>/<em> for emphasis
- <ul> or <ol> for lists
- At least one <div class='example-box'><div class='label'>Label</div>content</div> block with a concrete, real-world example
- No <div class='diagram'> blocks
- No markdown — only HTML
- No <h1>, <h2>, or <h3> — only <h4>

Output ONLY a valid JSON array of card objects. No explanation, no markdown code fences, no extra text."""

ARTICULATION_SYSTEM_PROMPT = """You are a flashcard content writer for a learning app called Little by Little. You generate detailed, high-quality flashcard content in JSON format.

Your audience is an intermediate product designer who needs to communicate design decisions clearly to stakeholders, engineers, and leadership. Write with depth and nuance — these cards teach the art of design communication.

Every card's "back" field must be HTML with:
- At least 3-4 <h4> subheaders organizing the content into sections
- 10-20 sentences of content across those sections — richer and more detailed than standard cards
- <p> tags for paragraphs, <strong>/<em> for emphasis
- <ul> or <ol> for lists
- At least two <div class='example-box'><div class='label'>Label</div>content</div> blocks with real-world scenarios
- Include templates, scripts, or frameworks the user can directly apply
- No <div class='diagram'> blocks
- No markdown — only HTML
- No <h1>, <h2>, or <h3> — only <h4>

Output ONLY a valid JSON array of card objects. No explanation, no markdown code fences, no extra text."""

# Hardcoded tool comparison context for prompting cards (update periodically)
PROMPTING_CONTEXT = """
When generating "prompting" type cards for vibe-coding, include practical comparisons between AI tools where relevant:

Tool strengths (as of 2026):
- Claude (Anthropic): Best for long-form writing, nuanced reasoning, code review, following complex instructions. Supports 1M token context.
- ChatGPT (OpenAI): Strong at general tasks, browsing, image generation (DALL-E), plugins ecosystem. GPT-4o is multimodal.
- Gemini (Google): Deep integration with Google Workspace, strong at research/search tasks, multimodal with video understanding.
- GitHub Copilot: Best for inline code completion, IDE integration, code generation from comments. Uses multiple model backends.

Focus on practical prompting techniques: chain-of-thought, few-shot examples, system prompts, structured output, role-based prompting, prompt chaining.
"""


def load_existing_cards():
    """Load existing cards from data/cards.json."""
    if not CARDS_PATH.exists():
        print(f"Error: {CARDS_PATH} not found")
        sys.exit(1)
    with open(CARDS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_categories():
    """Load categories from data/categories.json."""
    if not CATEGORIES_PATH.exists():
        print(f"Error: {CATEGORIES_PATH} not found")
        sys.exit(1)
    with open(CATEGORIES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_next_id(existing_cards, category_id):
    """Find the next available ID number for a category."""
    prefix_map = {
        "ux-product": "ux-",
        "articulation": "da-",
        "interview": "int-",
        "vibe-coding": "vc-",
        "english": "en-",
    }
    prefix = prefix_map.get(category_id, f"{category_id}-")
    max_num = 0
    for card in existing_cards:
        if card["id"].startswith(prefix):
            try:
                num = int(card["id"].split("-")[-1])
                max_num = max(max_num, num)
            except ValueError:
                continue
    return max_num + 1


def get_existing_fronts(existing_cards, category_id=None):
    """Get list of existing card front texts to avoid duplicates."""
    cards = existing_cards
    if category_id:
        cards = [c for c in cards if c["category"] == category_id]
    return [c["front"] for c in cards]


def build_user_prompt(category, next_id, count, existing_fronts):
    """Build the user prompt for card generation."""
    prefix_map = {
        "ux-product": "ux",
        "articulation": "da",
        "interview": "int",
        "vibe-coding": "vc",
        "english": "en",
    }
    prefix = prefix_map.get(category["id"], category["id"])
    today = date.today().isoformat()
    fronts_list = "\n".join(f"- {f}" for f in existing_fronts) if existing_fronts else "(none yet)"

    return f"""Generate {count} flashcards for the "{category['name']}" category.

Category ID: {category['id']}
Available types: {', '.join(category['types'])}
Today's date: {today}
Starting ID: {prefix}-{next_id:03d}

Distribute cards roughly evenly across the available types.

Existing card topics to AVOID duplicating:
{fronts_list}

JSON schema for each card:
{{
  "id": "{prefix}-{{number}}",
  "category": "{category['id']}",
  "type": "one of the available types",
  "front": "Question, term, or prompt",
  "back": "HTML content following the structure rules",
  "tags": ["2-4 relevant tags"],
  "difficulty": "beginner | intermediate | advanced",
  "createdAt": "{today}"
}}

Example of a well-structured card:
{json.dumps(EXAMPLE_CARD, indent=2)}"""


def generate_cards(client, category, count, existing_cards, max_retries=3):
    """Call Claude API to generate cards for a single category."""
    next_id = get_next_id(existing_cards, category["id"])
    existing_fronts = get_existing_fronts(existing_cards, category["id"])
    user_prompt = build_user_prompt(category, next_id, count, existing_fronts)

    # Select model and system prompt based on category
    model = MODEL_BY_CATEGORY.get(category["id"], DEFAULT_MODEL)
    if category["id"] == "articulation":
        system_prompt = ARTICULATION_SYSTEM_PROMPT
    else:
        system_prompt = SYSTEM_PROMPT

    # Add prompting context for vibe-coding
    if category["id"] == "vibe-coding":
        system_prompt = system_prompt + PROMPTING_CONTEXT

    for attempt in range(max_retries):
        try:
            print(f"  Calling Claude API ({model}, attempt {attempt + 1})...")
            message = client.messages.create(
                model=model,
                max_tokens=8192,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            response_text = message.content[0].text.strip()

            # Strip markdown code fences if present
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                # Remove first line (```json) and last line (```)
                lines = [l for l in lines[1:] if l.strip() != "```"]
                response_text = "\n".join(lines)

            cards = json.loads(response_text)

            if not isinstance(cards, list):
                raise ValueError("Response is not a JSON array")

            # Validate each card has required fields
            required_fields = {"id", "category", "type", "front", "back", "tags", "difficulty", "createdAt"}
            for card in cards:
                missing = required_fields - set(card.keys())
                if missing:
                    raise ValueError(f"Card {card.get('id', '?')} missing fields: {missing}")

            # Filter out duplicates
            existing_front_set = set(f.lower() for f in existing_fronts)
            cards = [c for c in cards if c["front"].lower() not in existing_front_set]

            return cards

        except json.JSONDecodeError as e:
            print(f"  Invalid JSON response (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                print("  Failed to get valid JSON after all retries.")
                return []
        except anthropic.RateLimitError:
            wait = 2 ** (attempt + 2)
            print(f"  Rate limited. Waiting {wait}s...")
            time.sleep(wait)
        except Exception as e:
            print(f"  Error (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                return []

    return []


def save_cards(existing_cards, new_cards):
    """Append new cards to cards.json."""
    all_cards = existing_cards + new_cards
    with open(CARDS_PATH, "w", encoding="utf-8") as f:
        json.dump(all_cards, f, indent=2, ensure_ascii=False)
    print(f"  Saved {len(new_cards)} new cards to {CARDS_PATH}")


def main():
    parser = argparse.ArgumentParser(description="Generate Little by Little flashcards via Claude API")
    parser.add_argument("--category", type=str, help="Category ID (e.g., ux-product). Omit for all categories.")
    parser.add_argument("--count", type=int, default=12, help="Number of cards to generate (default: 12)")
    args = parser.parse_args()

    # Load .env
    load_dotenv(ENV_PATH)
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print(f"Error: ANTHROPIC_API_KEY not found. Add it to {ENV_PATH}")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    existing_cards = load_existing_cards()
    categories = load_categories()

    # Determine which categories to generate for
    if args.category:
        target_cats = [c for c in categories if c["id"] == args.category]
        if not target_cats:
            valid = ", ".join(c["id"] for c in categories)
            print(f"Error: Unknown category '{args.category}'. Valid: {valid}")
            sys.exit(1)
        counts = {args.category: args.count}
    else:
        target_cats = categories
        per_cat = max(1, args.count // len(categories))
        remainder = args.count % len(categories)
        counts = {}
        for i, cat in enumerate(target_cats):
            counts[cat["id"]] = per_cat + (1 if i < remainder else 0)

    # Generate cards for each category
    all_new_cards = []
    for cat in target_cats:
        count = counts[cat["id"]]
        print(f"\nGenerating {count} cards for {cat['name']}...")
        new_cards = generate_cards(client, cat, count, existing_cards)
        if new_cards:
            all_new_cards.extend(new_cards)
            # Update existing_cards so next category sees these as existing
            existing_cards = existing_cards + new_cards
            print(f"  Generated {len(new_cards)} cards")
        else:
            print(f"  No cards generated for {cat['name']}")

    if all_new_cards:
        # Reload original to avoid double-counting
        original_cards = load_existing_cards()
        save_cards(original_cards, all_new_cards)
        print(f"\n--- Summary ---")
        print(f"Total new cards: {len(all_new_cards)}")
        for cat in target_cats:
            cat_cards = [c for c in all_new_cards if c["category"] == cat["id"]]
            if cat_cards:
                ids = [c["id"] for c in cat_cards]
                print(f"  {cat['name']}: {len(cat_cards)} cards ({ids[0]} – {ids[-1]})")
    else:
        print("\nNo cards were generated.")


if __name__ == "__main__":
    main()
