"""
One-off novel builder (Aozora Bunko .txt -> clickable page JSON for the reader).

Parses Aozora markup and splits the text into ~5 minute pages. Each page is segmented
by hand (by Claude in a Claude Code session, no API key) into a small text file under
data/novels/ginga-segments/, which this script validates against the source text and
converts into the same {text, reading, meaning, jlpt} shape as article.json.

  python scripts/build_novel.py --plan        # paging stats
  python scripts/build_novel.py --show 3      # print page 3 + its furigana, to segment it
  python scripts/build_novel.py               # validate segment files, write public/novels/ginga/
  python scripts/build_novel.py --report      # JLPT distribution of the built pages

Segment file format, one word per line:
  言われ|いわれ|was told|N5     a word with a popup (the JLPT level may be left empty)
  の                           particle / punctuation, no popup
  ¶                            paragraph break

Two more optional trailing fields hold the word's dictionary/base form, for an inflected
word whose base form differs from its surface text (both-or-neither; omit for words already
in base form, e.g. nouns):
  澄みきって|すみきって|be clear|N2|澄み切る|すみきる
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = REPO_ROOT / "data" / "novels" / "gingatetsudono_yoru.txt"
SEGMENTS_DIR = REPO_ROOT / "data" / "novels" / "ginga-segments"
OUT_DIR = REPO_ROOT / "public" / "novels" / "ginga"

NOVEL_ID = "ginga"
# Pages are sized by characters, not minutes: ~700 chars is a guess for a learner who
# taps words; tune it after watching people read. Changing it re-pages the novel, so
# every segment file would have to be redone.
PAGE_TARGET_CHARS = 700
PARAGRAPH_BREAK = "\n\n"
PARAGRAPH_MARK = "¶"

# Aozora gaiji notes for characters outside JIS. Unicode has no small ん, so use the normal one.
GAIJI = {
    "※［＃小書き平仮名ん、183-7］": "ん",
}

HEADING = re.compile(r"^［＃[^］]*字下げ］(.+?)［＃「.+?」は中見出し］$")
NOTE = re.compile(r"［＃[^］]*］")
# Reading attaches to the text after ｜ if present, otherwise to the kanji run before 《》.
RUBY = re.compile(r"(?:｜(.+?)|([㐀-鿿豈-﫿々〆ヵヶ〇]+))《(.+?)》")
LEFTOVER_MARKUP = re.compile(r"[《》｜※]|［＃")

JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"]

# Aozora asks that its credit stays intact and expects modified versions to say what changed
# (https://www.aozora.gr.jp/guide/kijyunn.html). The credit is shown verbatim; this follows it.
CHANGES_NOTE = (
    "本アプリでは青空文庫のテキストをもとに、ルビ・入力者注を外し、外字（小書きの「ん」）を「ん」に置き換え、"
    "ページに分けて表示しています。単語の読み・意味・JLPTレベルは本アプリが付けたもので、青空文庫によるものではありません。"
)


class SegmentFileError(Exception):
    """A segment file does not match its page or is malformed."""


# ── Parsing ──────────────────────────────────────────────────────────────────

def strip_ruby(annotated: str) -> tuple[str, list[tuple[str, str]]]:
    """Return the plain text and the (base, reading) pairs found in it."""
    pairs = [(m.group(1) or m.group(2), m.group(3)) for m in RUBY.finditer(annotated)]
    plain = RUBY.sub(lambda m: m.group(1) or m.group(2), annotated)
    return plain, pairs


def clean_line(line: str) -> str:
    for code, char in GAIJI.items():
        line = line.replace(code, char)
    line = NOTE.sub("", line)
    # The leading full-width space is print indentation; paragraphs are separated anyway.
    return line.strip().lstrip("　")


def split_sentences(annotated: str) -> list[str]:
    """Split after 。 (keeping a closing bracket with its sentence). Ruby never contains 。."""
    return [s for s in re.split(r"(?<=。)(?![」』）])", annotated) if s]


def parse_novel(raw: str) -> tuple[dict, list[dict]]:
    """Return (metadata, chapters) where each chapter is {title, paragraphs: [annotated str]}."""
    lines = raw.replace("\r\n", "\n").split("\n")
    title, author = lines[0].strip(), lines[1].strip()

    dashes = [i for i, line in enumerate(lines) if line.startswith("-----")]
    footer_start = next(i for i, line in enumerate(lines) if line.startswith("底本："))
    body = lines[dashes[1] + 1:footer_start]
    credit = [line.strip() for line in lines[footer_start:] if line.strip()]

    chapters: list[dict] = []
    for line in body:
        heading = HEADING.match(line.strip())
        if heading:
            chapters.append({"title": strip_ruby(heading.group(1))[0], "paragraphs": []})
            continue
        text = clean_line(line)
        if not text:
            continue
        if not chapters:
            raise ValueError("text found before the first chapter heading")
        chapters[-1]["paragraphs"].append(text)

    return {"title": title, "author": author, "credit": credit}, chapters


def load_pages() -> tuple[dict, list[dict]]:
    meta, chapters = parse_novel(SOURCE_PATH.read_bytes().decode("cp932"))
    return meta, paginate(chapters)


# ── Paging ───────────────────────────────────────────────────────────────────

def paginate(chapters: list[dict]) -> list[dict]:
    """Greedy fill per chapter. Paragraphs longer than a page are split at sentence ends."""
    pages: list[dict] = []
    for chapter in chapters:
        # Units are (annotated text, starts a new paragraph?)
        units: list[tuple[str, bool]] = []
        for para in chapter["paragraphs"]:
            if len(strip_ruby(para)[0]) <= PAGE_TARGET_CHARS:
                units.append((para, True))
                continue
            chunk = ""
            is_first = True
            for sentence in split_sentences(para):
                if chunk and len(strip_ruby(chunk + sentence)[0]) > PAGE_TARGET_CHARS:
                    units.append((chunk, is_first))
                    chunk, is_first = "", False
                chunk += sentence
            units.append((chunk, is_first))

        current: list[tuple[str, bool]] = []
        current_len = 0
        for unit in units:
            unit_len = len(strip_ruby(unit[0])[0])
            if current and current_len + unit_len > PAGE_TARGET_CHARS:
                pages.append(make_page(chapter["title"], current))
                current, current_len = [], 0
            current.append(unit)
            current_len += unit_len
        if current:
            pages.append(make_page(chapter["title"], current))

    for number, page in enumerate(pages, start=1):
        page["page"] = number
    return pages


def make_page(chapter_title: str, units: list[tuple[str, bool]]) -> dict:
    annotated = ""
    for i, (text, is_new_paragraph) in enumerate(units):
        if i > 0 and is_new_paragraph:
            annotated += PARAGRAPH_BREAK
        annotated += text
    plain, ruby = strip_ruby(annotated)
    leftover = LEFTOVER_MARKUP.search(plain)
    if leftover:
        raise ValueError(f"unparsed markup {leftover.group()!r} in: {plain[:60]}…")
    return {"chapter": chapter_title, "text": plain, "ruby": ruby}


# ── Segment files ────────────────────────────────────────────────────────────

def segments_path(number: int) -> Path:
    return SEGMENTS_DIR / f"page-{number:03d}.txt"


def parse_segment_line(line: str, line_number: int) -> dict:
    if line == PARAGRAPH_MARK:
        return {"text": PARAGRAPH_BREAK, "reading": None, "meaning": None}
    fields = line.split("|")
    if len(fields) == 1:
        return {"text": line, "reading": None, "meaning": None}
    if len(fields) not in (3, 4, 6) or not all(fields[:3]):
        raise SegmentFileError(
            f"line {line_number}: expected text|reading|meaning|jlpt|base|baseReading, got {line!r}"
        )
    segment = {"text": fields[0], "reading": fields[1], "meaning": fields[2]}
    jlpt = fields[3] if len(fields) in (4, 6) else ""
    if jlpt:
        if jlpt not in JLPT_LEVELS:
            raise SegmentFileError(f"line {line_number}: invalid JLPT level {jlpt!r}")
        segment["jlpt"] = jlpt
    if len(fields) == 6:
        base, base_reading = fields[4], fields[5]
        if not base or not base_reading:
            raise SegmentFileError(f"line {line_number}: base and baseReading must both be set (use 4 fields to omit)")
        if base == segment["text"]:
            raise SegmentFileError(f"line {line_number}: base equals text; omit base/baseReading instead")
        segment["base"], segment["baseReading"] = base, base_reading
    return segment


def first_mismatch(expected: str, actual: str) -> str:
    i = next((i for i, (a, b) in enumerate(zip(expected, actual)) if a != b), min(len(expected), len(actual)))
    return f"at char {i}: expected {expected[i:i + 15]!r}, got {actual[i:i + 15]!r}"


def read_segments(page: dict) -> list[dict]:
    """Parse a page's segment file and check it reproduces the page text exactly."""
    lines = segments_path(page["page"]).read_text(encoding="utf-8").split("\n")
    segments = [parse_segment_line(line, n) for n, line in enumerate(lines, start=1) if line]
    joined = "".join(seg["text"] for seg in segments)
    if joined != page["text"]:
        raise SegmentFileError("segments do not reproduce the page " + first_mismatch(page["text"], joined))
    return segments


