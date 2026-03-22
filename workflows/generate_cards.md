# Generate Cards Workflow

## Objective
Generate high-quality flashcards for Little by Little using `tools/generate_cards.py`, which calls the Claude API to produce detailed, structured learning content.

## Prerequisites
- `.env` file in project root with `ANTHROPIC_API_KEY=sk-ant-...`
- Python 3.10+ with `anthropic` and `python-dotenv` packages installed
- Existing `data/cards.json` to append to

## Card JSON Schema
```json
{
  "id": "category-001",
  "category": "ux-product | articulation | interview | vibe-coding | english | motivation",
  "type": "see card types below",
  "front": "Card front text (question, term, or prompt)",
  "back": "HTML-structured explanation (see quality standards)",
  "tags": ["tag1", "tag2"],
  "difficulty": "beginner | intermediate | advanced",
  "createdAt": "YYYY-MM-DD"
}
```

## Card Types by Category

| Category | ID | Types | Model | ID Prefix |
|---|---|---|---|---|
| UX & Product | `ux-product` | vocab, buzzword, framework | Sonnet 4.6 | `ux-` |
| Design Articulation | `articulation` | trade-off, rationale, critique, stakeholder, presentation, storytelling | **Opus 4.6** | `da-` |
| Interview Prep | `interview` | behavioral, situational, design-specific, curveball | Sonnet 4.6 | `int-` |
| Vibe Coding & AI | `vibe-coding` | concept, command, workflow, tip, prompting | Sonnet 4.6 | `vc-` |
| English | `english` | writing, phrase, vocabulary, presentation | Sonnet 4.6 | `en-` |
| Motivation | `motivation` | discipline, mindset, happiness, perseverance | Sonnet 4.6 | `mo-` |

### Category Notes
- **Articulation** uses Opus 4.6 for richer, longer-form content (10-20 sentences per card). Cards teach design communication: explaining trade-offs, justifying decisions, presenting to stakeholders, design storytelling.
- **Vibe Coding** `prompting` type includes tool comparisons (Claude, ChatGPT, Gemini, Copilot). Tool comparison context is hardcoded in the script — update every few months.
- **English** focuses on professional design/tech communication: writing (emails, Slack, specs, PRDs), phrases, vocabulary, and presentation skills.
- **Motivation** cards are warm and heartfelt — discipline for building habits, mindset for growth thinking, happiness for celebrating progress, perseverance for pushing through hard times.

## Quality Standards

### Content Length
- Standard cards: **6–15 sentences minimum**, at least 2–3 `<h4>` subheaders
- Articulation cards: **10–20 sentences**, at least 3–4 `<h4>` subheaders, at least 2 example boxes
- The goal: reading the card back alone should teach you the concept

### HTML Structure
Every card back must use this HTML structure:
- `<h4>` — section subheaders (e.g., "Definition", "Why It Matters", "Examples")
- `<p>` — paragraph text with `<strong>` and `<em>` for emphasis
- `<ul>` or `<ol>` — lists for multiple points
- `<div class='example-box'><div class='label'>Label here</div>...</div>` — concrete examples with a descriptive label

### What NOT to include
- No `<div class='diagram'>` blocks (diagrams are disabled for now)
- No markdown — only HTML
- No `<h1>`, `<h2>`, or `<h3>` tags — only `<h4>` for subheaders

### Audience
Content is written for an **intermediate product designer** who is a **beginner at coding** and a **beginner at English**. Use clear language, avoid unnecessary jargon (or define it when used), and include practical examples.

### Accuracy
- Content must be factually accurate and well-established
- Cite sources, standards, or key figures where applicable (e.g., Nielsen, Don Norman, WCAG)
- For interview cards, provide both the question approach and a sample answer structure

### Deduplication
- The script passes existing card front texts to Claude so it avoids generating duplicate topics
- Use incremental IDs: check the last ID in each category and continue from there

## Generation Process
1. Run `python tools/generate_cards.py --category <category> --count <n>`
   - `--category`: one of `ux-product`, `articulation`, `interview`, `vibe-coding`, `english`, `motivation` (omit for all categories)
   - `--count`: number of cards to generate (default: 12; distributed across categories if `--category` is omitted)
2. Script reads `data/cards.json` for existing IDs and front texts
3. Script selects model per category (Opus for articulation, Sonnet for rest)
4. Script sends the prompt to Claude API
5. Script validates the JSON response and checks for schema compliance
6. Script appends new cards to `data/cards.json`
7. Script prints a summary (count, categories, IDs)
8. Commit and push to update the live site

## Auto-Generation
Weekly auto-generation is configured via GitHub Actions (`.github/workflows/generate-cards.yml`):
- Runs every Monday at 9:00 AM UTC
- Generates 50 cards distributed across all 6 categories
- Commits and pushes changes automatically
- No extra cost — GitHub Actions is free for public repos
- API cost: ~$2.76/month (Opus for articulation, Sonnet for rest)

## Manual Fallback
If `tools/generate_cards.py` is not available or the API key is not set, Claude Code can generate cards directly by:
1. Reading this workflow for quality standards
2. Reading `data/cards.json` for existing content and last IDs
3. Writing new cards directly to `data/cards.json` following all the same rules

## Troubleshooting
- **API rate limit**: Script retries with exponential backoff (3 attempts)
- **Invalid JSON response**: Script retries with a stricter prompt asking for valid JSON only
- **Duplicate topics**: Script passes existing fronts to the API; if duplicates still appear, they are filtered out before saving
- **Unbalanced categories**: Use `--category` to target specific categories that need more cards
