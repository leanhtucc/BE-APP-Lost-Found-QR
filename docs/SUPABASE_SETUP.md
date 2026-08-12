# Supabase backend setup

The backend now uses Supabase PostgreSQL through Prisma 7, Supabase Storage for uploaded images, PostGIS for map queries, and LangChain with Google Gemini for AI features.

## 1. Configure Supabase

Create a new Supabase project. Data from the old Neon database is not required.

In the Supabase dashboard:

1. Enable **PostGIS** under **Database → Extensions**.
2. In **SQL Editor**, create the Prisma database role shown below. Replace the example password.
3. Open **Connect** and copy the session-pooler PostgreSQL URL to `DATABASE_URL`; change its user to `prisma`.
4. Copy the direct database URL to `DIRECT_URL`; change its user to `prisma`. If the deployment host cannot use IPv6, use an appropriate Supavisor URL for migrations.
5. Create a **public** Storage bucket named `item-images`.
6. Copy the project URL and server-side service-role key to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
7. Never expose the service-role key to the mobile or web client.

```sql
create user "prisma" with password 'replace-with-a-strong-password' bypassrls createdb;
grant "prisma" to "postgres";
grant usage, create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;
alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;
```

Copy `.env.example` to `.env`, then replace all placeholders. The PostgreSQL URLs should include `sslmode=verify-full` so future `pg` versions keep strict certificate verification without an SSL compatibility warning.

## 2. Create the schema and fake map data

Run these commands from the repository root:

```bash
npm ci
npm run prisma:deploy
npm run seed
```

`npm run seed` is intentionally destructive. It clears existing application rows and recreates:

- 10 lost items around Hanoi;
- 10 active searching posts;
- 3 active map-user locations;
- 1 verified fake owner.

PostGIS and its spatial index are created by the migrations.

## 3. Configure AI

Set `GOOGLE_API_KEY` to a Google AI Studio API key. `AI_MODEL` defaults to `gemini-2.5-flash`.

AI endpoints:

- `POST /v1/ai/analyze-item`
- `POST /v1/ai/conversations`
- `GET /v1/ai/conversations`
- `GET /v1/ai/conversations/:conversationId/messages`
- `POST /v1/ai/conversations/:conversationId/messages`
- `DELETE /v1/ai/conversations/:conversationId`

All AI endpoints require a bearer token. Conversation history is stored in Supabase PostgreSQL.

## 4. Verify the backend

```bash
npm run typecheck
npm test
npm run build
npm run dev
```

Useful checks:

- `GET /health/live` checks the Node process.
- `GET /health/ready` checks the database connection.
- `GET /api/map/nearby?lat=21.0285&lng=105.8542&radius=5000`
- `GET /api/map/active-users?lat=21.0285&lng=105.8542&radius=5000`

The map endpoints require a bearer token and use PostGIS distance queries.
