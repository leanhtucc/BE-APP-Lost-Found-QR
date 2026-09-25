# Phase 4 integration policy

## Found-report claim resubmission

A claimant may submit only one claim for a given found report. `REJECTED` and
`WITHDRAWN` are final for that `(foundReportId, claimantId)` pair; a corrected
claim is not created automatically. The claimant must use the support/appeal
process so the finder is not repeatedly exposed to rewritten ownership stories.

This is enforced by `@@unique([foundReportId, claimantId])`. If product policy
later permits resubmission, it requires a versioned claim-attempt model and an
explicit abuse/rate-limit policy; the unique constraint must not simply be
removed.

## Stream/DB ordering and recovery

The database is committed first and the Stream channel uses the deterministic
`return_<ReturnSession.id>` ID.

- If the database operation fails, Stream is never called, so no orphan channel
  can be created by this workflow.
- If Stream creation fails after the database commit, the retry finds the same
  ReturnSession and recreates the same deterministic channel. The item remains
  `FOUND`, but the flow is recoverable and no second session/channel is created.
- Compare-and-set on `Item.status = LOST` allows only one finder to win.
- Found-report acceptance is protected by the partial unique index
  `found_report_claims_one_accepted_per_report` and its losing transaction rolls
  back its ReturnSession.

## Safe integration database

The destructive Phase 4 integration suite requires `PHASE4_TEST_DATABASE_URL`.
The shared guard compares the runtime `DATABASE_URL` and `DIRECT_URL` against
both the declared TEST target and the production reference. Remote Supabase
projects with the default `postgres` database name also require
`PHASE4_TEST_DATABASE_CONFIRMED=true` and distinct project refs.

For physical acceptance testing, use `npm run dev:phase4`. The wrapper reads
`PHASE4_TEST_DATABASE_URL` or `DATABASE_URL_TEST`, validates it before importing
the server, and maps both runtime database variables to that TEST target. It
fails closed when the production comparison or TEST classification is missing.

## Stream acceptance environment

The current local environment exposes one `STREAM_API_KEY`/`STREAM_API_SECRET`
pair and does not expose a separately named development credential. Treat that
pair as unclassified until the project owner confirms that it belongs to a
test/development Stream app. If a separate app is unavailable, physical testing
must use dedicated test users, deterministic `return_<ReturnSession.id>` channel
IDs, and an explicit cleanup pass so real users and channels are not affected.
