const express = require('express')
const httpProxy = require('http-proxy')

const app = express()
const PORT = 8000

const BASE_PATH = 'https://sweetjet.s3.us-east-1.amazonaws.com/__output'

const proxy = httpProxy.createProxy()

app.use((req, res) => {
    console.log(`[Proxy Request] Host: ${req.hostname} | URL: ${req.url}`);
    const hostname = req.hostname;
    let subdomain = hostname.split('.')[0];

    // Support Path-based or Query-based slug for Real World / Tunnel URLs
    // e.g. http://localhost:8000/p2/ OR https://tunnel.loca.lt/p2/
    const pathParts = req.url.split('?')[0].split('/').filter(Boolean);
    const querySlug = req.query.project || req.query.slug;

    if (subdomain === 'localhost' || subdomain === '127' || subdomain === 'sweetjet' || subdomain === 'www' || subdomain.includes('loca') || subdomain.includes('ngrok') || subdomain.includes('cloudflare')) {
        if (querySlug) {
            subdomain = querySlug;
        } else if (pathParts.length > 0 && !pathParts[0].includes('.')) {
            // e.g. /p2 or /p2/assets/index.js
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

    const resolvesTo = `${BASE_PATH}/${subdomain}`

    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true }, (err) => {
        console.error('Proxy error:', err.message);
        res.status(502).send(`Could not load project "${subdomain}". Ensure build has finished uploading to S3.`);
    })
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/' || url === '') {
        if (!proxyReq.path.endsWith('/')) {
            proxyReq.path += '/';
        }
        proxyReq.path += 'index.html';
    }
})

app.listen(PORT, '0.0.0.0', () => console.log(`Reverse Proxy Running on Port ${PORT} (0.0.0.0)`))