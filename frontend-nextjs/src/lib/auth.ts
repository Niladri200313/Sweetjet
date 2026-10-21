import { betterAuth } from "better-auth";
import { DatabaseSync } from "node:sqlite";
import path from "path";

// Initialize SQLite database
const dbPath = path.join(process.cwd(), "auth.sqlite");
const db = new DatabaseSync(dbPath);

// Automatically initialize schema tables if not present
db.exec(`
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expiresAt INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id)
  );

  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id),
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );
`);

export const auth = betterAuth({
  database: db,
  baseURL: process.env.BETTER_AUTH_URL || (process.env.NODE_ENV === "production" ? "https://sweetjet.site" : "http://localhost:3000"),
  trustedOrigins: [
    "https://sweetjet.site",
    "https://www.sweetjet.site",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ],
  secret: process.env.BETTER_AUTH_SECRET || "vercel_clone_default_secret_fallback_key",
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "Ov23lig1hSbsuttQts1N",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "fc84b40ba43a77dcc6461fa59048df9d292d7c82",
    },
    ...(process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
          },
        }
      : {}),
  },
});
