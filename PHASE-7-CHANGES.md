# Phase 7 — AI report assistant

Extract into your project root; every path matches. **Nothing was deleted.**

## New files (9)

```
backend/src/services/aiService.js        the Claude call + all guardrails
backend/src/controllers/aiController.js  returns drafts; never writes clinical content
backend/src/routes/aiRoutes.js
backend/scripts/verify-phase7.js         40 checks, most run without an API key
backend/tests/aiGuardrails.test.js       9 tests — input screening, reply parsing
backend/tests/ownerSummaryGate.test.js   5 tests — the approval gate

frontend/components/AiBadge.jsx          provenance label
frontend/components/AiDraftPanel.jsx     rough notes -> drafted fields
frontend/components/OwnerSummaryPanel.jsx  draft, edit, release to owner
```

## Modified files (9)

```
backend/src/app.js                       mounts /api/ai
backend/src/models/MedicalRecord.js      aiAssisted + owner-summary fields
backend/src/controllers/recordController.js  the owner-summary gate
backend/src/routes/petRoutes.js          + /pets/:id/ai/draft-record
backend/src/routes/recordRoutes.js       + owner-summary endpoints
backend/package.json                     adds verify:7
backend/.env.example                     adds ANTHROPIC_API_KEY

frontend/components/RecordTimeline.jsx   AI badge + released summaries
frontend/app/(app)/pets/[id]/page.js     wires the panels in
```

## Setup

The assistant is **optional**. With no key the feature is hidden and everything
else works exactly as before.

```dotenv
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Key from https://console.anthropic.com. Then:

```bash
cd backend
npm test          # 71 tests, no key or database needed
npm run dev
npm run verify:7  # 40 checks; the AI ones skip cleanly without a key
```

**On Render**, add `ANTHROPIC_API_KEY` in the dashboard's Environment tab —
your local `.env` isn't deployed.

## New endpoints

```
GET  /api/ai/status                        is the assistant configured?
POST /api/pets/:id/ai/draft-record         [vet, admin] rough notes -> draft fields
POST /api/records/:id/ai/owner-summary     [vet, admin] draft a plain-language summary
PUT  /api/records/:id/owner-summary        [vet, admin] edit and/or release it
```

## How the framing is enforced

Your spec says this is a documentation assistant, not a diagnostic tool, and
that every output is a draft a vet approves. That's structural here, not a
disclaimer:

**1. There is no code path from the model to a patient record.** The drafting
endpoint returns JSON to the browser and writes nothing. The fields land in the
form the vet was already filling in, and saving goes through the normal record
endpoint. The vet pressing save *is* the sign-off.

**2. Clinical questions are refused before the model is called.**
`hasClinicalQuestion()` rejects "what's wrong with this dog?", "should I
prescribe...", "what dose of...", and similar, with an explanation. The system
prompt also forbids adding findings, diagnoses, treatments, or doses — but a
prompt alone isn't a safety mechanism, so there are three layers.

**3. Owners cannot see a summary until a vet releases it.** This is the one to
scrutinise. An unapproved summary isn't merely hidden in the UI — the server
blanks it before serialising, so it never reaches the owner's browser:

```js
ownerSummary: record.ownerSummaryApproved ? record.ownerSummary : ""
```

Editing a released summary withdraws approval automatically.

**4. Provenance sticks.** `aiAssisted` stays true however heavily the vet
rewrites the draft, and the record stores which vet approved it. The badge is
disclosure, not blame.

## Notes for review

- **Cost and latency are real.** Each draft is an API call taking a few
  seconds and costing a fraction of a cent. Consider a per-clinic monthly cap
  before you open this to paying customers — there's no rate limiting beyond
  Anthropic's own.
- **The refusal patterns are deliberately blunt.** They'll occasionally catch a
  legitimate note phrased as a question. That's the right direction to err, but
  watch for vets finding it annoying and rephrasing to get around it — that
  would be a signal the feature is being used for something it shouldn't be.
- **No audit log of AI usage.** You know a record was AI-assisted and who
  approved it, but not what the vet originally typed. If this handles real
  patient data, regulators may want the input retained too.
- **Owner summaries aren't in the PDF export yet** — same gap as vaccinations
  from Phase 6. Both are worth folding in before launch.
- **The model name is pinned in `.env`.** Anthropic deprecates models on a
  schedule; when `claude-sonnet-4-6` retires, change `ANTHROPIC_MODEL` rather
  than the code.
