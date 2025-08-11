# TrustHive Dashboard (Next.js)

This scaffold provides a small Next.js (App Router) dashboard using Prisma + SQLite for development.

Quick start:

1. cd dashboard-next
2. cp .env.example .env
3. npm install
4. Install Tailwind and PostCSS deps:
   `npm install -D tailwindcss postcss autoprefixer`
   and generate the Tailwind output (if needed). Next will pick up the config.
4. npx prisma generate
5. npx prisma db push
6. npm run dev

Notes for Tailwind + shadcn UI:
- This scaffold includes simple shadcn-like primitive components in `components/ui/`.
- After installing Tailwind deps, the `@tailwind` directives in `app/globals.css` will be processed during build.

Endpoints:
- `POST /api/register` - register a shop (body: `{ site_url }`)
- `POST /api/reviews` - accept reviews from the WP plugin
- `GET /dashboard?shop=...&ts=...&token=...` - dashboard UI (SSO token required)

Notes:
- This scaffold is intentionally minimal. For production use Postgres and secure secret storage.
