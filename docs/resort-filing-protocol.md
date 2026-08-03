# Resort filing protocol

How the second pass of Resort asks a model to file bookmarks, and why it uses
numbers instead of names.

## The problem

Resort runs in two passes. The first proposes a folder structure. The second
walks the library in batches of 100 and asks the model which folder each
bookmark belongs in.

The second pass used to speak in full identifiers. Every bookmark went out with
its 26-character ULID, and every answer came back carrying that ULID plus the
complete folder path:

```json
{ "filings": [{ "id": "01J8ZQK3M5N7P9R2T4V6X8Y0AB", "path": ["Software Development", "Rust"] }] }
```

That costs roughly 30 output tokens per bookmark, and about 13 of them are the
id alone — ULIDs are random, so a tokenizer chews through them two or three
characters at a time. A full batch of 100 needs around 3,000 output tokens to
say what amounts to a hundred small choices.

The cost is the smaller half of the problem. Output tokens are five times the
price of input tokens, but a resort of 500 bookmarks still only runs a few
cents. The real damage was reliability: a reply that long ran into the response
ceiling and got cut off mid-object, which surfaced as "Could not file any
bookmarks — 1 of 1 request failed" with no explanation. Shrinking the reply
moves the whole failure mode further away.

## The design

Number everything in the prompt, and let the model answer in numbers.

Folders are enumerated once:

```
Available folders (index. path, top → leaf):
0. Cooking > Sourdough
1. Software Development > Rust
2. Electronics > Soldering
```

Bookmarks are enumerated too, and the ULID never appears:

```
Bookmarks to file (index — title — domain — current folder):
0 — Understanding ownership — rust-lang.org — Unsorted
1 — No-knead bread — kingarthur.com — Unsorted
```

The reply is a list of pairs — bookmark index first, folder index second:

```json
{ "f": [[0, 1], [1, 0]] }
```

That is about 8 output tokens per bookmark instead of 30, and it drops the
input cost of each bookmark line by roughly a quarter because the id is gone.

Numbering also removes a whole class of failure. Under the old format the model
had to reproduce a folder path exactly, and any filing whose path didn't match
the skeleton was silently discarded — a near-miss on punctuation or wording
cost you that bookmark. An index either points at a real folder or it doesn't.

## What the parser accepts

The primary shape is `{"f": [[bookmark, folder], ...]}`. Models drift, so the
parser also accepts:

- `filings`, `results`, or `bookmarks` as the envelope key instead of `f`
- a bare top-level array, with no envelope at all
- object entries — `{"b": 0, "f": 1}` — instead of two-element arrays

Every entry is checked before it counts. Both values must be integers, both
must fall inside their list, and the first filing for a given bookmark wins if
the model names one twice. Anything that fails is dropped and the rest of the
batch still lands, which is the same tolerance the old parser had.

## What does not change

The parser still returns `{ id, path }` — real ULIDs and real folder paths —
so everything downstream of the planner is untouched. The diff, the preview
UI, and the apply step never learn that the wire format changed.

The output token budget also stays where it is, at 60 tokens per bookmark. It
is tempting to shrink it to match the smaller replies, but reserved tokens are
not billed — only generated ones are — so a smaller ceiling would save nothing
and would truncate the reply of any model that ignores the compact format and
answers the verbose way. The budget is headroom, not a cost.

## The trade-off

Indices change what a model error looks like. A wrong ULID was almost always a
made-up one, and the parser threw it away — the bookmark went unfiled and you
saw it in the unplanned count. A wrong index usually still points at a real
bookmark and a real folder, so a slip in the model's counting files something
in the wrong place instead of nowhere.

That is a quieter failure, and it is the reason to keep it visible: every
resort goes through the preview, where each move is listed and individually
checkable before anything is applied. The safeguard against a misfile is the
same as it has always been — you approve the diff. Worth watching on the
smaller preset models, which are the ones most likely to lose count partway
down a list of a hundred.

## Token math

For a full batch of 100 bookmarks, with three-level folder paths:

| | Before | After |
|---|---|---|
| Output | ~3,000 | ~800 |
| Input (bookmark lines) | ~4,200 | ~3,000 |

For a 500-bookmark library — five filing batches plus one skeleton pass — that
takes the whole run from roughly 30,000 input and 16,000 output tokens down to
about 24,000 and 5,000.
