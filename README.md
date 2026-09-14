# AI-Powered Micro-CRM

**Live demo: <https://ai-micro-crm.vercel.app>** · Running on Gemini, no setup needed.

A triage tool for a small business owner selling an AI phone-answering product to dental practices. It opens on the question the owner actually has each morning — *who needs me today, and what should I do about them?* — and answers it from the raw interaction notes, with every claim traceable back to the note it came from.

## Running it

```bash
npm install
npm run dev          # starts the API on :3001 and the UI on :5173
```

Open <http://localhost:5173>.

**The app runs without an API key**, using a rule-based fallback (see below). To enable the real AI path:

```bash
cp server/.env.example server/.env   # then set your key
```

Two providers are supported behind the same `InsightProvider` interface — set either in `server/.env`:

```bash
# Google Gemini
AI_PROVIDER=gemini
AI_MODEL=gemini-3.6-flash
GEMINI_API_KEY=...

# or Anthropic Claude
AI_PROVIDER=anthropic
AI_MODEL=claude-opus-5
ANTHROPIC_API_KEY=sk-ant-...
```

Tests: `npm test`.

### Deploying

The app builds into a single deployable unit — `npm run build` compiles the server to `server/dist` and the client to `client/dist`, and `npm start` serves both from one Node process on one port (no CORS, no second service).

For Vercel, `vercel.json` is included: the Vite build is served from the CDN and `api/index.ts` exports the same Express app as a serverless function, so the deployed API and the local one are the same code path. Set `AI_PROVIDER`, `AI_MODEL`, and your key as project environment variables. `maxDuration` is raised to 60s because the first request analyzes all twelve accounts (~12s) before the cache warms.

---

## What I built, and why

The brief lists four needs. I read them as **one problem with a substrate underneath it**, not four features:

| Brief's need | Where it lives |
|---|---|
| Keep track of relationships and interactions | The data layer — customers, contacts, timeline. Infrastructure, not a feature. |
| Understand who needs attention | Urgency ranking on the dashboard |
| Quickly understand context for a customer | The account summary |
| Decide what action to take next | The suggested next action |

Needs 2, 3, and 4 are produced by **a single structured AI call per customer**, not three separate calls. That was the central design decision. If you generate them independently, they can contradict each other — the urgency model says "cold, chase them" while the action model says "wait." Generating them together from one pass over the notes makes the urgency reason *the basis of* the suggested action by construction. You cannot decide what to do next correctly unless the context and the urgency assessment behind it are correct, so they should be one reasoning step, not three.

So the product is two screens:

- **Dashboard** — every account ranked by urgency, each row leading with *why* rather than a score, plus the suggested action.
- **Customer detail** — summary, suggested action, contacts, and the full interaction timeline, with the AI's citations rendered as chips that scroll to and highlight the exact note they refer to.

## The judgment test built into the sample data

The dataset contains a trap that separates a thoughtful implementation from a naive one. Several accounts have been quiet for weeks, and they need **opposite** treatment:

| Account | Situation | Correct call |
|---|---|---|
| Evergreen (`cust_011`) | Quiet 31 days, but `int_050` says *"Do not push aggressively before September planning meeting"* | **Not urgent.** Wait. |
| Lakeside (`cust_007`) | Quiet 44 days after pricing was sent; `int_031` says *"No response after pricing"* | **Urgent.** Re-engage. |
| Parkview (`cust_009`) | Asked whether onboarding can finish before Sept 15 — deadline is now | **Urgent.** Confirm the timeline. |
| Northstar (`cust_001`) | Proposal sent Aug 23, silence since | **Urgent.** Follow up. |
| Oak & Pine (`cust_004`) | Issue resolved; `int_017` says *"No additional follow-up required"* | **Not urgent.** |
| Willow Creek (`cust_010`) | Quiet 166 days, but *"Customer appears satisfied"* | **Not urgent** — contentment, not a stalled deal. |

A `days_since_last_contact > N` sort gets Evergreen, Oak & Pine, and Willow Creek wrong, and would have the owner pestering a customer who explicitly asked to be left alone. That is the concrete case for putting an LLM here rather than a threshold: the signal is in the prose, not the dates.

Both the AI path and the heuristic fallback handle all six. Three are asserted in the test suite.

