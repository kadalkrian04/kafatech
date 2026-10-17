# Kafagu Tech Prosperous — Field Operations

A Next.js application for admin, dispatcher, and technician workflows. Deployment target: GitHub → Vercel → Neon PostgreSQL.

## Included

- Responsive login screen and responsive layout rules for desktop, tablet, and phone widths.
- Admin, dispatcher, and technician routes.
- API routes for authentication, users, customers, work orders/SPK, progress logs, photos, reports, and report reviews.
- `db/schema.sql`: PostgreSQL schema for Neon.
- `scripts/seed-admin.ts`: creates the first administrator using bcrypt. It loads `.env.local` through Next's environment loader.
- `.env.example`: names of required environment variables (no credentials).

## Local setup

1. Install Node.js LTS and run `npm install` in this folder.
2. Create `.env.local` from `.env.example` and fill the variables with your own credentials.
3. Create a Neon PostgreSQL project. Run the complete `db/schema.sql` in the Neon SQL Editor.
4. Create the first admin with a unique password of at least 12 characters:

   ```bash
   npm run seed:admin -- admin 'YOUR-UNIQUE-STRONG-PASSWORD' 'Kafagu Administrator'
   ```

5. Start local development using `npm run dev`, then open `http://localhost:3000/login`.
6. Run `npm run lint`, `npm run typecheck`, and `npm run build` before deployment. Fix any reported errors before proceeding.

## Environment variables

- `DATABASE_URL`: Neon PostgreSQL connection string.
- `SESSION_SECRET`: unique random secret, at least 32 characters.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: needed for technician photo/signature uploads.

Never commit `.env.local`, credentials, or database connection strings to GitHub. Set the same variables in Vercel Project Settings → Environment Variables. Use a unique production `SESSION_SECRET`.

## GitHub → Vercel → Neon deployment

1. Create a private GitHub repository and push the project files. Do not push `.env.local` or `node_modules`.
2. Import the repository into Vercel. Framework should be detected as Next.js; build command `npm run build`.
3. Add `DATABASE_URL` and `SESSION_SECRET` in Vercel environment variables. Add the three Cloudinary variables before testing uploads.
4. Deploy once, then run `db/schema.sql` in Neon SQL Editor if not already run.
5. Create the initial admin securely. Prefer running `npm run seed:admin` from a trusted local terminal with the production Neon `DATABASE_URL` temporarily set in `.env.local`; do not put the password in a committed file. Then remove the production connection string from local environment if no longer needed.
6. Redeploy only if environment variables changed, then test login, role permissions, customer/SPK operations, technician photo/report submission, and report review.

## Important limitations

- The SQL file is the schema script to execute in your own Neon project; this source package does not create or access a Neon account on your behalf.
- Cloudinary is required for actual photo/signature uploads.
- Mobile styles have been improved, but a real browser/device review and a complete production build have not yet been confirmed in this environment. Run the checks above and report any errors before treating the app as production-ready.
