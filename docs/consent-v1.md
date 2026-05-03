# Alice - Subject Consent (v1)

**No external AI ever reads what you wrote.** Not for training, analysis,
or any product improvement. OpenAI, Anthropic, Google, and every other AI
service stay outside this system. The software here measures *how* you
typed (keystroke timing, pauses, vocabulary patterns), not *what* you
said. A small embedding model runs on the operator's laptop to compute
numerical similarity between your entries; the model itself never leaves
that laptop, and only its numerical outputs (vectors of numbers, not
summaries) are stored in the database.

## What we collect
- Text of your responses and calibration entries
- Keystroke timings and edit history (per-character timing, deletions) —
  these allow timing-based replay of how a session unfolded
- The prompts the system showed you
- Numerical signals derived from the above: typing dynamics, complexity
  measures, vocabulary statistics, similarity to your own past entries

## Why
We're studying writing-by-keystroke as a measurement of cognitive state
over time. Your daily entries build a personal baseline; deviations from
*your own* baseline are the signal of interest. Cross-subject comparison
is not the goal — the instrument is built around within-person change.

## Where it lives
The application server runs on a Hetzner VPS in Hillsboro, Oregon. The
database is hosted by Supabase in their us-west-2 region (also Oregon).
All data stays in the United States.

## How it's stored
Every text and keystroke field is encrypted at rest using AES-256-GCM
(industry-standard authenticated encryption). The encryption key is held
by the operator alone. It is never transmitted to a third-party service.
The production server's underlying disk is also encrypted at rest, with
a passphrase known only to the operator. What encryption cannot protect
against is compromise of a machine while it is running with data
decrypted in memory — the live application server, or the operator's
laptop while they are working with the system locally.

## External AI for question authoring
The operator may use external AI services to draft candidate prompts for
the shared question pool. Those drafts are operator-reviewed before any
subject sees them. Your responses are never used as input to these
drafts.

## Your rights

**Export.** You can download your responses, the prompts you saw, your
behavioral signals, and your account history at any time, as
machine-readable JSON. Derived numerical artifacts used only for internal
computation (embeddings of your text, reconstruction residuals from the
signal models) are not included — they're regenerated from the
underlying data and aren't separately meaningful.

**Delete.** You can close your account at any time. Your journal content
and behavioral signals are removed from the active system immediately
and from encrypted backups within up to 7 days as the normal backup
rotation overwrites them. After that, no copy remains. A minimal record
(subject ID, consent acknowledgments, deletion timestamp) is retained
indefinitely as a research integrity audit trail.

Export and delete are unconditional. You can use either at any time —
including when you have declined to re-acknowledge an updated consent
version. The right to take your data with you, or to leave entirely,
does not depend on agreeing to anything new.

## Who can see what
The operator can see the numerical signals derived from your writing,
the prompts you saw, and timing-based replays of your sessions — with
every letter and digit redacted server-side, before the data reaches
the operator's view, so only the timing pattern is visible. The
operator does not see what you wrote, ever, through any operator-facing
surface. Other subjects can never see your data.

## Questions
Contact the operator directly at anthony@mrfoxco.com.

## Consent versions
This is consent version v1. If we update the terms, you'll be asked to
re-acknowledge the new version on your next login. You may always export
or delete your account, even before re-acknowledging.
