Deployment Guide (Render backend + Netlify frontend)

1. Push repo to GitHub.
2. Create Postgres DB (Render or other) and set DATABASE_URL.
3. Set environment variables in your host per .env.example.
4. Deploy backend (Render/Heroku/Railway) using backend/server.js as start command.
5. Run DB migrations: apply backend/schema.sql to your Postgres DB.
6. Create admin: set ADMIN_EMAIL and ADMIN_PASSWORD and run `node scripts/create_admin.js`.
7. Deploy frontend to Netlify: build (cd frontend && npm run build) and publish frontend/build.
8. Configure Stripe webhook to /api/payments/webhook and set STRIPE_WEBHOOK_SECRET.
9. After deploy, verify OpenAI, Stripe, and S3 env vars are set.