# ── Output ───────────────────────────────────────────────────────────────────

def page_path(number: int) -> Path:
    return OUT_DIR / f"page-{number:03d}.json"


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")


def build(meta: dict, pages: list[dict]) -> None:
    """Write every page that has a valid segment file. The reader gets the leading run of
    built pages, so a partly segmented novel is still readable up to the first gap."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    built: list[int] = []
    errors: list[str] = []
    for page in pages:
        if not segments_path(page["page"]).exists():
            continue
        try:
            segments = read_segments(page)
        except SegmentFileError as error:
            errors.append(f"page {page['page']}: {error}")
            continue
        write_json(page_path(page["page"]), {"page": page["page"], "chapter": page["chapter"], "segments": segments})
        built.append(page["page"])

    readable = next((n for n in range(1, len(pages) + 1) if n not in built), len(pages) + 1) - 1
    chapters = []
    for page in pages[:readable]:
        if not chapters or chapters[-1]["title"] != page["chapter"]:
            chapters.append({"title": page["chapter"], "page": page["page"]})
    write_json(OUT_DIR / "index.json", {
        "id": NOVEL_ID,
        "title": meta["title"],
        "author": meta["author"],
        "pageCount": readable,
        "totalPages": len(pages),
        "chapters": chapters,
        "credit": meta["credit"],
        "changesNote": CHANGES_NOTE,
    })

    print(f"Built {len(built)} of {len(pages)} pages; readable in the app: 1–{readable}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)


def print_plan(pages: list[dict]) -> None:
    lengths = [len(page["text"]) for page in pages]
    print(f"{len(pages)} pages, {sum(lengths)} chars, "
          f"min {min(lengths)} / avg {sum(lengths) // len(lengths)} / max {max(lengths)} chars per page")
    chapter = None
    for page in pages:
        if page["chapter"] != chapter:
            chapter = page["chapter"]
            print(f"  p{page['page']:>3}  {chapter}")


def print_page(page: dict) -> None:
    ruby = "、".join(dict.fromkeys(f"{base}（{reading}）" for base, reading in page["ruby"]))
    print(f"# page {page['page']} · {page['chapter']}")
    print(f"# furigana: {ruby or '(none)'}")
    print(page["text"].replace(PARAGRAPH_BREAK, f"\n{PARAGRAPH_MARK}\n"))


def print_report() -> None:
    index = json.loads((OUT_DIR / "index.json").read_text(encoding="utf-8"))
    total: Counter = Counter()
    for number in range(1, index["pageCount"] + 1):
        for seg in json.loads(page_path(number).read_text(encoding="utf-8"))["segments"]:
            if seg.get("meaning"):
                total[seg.get("jlpt", "none")] += 1
    words = sum(total.values())
    if not words:
        print("No built pages yet.")
        return
    print(f"Content words in pages 1–{index['pageCount']} of {index['totalPages']}: {words}")
    cumulative = 0
    for level in JLPT_LEVELS:
        cumulative += total[level]
        print(f"  {level}: {total[level] / words:6.1%}   known by a {level} reader: {cumulative / words:6.1%}")
    print(f"  no level (names, rare words): {total['none'] / words:.1%}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--plan", action="store_true", help="paging stats only")
    parser.add_argument("--show", type=int, metavar="N", help="print page N and its furigana")
    parser.add_argument("--report", action="store_true", help="JLPT distribution of the built pages")
    args = parser.parse_args()

    if args.report:
        print_report()
        return

    meta, pages = load_pages()
    if args.plan:
        print_plan(pages)
    elif args.show:
        print_page(pages[args.show - 1])
    else:
        build(meta, pages)


if __name__ == "__main__":
    main()
