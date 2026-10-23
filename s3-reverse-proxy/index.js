const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

const BASE_PATH = 'https://sweetjet.s3.us-east-1.amazonaws.com/__output';

app.use(async (req, res) => {
    const hostname = req.hostname;
    let subdomain = hostname.split('.')[0];

    const pathParts = req.url.split('?')[0].split('/').filter(Boolean);
    const querySlug = req.query.project || req.query.slug;

    // Support Path-based or Query-based slug for Real World / Tunnel URLs
    if (subdomain === 'localhost' || subdomain === '127' || subdomain === 'sweetjet' || subdomain === 'www' || subdomain.includes('loca') || subdomain.includes('ngrok') || subdomain.includes('cloudflare')) {
        if (querySlug) {
            subdomain = querySlug;
        } else if (pathParts.length > 0 && !pathParts[0].includes('.')) {
            subdomain = pathParts[0];
            const remainingPath = '/' + pathParts.slice(1).join('/');
            req.url = remainingPath === '' ? '/' : remainingPath;
        } else {
            // Root visited without project path: Render helpful live selector
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>CloudDeploy - Live Projects</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0F172A; color: #F8FAFC; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
                        .card { background: #1E293B; border: 1px solid #334155; border-radius: 20px; padding: 36px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
                        h1 { margin-top: 0; font-size: 22px; color: #fff; }
                        p { font-size: 13px; color: #94A3B8; line-height: 1.5; margin-bottom: 24px; }
                        .btn { display: flex; align-items: center; justify-content: center; width: 100%; padding: 14px 20px; margin: 10px 0; background: #000; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px; border: 1px solid #334155; transition: all 0.2s; box-sizing: border-box; }
                        .btn:hover { background: #38BDF8; color: #000; border-color: #38BDF8; }
                        .note { font-size: 11px; color: #64748B; margin-top: 24px; font-family: monospace; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div style="font-size: 32px; margin-bottom: 8px;">▲</div>
                        <h1>CloudDeploy Live Projects</h1>
                        <p>Select which deployed project you want to open:</p>
                        <a class="btn" href="/mac-os/">🚀 Open mac-os project</a>
                        <a class="btn" href="/p2/">⚡ Open p2 project (AnantaGita)</a>
                        <div class="note">Direct URL: ${hostname}/[project-slug]/</div>
                    </div>
                </body>
                </html>
            `);
        }
    }

    let cleanPath = req.url.split('?')[0];
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
        cleanPath = cleanPath.slice(0, -1);
    }
    const hasExtension = path.extname(cleanPath) !== '';

    // Candidate S3 URLs to try in priority order:
    const urlsToTry = [];

    if (cleanPath === '/' || cleanPath === '') {
        urlsToTry.push(`${BASE_PATH}/${subdomain}/index.html`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}/server/app/index.html`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}/server/pages/index.html`);
    } else if (cleanPath.startsWith('/_next/')) {
        // Next.js client chunks and assets mapping
        urlsToTry.push(`${BASE_PATH}/${subdomain}${cleanPath}`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}${cleanPath.replace('/_next/', '/')}`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}/static${cleanPath.replace('/_next/static', '')}`);
    } else if (hasExtension) {
        // Direct asset request (e.g. /About.png, /assets/index.js, /favicon.ico)
        urlsToTry.push(`${BASE_PATH}/${subdomain}${cleanPath}`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}/server/app${cleanPath}`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}/static${cleanPath}`);
    } else {
        // Clean URL route like /about, /contact, /project/stock-sim:
        // 1. Direct SSG HTML
        urlsToTry.push(`${BASE_PATH}/${subdomain}${cleanPath}.html`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}${cleanPath}/index.html`);
        
        // 2. Next.js App Router pre-rendered server/app HTML pages
        urlsToTry.push(`${BASE_PATH}/${subdomain}/server/app${cleanPath}.html`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}/server/app${cleanPath}/page.html`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}/server/app${cleanPath}/index.html`);
        
        // 3. Next.js Pages Router pre-rendered server/pages HTML pages
        urlsToTry.push(`${BASE_PATH}/${subdomain}/server/pages${cleanPath}.html`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}/server/pages${cleanPath}/index.html`);

        // 4. SPA Fallback for pure client-side routers
        urlsToTry.push(`${BASE_PATH}/${subdomain}/index.html`);
        urlsToTry.push(`${BASE_PATH}/${subdomain}/server/app/index.html`);
    }

    try {
        for (const s3Url of urlsToTry) {
            const response = await fetch(s3Url);

            // S3 returns 403 or 404 when object does not exist
            if (response.ok) {
                const contentType = response.headers.get('content-type') || '';
                
                // Do not serve S3 AccessDenied XML as valid content
                if (contentType.includes('application/xml')) {
                    continue;
                }

                if (s3Url.endsWith('.html')) {
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                } else if (contentType) {
                    res.setHeader('Content-Type', contentType);
                }

                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.status(200);

                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
                return res.end();
            }
        }

        // If none of the candidates exist on S3:
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>404 - Page Not Found</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0F172A; color: #F8FAFC; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
                    .box { background: #1E293B; border: 1px solid #334155; padding: 40px; border-radius: 16px; max-width: 450px; }
                    h1 { margin-top: 0; font-size: 28px; }
                    p { color: #94A3B8; font-size: 14px; }
                    a { color: #38BDF8; text-decoration: none; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="box">
                    <h1>404</h1>
                    <p>The requested page on <strong>${subdomain}</strong> could not be found.</p>
                    <a href="/">← Go to CloudDeploy</a>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error(`[Proxy Error for ${subdomain}]:`, err.message);
        res.status(502).send(`Error fetching project from S3: ${err.message}`);
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Reverse Proxy Running on Port ${PORT} (0.0.0.0)`));