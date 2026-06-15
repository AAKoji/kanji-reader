"""
Daily kanji article generator.
Calls the Claude API to produce a new src/article.js with JLPT-tagged segments.
Run via GitHub Actions; requires ANTHROPIC_API_KEY env var.
"""

import anthropic
import json
import os
import random
import sys
from datetime import date

TOPICS = [
    "日本の伝統文化",
    "最新テクノロジー",
    "日本の食文化",
    "環境と自然",
    "日本の観光地",
    "スポーツとオリンピック",
    "日本の歴史",
    "宇宙と科学",
    "音楽とアート",
    "健康とライフスタイル",
]

SYSTEM_PROMPT = """You are a Japanese language content creator. Your task is to write a short
Japanese news-style article and return it as structured JSON for a language learning app.

Rules for the JSON output:
- Return ONLY a valid JSON object, no markdown, no explanation.
- The object has three keys: "title" (string), "subtitle" (string), "segments" (array).
- subtitle format: "カテゴリ名 · 読み時間 約X分"
- Each segment in the array is an object with these fields:
  - "text": the Japanese text (required)
  - "reading": hiragana/katakana reading, or null for particles and punctuation
  - "meaning": English meaning, or null for particles and punctuation
  - "jlpt": JLPT level string "N5", "N4", "N3", "N2", or "N1" — only on words that have reading/meaning
- Particles (は、が、を、に、で、の、も、と、から、まで、へ、より), punctuation (。、！？「」…・)
  and grammatical endings must have reading: null and meaning: null (no jlpt field).
- The article should be 4-5 paragraphs, 60-90 segments total.
- Use a natural mix of N5–N1 vocabulary. Most content words should have a jlpt field.
- Separate paragraphs with a segment: {"text": "\\n\\n", "reading": null, "meaning": null}"""

USER_PROMPT_TEMPLATE = """Write a short Japanese news article about: {topic}

Today's date: {today}

Return the structured JSON object as described. Make it interesting and educational."""


def pick_topic() -> str:
    day_index = date.today().toordinal() % len(TOPICS)
    return TOPICS[day_index]


def generate(client: anthropic.Anthropic, topic: str) -> dict:
    message = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": USER_PROMPT_TEMPLATE.format(
                    topic=topic,
                    today=date.today().isoformat(),
                ),
            }
        ],
    )
    raw = message.content[0].text.strip()
    return json.loads(raw)


def validate(article: dict) -> None:
    assert "title" in article, "missing title"
    assert "subtitle" in article, "missing subtitle"
    assert "segments" in article and len(article["segments"]) >= 20, "too few segments"
    valid_jlpt = {"N1", "N2", "N3", "N4", "N5"}
    for i, seg in enumerate(article["segments"]):
        assert "text" in seg, f"segment {i} missing text"
        assert "reading" in seg, f"segment {i} missing reading field"
        assert "meaning" in seg, f"segment {i} missing meaning field"
        if seg.get("jlpt"):
            assert seg["jlpt"] in valid_jlpt, f"segment {i} has invalid jlpt: {seg['jlpt']}"


def to_js(article: dict) -> str:
    segments_json = json.dumps(article["segments"], ensure_ascii=False, indent=2)
    return f"""export const ARTICLE = {{
  title: {json.dumps(article["title"], ensure_ascii=False)},
  subtitle: {json.dumps(article["subtitle"], ensure_ascii=False)},
  segments: {segments_json},
}}
"""


def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    topic = pick_topic()
    print(f"Generating article on: {topic}")

    article = generate(client, topic)
    validate(article)

    out_path = os.path.join(os.path.dirname(__file__), "..", "src", "article.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(to_js(article))

    print(f"Written {len(article['segments'])} segments to src/article.js")


if __name__ == "__main__":
    main()
