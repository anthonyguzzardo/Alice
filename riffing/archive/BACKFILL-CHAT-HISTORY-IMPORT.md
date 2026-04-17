# Backfill Plan

## Goal
Skip the 30-day cold start by importing reflective messages from existing LLM chat history. Text unlocks the pipeline; behavioral signals accumulate honestly over time.

## What to extract
- **Your messages only** (not the AI's responses)
- **Reflective/personal** — not debugging, not transactional
- **~50+ words** — one-liners aren't journal entries
- Sources: ChatGPT export (`conversations.json`), Claude chats, anything else

## Format
Save curated entries to `data/backfill.json`:

```json
[
  {
    "question": "What the AI asked or what prompted this reflection",
    "response": "Your actual reflective message",
    "date": "2026-03-15"
  }
]
```

- Backdate across ~30 days (roughly one per day)
- Aim for 30-35 entries to cross the seed threshold

## What the ingestion script will do
1. Schedule backdated questions
2. Save responses
3. Run `computeLinguisticDensities(text)` — all 9 NRC/Pennebaker metrics
4. Run `embedResponse()` — populate RAG index
5. Save session summaries (linguistic filled, behavioral NULL)
6. Run observation pipeline retroactively on each entry

## What this unlocks immediately
- Question generation (gated behind 30 responses)
- RAG similarity retrieval across all entries
- Reflections (pattern synthesis)
- Predictions (falsifiable claims)
- Trait dynamics (linguistic dimensions)

## What still needs real time
- Behavioral signals: keystroke timing, P-bursts, deletion patterns, commitment ratio
- Session deltas (calibration vs journal comparison)
- Full 8D entry states (behavioral dimensions will be partial)
- ~2 weeks of live use to start validating behavioral layer
- ~30 days for meaningful behavioral baselines
