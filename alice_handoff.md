# Alice Rename Handoff

## What

Rename the entire system from "Marrow" to "Alice." Every reference — code, database path, package name, comments, UI text, documentation, filenames — all of it.

## Why

Bob is named after the canonical receiver in Alice-and-Bob communication protocols. The name isn't decorative — it describes exactly what he does. He receives behavioral signal and becomes something from it.

Alice is the sender. The journal is where you write. You are Alice. The journal is Alice. Alice sends to Bob.

"Marrow" was a beneath-the-surface metaphor — depth, bone, core. It worked, but it's a standalone concept. It doesn't connect to anything else in the system. "Alice" turns the entire architecture into a single coherent metaphor: Alice sends, Bob receives, the protocol between them is the product.

The name isn't branding. It's the system described in one word.

## Scope

- `data/marrow.db` → `data/alice.db`
- Package name in `package.json`
- Any references in `CLAUDE.md`
- Code comments mentioning "Marrow"
- Database path references in `src/lib/db.ts` and anywhere else
- Page titles if any reference Marrow
- This file can be deleted after the rename is complete