**The AI path went one better than the spec on Evergreen.** The reference date is Sept 14 — and the live model noticed that the "September planning meeting" the hold was waiting for *has now arrived*, so instead of "wait" it recommends following up on the meeting's outcome, with the hold note itself (`int_050`) as its citation. The regex heuristic still says "hold off" because it can only match the hold phrase, not reason about whether the hold has expired. That gap — same data, same rules, different depth of reading — is the clearest demonstration in the project of where the AI genuinely earns its cost.

## Key technical decisions

**Grounded citations, validated in code.** The model must return the interaction IDs its urgency claim and its suggested action rest on. Before anything reaches the UI, `validateInsight` checks every cited ID against that customer's real history. Hallucinated IDs are stripped; if no valid citation survives for either claim, the insight is flagged low-confidence and the UI says so. This is the reliability mechanism, not a nicety — it means no claim reaches the owner that they can't click through and check against the source note, and it turns "the AI said so" into something verifiable.

**Heuristic fallback as a first-class path.** With no API key, a rule-based provider produces the same output shape: recency bands, boosted by stall phrases (*"no response"*, *"inactive"*), suppressed by hold phrases (*"do not push"*, *"no additional follow-up required"*), boosted by deadline language. The UI badges every insight as `AI` or `heuristic` so degradation is never silent. It exists for two reasons: a reviewer can run the app immediately, and it's a working demonstration of *why* the AI path is better. The heuristic passes the six cases above only because I hand-tuned its regexes against this specific dataset — it would fail on the seventh phrasing it hasn't seen. The AI path generalizes; that's the whole argument for spending the tokens.

**Interfaces at the two axes that would actually change.** `CrmRepository` (data) and `InsightProvider` (reasoning) are ~20 lines of TypeScript each. They cost almost nothing and mean a SQL backend or a different model is a new class plus one wiring line, not a rewrite — demonstrated concretely: Gemini support was added as one new provider class (`gemini.ts`) sharing the same prompt, schema, and citation validation, with zero changes to routes, cache, or UI. Provider fallback is strategy chaining rather than `if`-branches scattered through routes, which also makes `validateInsight` and the heuristic pure functions testable without a network.

**Content-hash cache with per-customer invalidation.** Insights are keyed by a hash of the customer's interaction history and mirrored to disk so restarts don't re-spend tokens (the mirror is an optimization, not a requirement — on a read-only filesystem it degrades to memory-only rather than failing; see Assumptions). Logging an interaction invalidates only that customer, so the model runs for the one account whose history changed rather than recomputing all twelve. At larger N this is the same seam you'd put a queue behind.

**A fixed `REFERENCE_DATE` (2026-09-14).** The dataset is set in 2026. Using the real clock would make every account look ancient and Parkview's Sept 15 deadline meaningless. One constant in `config.ts`, used by both the prompt and the heuristic.

## Design notes

The app opens directly on a compact relationship queue. A compact heading carries the demo date and a clickable attention count that opens the full attention queue, clearing search and type filters. The All relationships tab carries the total count; there is no introductory hero or summary banner. Search, relationship-type filters, and Needs attention / All relationships tabs make the twelve accounts easy to scan; URL parameters preserve the view when returning from an account.

A warm off-white canvas, white surfaces, restrained teal actions, and neutral status labels keep the emphasis on the next conversation. Urgency retains conventional red/amber labels. The layout stacks on mobile, and interactive controls include keyboard focus and reduced-motion support.

Account details lead with the summary and recommended next step, followed by the interaction timeline. Source buttons show the interaction type, contact, and date; clicking one scrolls to, focuses, and highlights the original note. AI and rule-based insights remain explicitly labeled, including warnings for unverified citations.

Logging an interaction opens a drawer; successful saves close it and refresh the account. Failed saves retain the form. Inline retry states keep failed requests from becoming indefinite loaders, and account history remains available when insights fail.

The UI obtains its reference date from `GET /api/config`, including the default interaction date. No follow-up drafting or sending was added in this UI polish pass.

Validation: `npm test`, `npm run build`, `npm run typecheck -w server`, and `npx tsc --noEmit` in `client/`.

## Assumptions and simplifications

