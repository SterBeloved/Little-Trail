# Little Trail private statistics

## Status

This code needs a one-time Cloudflare D1 binding and private dashboard password before statistics become available. Updating GitHub alone does not deploy the manually managed `little-trail-api` Worker. Existing planning and feedback continue working with the older Worker; the frontend only sends timing receipts when the updated Worker issues one.

## One-time dashboard setup

1. In Cloudflare, open **Storage and databases → D1 SQL database → Create database**. Name it `little-trail-stats`.
2. Open its SQL console, paste `backend/schema.sql`, and execute it. It only creates a new metrics table and index.
3. Open **Workers and Pages → little-trail-api → Settings → Bindings → Add binding → D1 database**. Use binding name **STATS_DB**, selecting `little-trail-stats`.
4. Keep the existing `DIFY_API_KEY`, `ALLOWED_ORIGINS`, and `PLANNER_LIMITER` settings. Do not replace or expose these secrets.
5. Under variables and secrets, create **ADMIN_PASSWORD** as a **Secret**. Set a unique random password of at least 24 characters yourself. Never put it in GitHub, a URL, or chat. The private dashboard username is **admin**.
6. Add a text variable **WORKFLOW_VERSION**, initially `workflow-20261122-preparation`. This is your own release label; change it after publishing a Dify workflow revision. Dify's public completion event does not provide a reliable published release number.
7. Replace the Worker's code with the complete `backend/worker.js` file and deploy. It is a standalone ES module; no other imports are needed. Preserve existing bindings and secrets when using the editor.
8. Visit `https://little-trail-api.shianqi1116.workers.dev/admin`. Enter username **admin** and the password you set. This page and its data/CSV endpoints all require authentication. If no password is configured, they return 503 rather than displaying data publicly.
9. Refresh the GitHub Pages frontend, fill a sample, and generate once. Check the new record in `/admin`, then use its `run_id` to match any Formspree feedback.

If using Wrangler instead, fill in the actual D1 database ID in `wrangler.jsonc` before deploying. Do not deploy with its placeholder. Create the secret interactively with `npx wrangler secret put ADMIN_PASSWORD`, execute `schema.sql` against the remote D1 database, and ensure `DIFY_API_KEY` is already set for `little-trail-api`.

## What is recorded

- Random run reference (the same `web-...` value sent to Dify and feedback).
- Start/end timestamps, success/failure/stopped/incomplete state.
- Dify elapsed seconds and total token usage from its completion event.
- Proxy elapsed milliseconds.
- Browser-reported wait time through result rendering, when received.
- Equipment-shopping enabled/disabled, frontend release, workflow label and proxy release.
- A hashed one-use receipt used to authenticate the browser timing update.

No form answers, routes, dates of the hike, exercise history, generated plans, email addresses, raw upstream errors, passwords, or IP addresses are written to the metrics table. Cloudflare/Dify still have their existing service logs and Dify inputs; this table is deliberately smaller. Per-run references are pseudonymous and can be linked to Dify/feedback records by the owner.

## Reading the dashboard

Filter by 7, 30, or 90 days and by shopping branch. The workflow label filter is an exact match. The display shows Hong Kong time.

Success rate = succeeded / finished requests; running requests are excluded. Requests still marked running after 15 minutes display as incomplete (the database row is not deleted). A stopped or interrupted stream may not report Dify tokens; missing values remain blank, not zero. Tokens are not currency.

Median Dify time and browser wait use successful requests with available measurements. Browser timing can be missing when the page closes, a network request fails, or an older frontend is used; it is client-reported, not authoritative billing data. A slow or malicious client can report inaccurate timing, so compare it with Dify/proxy measurements. Invalid receipt tokens and repeated reports cannot update a record.

Summaries and CSV cover at most the latest 10,000 matching records and warn when capped. The on-screen table shows 200. No daily/monthly job or extra model call is required.

Formspree feedback remains separate. Its `run_id` matches the table's run reference. No Formspree account credential is embedded in the dashboard.

## Tests and rollback

Run `node --test worker.test.js` using Node 24 or later. Tests use a local in-memory SQLite database and mocked upstream responses; they do not call Dify or consume model tokens.

Cloudflare keeps deployment history. If the updated Worker causes problems, roll back to the previous Worker deployment. The frontend remains compatible and simply skips metrics when no receipt header is issued. The D1 database can stay bound during rollback.

## Technical references

- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/workers/runtime-apis/streams/
