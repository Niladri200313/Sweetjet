const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { betterAuth } = require('better-auth');
const { toNodeHandler } = require('better-auth/node');
const { DatabaseSync } = require('node:sqlite');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Enable CORS for Next.js frontend
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Initialize Better-Auth with built-in SQLite
const auth = betterAuth({
  database: new DatabaseSync('auth.sqlite'),
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${PORT}`,
  secret: process.env.BETTER_AUTH_SECRET || 'vercel_clone_secret_fallback_2026',
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
});

// Mount Better-Auth routes
app.all('/api/auth/*', toNodeHandler(auth));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Authentication-server', port: PORT });
});

// Public GitHub repos proxy helper (for auto-fetching user repos)
app.get('/api/github/repos/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=15`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'GitHub user not found or rate limited' });
    }
    const repos = await response.json();
    res.json(repos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Authentication Server running on http://localhost:${PORT}`);
  console.log(`Better-Auth mounted at http://localhost:${PORT}/api/auth`);
});