- **No database.** CSVs are parsed into memory at boot. Interactions logged through the UI also append to a JSON side-file, so they survive a restart when the filesystem is writable — running locally, or on any host with a real disk. On a serverless host the write is refused, and both the interaction store and the insight cache degrade to in-memory for the life of that instance rather than erroring. That's why **notes logged on the hosted demo don't persist indefinitely**; the log → re-analyze → updated-insight loop works fully, it just resets when the instance recycles.

  This is a deliberate stopping point, not an oversight. The brief allows simplifying infrastructure, and `CrmRepository` is the seam a `SupabaseRepository` or `PostgresRepository` would slot into — the same way `GeminiInsightProvider` slotted in alongside Claude without touching routes, cache, or UI. Given the choice between spending the last hour on database plumbing (which demonstrates nothing about product judgment) and leaving a clean interface with an honest note, I chose the interface.
- **No auth or multi-user.** Single-owner tool.
- **Insight generation is synchronous.** Twelve parallel calls on first load, cached thereafter. At real scale this belongs in a background job.
- **Types are duplicated** between `server/src/types.ts` and `client/src/types.ts` rather than extracted into a shared package — not worth the build tooling at this size.
- **Tests cover the pure core only** — citation validation and heuristic rules. No UI or end-to-end tests.

## What I deliberately did not build

- **A chat interface.** Tempting, and it maps to none of the four stated needs. The owner doesn't want to interview their CRM; they want it to have already done the reading.
- **Editing customers and contacts.** CRUD forms would have consumed the time that went into the grounding and validation layer, and demonstrate nothing.
- **Manually-maintained deal stages or sentiment fields.** The source data has none, and adding them creates a second source of truth that drifts from the notes. Everything is derived.
- **Pagination, auth, a state library.** Twelve accounts and two routes; lightweight search and filtering are handled in the client.

## What I'd do next

1. **Close the loop on suggestions.** Let the owner accept or dismiss a suggested action and feed that back — the single highest-value signal for improving quality, and it's currently thrown away.
2. **Ingest email and calendar directly.** The notes are hand-written today, which is the manual effort the product claims to remove. Auto-drafting interactions from a mail thread is the real version of this.
3. **Draft the follow-up, not just name it.** "Send a re-engagement follow-up" is one click short of useful; generating the actual email text, grounded in the same citations, is the natural next step.
4. **Batch generation as a background job** with webhook or SSE updates, so the dashboard is instant rather than waiting on twelve calls.
5. **An eval set over the judgment cases.** The six cases above are checked by hand and partially in unit tests. They should be a scored eval that runs against prompt changes, so prompt edits can't silently regress the Evergreen case.
6. **Summarize older history** once a single account's interactions outgrow the context window — hidden inside the provider, invisible to callers.

## Architecture

```
api/index.ts                   Vercel serverless entry — exports the same Express app

server/                        Express + TypeScript
  src/app.ts                   Builds the Express app (separate from the listener
                               so it can also run as a serverless handler)
  src/index.ts                 Local/self-hosted entry — app + static client + listen
  src/repository.ts            CrmRepository interface (data-access boundary)
  src/csvRepository.ts         CSV/in-memory implementation
  src/insights/provider.ts     InsightProvider interface + validateInsight (citation checking)
  src/insights/prompt.ts       Shared system prompt, JSON schema, prompt builder
  src/insights/claude.ts       ClaudeInsightProvider — Anthropic structured output
  src/insights/gemini.ts       GeminiInsightProvider — Gemini responseSchema JSON
  src/insights/heuristic.ts    HeuristicInsightProvider — rule-based fallback
  src/insights/index.ts        Provider selection and fallback chaining
  src/cache.ts                 Content-hash cache, file-mirrored
  src/routes.ts                HTTP layer only
  src/config.ts                REFERENCE_DATE, model id, env
  data/                        The three sample CSVs

client/                        Vite + React + Ant Design
  src/pages/Dashboard.tsx      Urgency-ranked account list
  src/pages/CustomerDetail.tsx Summary, action, timeline, log form
  src/components/              UrgencyTag, InsightCard, InteractionTimeline, InteractionForm
```

Routes do HTTP, providers do reasoning, the repository does data, the cache does caching — each replaceable in isolation.

### API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/config` | Demo reference date |
| `GET` | `/api/customers` | List with last-touch and interaction count |
| `GET` | `/api/customers/:id` | Customer + contacts + interactions |
| `GET` | `/api/insights` | All insights (batched, cached) |
| `GET` | `/api/insights/:id` | One insight |
| `POST` | `/api/insights/:id/regenerate` | Force regeneration |
| `POST` | `/api/interactions` | Log an interaction; invalidates that customer's insight |
