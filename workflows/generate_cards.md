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
  "category": "ux-product | interview | vibe-coding | english",
  "type": "see card types below",
  "front": "Card front text (question, term, or prompt)",
  "back": "HTML-structured explanation (see quality standards)",
  "tags": ["tag1", "tag2"],
  "difficulty": "beginner | intermediate | advanced",
  "createdAt": "YYYY-MM-DD"
}
```

## Card Types by Category
- **ux-product**: vocab, buzzword, framework, articulation
- **interview**: behavioral, situational, design-specific, curveball
- **vibe-coding**: concept, command, workflow, tip
- **english**: sentence-structure, phrase, vocabulary, presentation

## Quality Standards

### Content Length
- Back text must be **6–15 sentences minimum**, structured across multiple sections
- Each card should have **at least 2–3 `<h4>` subheaders** organizing the content into logical sections
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

## Prompt Template

The script sends the following to the Claude API. The `{variables}` are filled in by the script at runtime.

### System Prompt
```
You are a flashcard content writer for a learning app called Little by Little. You generate detailed, high-quality flashcard content in JSON format.

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

Output ONLY a valid JSON array of card objects. No explanation, no markdown code fences, no extra text.
```

### User Prompt
```
Generate {count} flashcards for the "{category_name}" category.

Category ID: {category_id}
Available types: {types}
Today's date: {date}
Starting ID: {next_id}

Distribute cards roughly evenly across the available types.

Existing card topics to AVOID duplicating:
{existing_fronts}

JSON schema for each card:
{
  "id": "{category_id}-{number}",
  "category": "{category_id}",
  "type": "one of the available types",
  "front": "Question, term, or prompt",
  "back": "HTML content following the structure rules",
  "tags": ["2-4 relevant tags"],
  "difficulty": "beginner | intermediate | advanced",
  "createdAt": "{date}"
}

Example of a well-structured card:
{example_card_json}
```

### Few-Shot Example Card
Use this card (ux-001) as the example in the prompt:
```json
{
  "id": "ux-001",
  "category": "ux-product",
  "type": "vocab",
  "front": "Affordance",
  "back": "<h4>Definition</h4><p><strong>A design property that signals how an object can be used.</strong> Coined by psychologist James Gibson (1977) and popularized in design by Don Norman in <em>The Design of Everyday Things</em> (1988).</p><h4>Two Types</h4><ul><li><strong>Perceived affordance</strong> — what the user <em>thinks</em> they can do based on visual cues</li><li><strong>Real affordance</strong> — what the object <em>actually</em> allows</li></ul><p>Good design aligns both. When they diverge, users get confused or frustrated.</p><h4>Examples in Digital Design</h4><div class='example-box'><div class='label'>Common affordances</div><ul><li>A raised button with a shadow <strong>affords pressing</strong> — the depth cue says \"push me\"</li><li>A scrollbar <strong>affords dragging</strong> — its shape and position signal movement</li><li>Underlined blue text <strong>affords clicking</strong> — learned convention from the early web</li><li>A text field with a blinking cursor <strong>affords typing</strong></li><li>A draggable handle (⠿) <strong>affords reordering</strong></li></ul></div><h4>Why It Matters</h4><p>When affordances are wrong, users need instructions. A door that requires a \"PUSH\" sign has <strong>failed affordance</strong> — the design itself should communicate the action. The same principle applies to interfaces: if you need a tooltip to explain a button, the affordance is weak.</p><h4>Design Insight</h4><p>Flat design trends removed many visual affordances (shadows, bevels, gradients). This led to \"mystery meat\" navigation where users couldn't tell what was clickable. Modern design balances minimalism with enough visual cues to guide interaction.</p>",
  "tags": ["ux", "fundamentals", "don-norman"],
  "difficulty": "beginner",
  "createdAt": "2026-03-18"
}
```

## Generation Process
1. Run `python tools/generate_cards.py --category <category> --count <n>`
   - `--category`: one of `ux-product`, `interview`, `vibe-coding`, `english` (omit for all categories)
   - `--count`: number of cards to generate (default: 12; distributed across categories if `--category` is omitted)
2. Script reads `data/cards.json` for existing IDs and front texts
3. Script sends the prompt to Claude API (claude-sonnet-4-20250514)
4. Script validates the JSON response and checks for schema compliance
5. Script appends new cards to `data/cards.json`
6. Script prints a summary (count, categories, IDs)
7. Commit and push to update the live site

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
