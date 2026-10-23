import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: headers() });
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Fetch all linked accounts for this user from Better Auth DB
        const db = (auth as any).options?.database;
        if (!db) {
            return NextResponse.json({ username: null, provider: null });
        }

        // Query the account table for GitHub account
        let githubAccount = null;
        try {
            const stmt = db.prepare(
                `SELECT accountId, providerId FROM account WHERE userId = ? AND providerId = 'github' LIMIT 1`
            );
            githubAccount = stmt.get(session.user.id);
        } catch { /* account table query failed */ }

        if (githubAccount?.accountId) {
            // accountId for GitHub is the numeric user ID — fetch login from GitHub API
            try {
                const ghRes = await fetch(`https://api.github.com/user/${githubAccount.accountId}`, {
                    headers: { 'User-Agent': 'SweetJet-CloudDeploy/1.0' },
                    next: { revalidate: 300 }, // cache 5 minutes
                });
                if (ghRes.ok) {
                    const ghUser = await ghRes.json();
                    return NextResponse.json({
                        username: ghUser.login,
                        name: ghUser.name || ghUser.login,
                        avatar: ghUser.avatar_url,
                        provider: 'github',
                    });
                }
            } catch { /* GitHub API failed */ }
        }

        // Fallback: use user name as username guess
        return NextResponse.json({
            username: session.user.name?.replace(/\s+/g, '') || null,
            name: session.user.name,
            avatar: session.user.image,
            provider: githubAccount ? 'github' : 'email',
        });

    } catch (err) {
        console.error('[/api/me/github]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
