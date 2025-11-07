Smythe (S.U.C) IQ - Master Package (No Mobile Money)

This master package contains the full project scaffold ready for deployment,
excluding Mobile Money (MoMo) integrations per your request.

Included:
- backend/: Express.js server with OpenAI, Stripe, Auth, Courses, Surveys, Socket.IO chat, file uploads (S3 placeholder), payouts (bank/manual)
- frontend/: React + Tailwind-ready app (AI, Chat, Courses, Surveys, Marketplace, Auth)
- scripts/: create_admin.js to create an admin user
- seeds/: seed.sql with sample data
- docker/: Dockerfile and docker-compose for local testing
- .github/: CI workflows
- DEPLOY.md: deployment instructions (Render backend, Netlify frontend)

IMPORTANT:
- Do not commit secrets to GitHub. Use environment variables as described in .env.example.
- For payments use Stripe (card) and bank transfers (manual confirmation). Donation phone/bank info stored via env vars.
