const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require('mime-types');
const dotenv = require('dotenv');
dotenv.config();
const Redis = require('ioredis');

const REDIS_URI = process.env.REDIS_URL || 'redis://default:EHiJxCUZXeTZwnSNfDQxqPWNur9D4W0Q@redis-15707.c14.us-east-1-2.ec2.cloud.redislabs.com:15707';
const publisher = new Redis(REDIS_URI);

const s3Client = new S3Client({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    },
    region: process.env.AWS_REGION || 'us-east-1'
});

const PROJECT_ID = process.env.PROJECT_ID || 'demo-project';

function publishLog(log) {
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
    console.log(`[Log] ${log}`);
}

// ── Run a command with proper cwd (cross-platform) ─────────────────────────
function runCommand(cmd, cwd) {
    return new Promise((resolve, reject) => {
        publishLog(`$ ${cmd}`);
        const p = exec(cmd, { cwd: cwd || process.cwd() });
        p.stdout.on('data', data => {
            const str = data.toString().trim();
            if (str) { publishLog(str); }
        });
        p.stderr.on('data', data => {
            const str = data.toString().trim();
            if (str) { publishLog(str); }
        });
        p.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with exit code ${code}: ${cmd}`));
        });
    });
}

// ── Framework & build strategy detection ──────────────────────────────────
function detectBuildStrategy(targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    const hasPackageJson = fs.existsSync(pkgPath);
    const hasIndexHtml = fs.existsSync(path.join(targetDir, 'index.html'));

    // Check if custom overrides provided via environment variables
    const customBuildCmd = process.env.BUILD_COMMAND;
    const customOutputDir = process.env.OUTPUT_DIR;

    if (!hasPackageJson) {
        if (hasIndexHtml) {
            publishLog('📄 Detected: Pure static HTML/CSS/JS project — no build needed');
            return { type: 'static', outputDir: targetDir, targetDir };
        }

        // Check if there are common frontend subdirectories (e.g. frontend, client, app)
        for (const sub of ['frontend', 'client', 'app', 'web', 'frontend-nextjs']) {
            const subPath = path.join(targetDir, sub);
            if (fs.existsSync(subPath) && (fs.existsSync(path.join(subPath, 'package.json')) || fs.existsSync(path.join(subPath, 'index.html')))) {
                publishLog(`📁 Detected project inside subfolder: "${sub}"`);
                return detectBuildStrategy(subPath);
            }
        }

        publishLog('ℹ️ No package.json found. Serving directory contents as static site.');
        return { type: 'static', outputDir: targetDir, targetDir };
    }

    let pkg = {};
    try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); } catch (e) {
        publishLog(`⚠️ Warning: Failed to parse package.json: ${e.message}`);
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hasBuildScript = !!(pkg.scripts && pkg.scripts.build);

    // If custom build command is specified
    if (customBuildCmd) {
        const outDir = customOutputDir ? path.join(targetDir, customOutputDir) : path.join(targetDir, 'dist');
        publishLog(`⚙️ Custom build command configured: "${customBuildCmd}"`);
        return {
            type: 'build',
            buildCmd: customBuildCmd,
            outputDir: outDir,
            targetDir
        };
    }

    // Static with package.json (no build script in package.json)
    if (!hasBuildScript) {
        publishLog('📄 Detected: Static project with package.json (no "build" script defined)');
        return {
            type: hasIndexHtml ? 'static-with-pkg' : 'static',
            outputDir: targetDir,
            targetDir
        };
    }

    // Detect framework for output directory default
    let framework = 'Generic Node.js';
    let outputDirName = customOutputDir || 'dist';

    if (deps['next']) {
        framework = 'Next.js';
        outputDirName = customOutputDir || 'out';
    } else if (deps['vite']) {
        framework = 'Vite';
        outputDirName = customOutputDir || 'dist';
    } else if (deps['react-scripts']) {
        framework = 'CRA';
        outputDirName = customOutputDir || 'build';
    } else if (deps['vue'] || deps['@vue/cli-service']) {
        framework = 'Vue';
        outputDirName = customOutputDir || 'dist';
    } else if (deps['svelte'] || deps['@sveltejs/kit']) {
        framework = 'Svelte';
        outputDirName = customOutputDir || 'build';
    } else if (deps['astro']) {
        framework = 'Astro';
        outputDirName = customOutputDir || 'dist';
    } else if (deps['gatsby']) {
        framework = 'Gatsby';
        outputDirName = customOutputDir || 'public';
    } else if (deps['nuxt']) {
        framework = 'Nuxt';
        outputDirName = customOutputDir || '.output/public';
    }

    publishLog(`🔍 Detected framework: ${framework}`);
    return {
        type: 'build',
        framework,
        buildCmd: 'npm run build',
        outputDirName,
        outputDir: path.join(targetDir, outputDirName),
        targetDir
    };
}

// ── Upload a folder to S3 (recursive) ─────────────────────────────────────
async function uploadFolderToS3(folderPath, s3Prefix, excludeDirs = ['node_modules', '.git']) {
    const allFiles = fs.readdirSync(folderPath, { recursive: true });
    let uploadCount = 0;

    for (const filePath of allFiles) {
        const fullPath = path.join(folderPath, filePath);

        // Skip directories
        if (fs.lstatSync(fullPath).isDirectory()) continue;
        const normalised = filePath.replace(/\\/g, '/');
        if (excludeDirs.some(d => normalised.startsWith(d + '/') || normalised === d)) continue;

        const s3Key = `__output/${s3Prefix}/${normalised}`;
        publishLog(`Uploading: ${normalised}`);

        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME || 'sweetjet',
            Key: s3Key,
            Body: fs.createReadStream(fullPath),
            ContentType: mime.lookup(fullPath) || 'application/octet-stream',
        }));

        uploadCount++;
    }
    return uploadCount;
}

// ── Main Execution ─────────────────────────────────────────────────────────
async function init() {
    publishLog('🚀 Build Process Started...');
    
    // Resolve project root (support BASE_DIR / ROOT_DIR if provided)
    const baseDir = process.env.BASE_DIR || process.env.ROOT_DIR || '';
    const rootRepoDir = path.join(__dirname, 'output');
    let targetDir = baseDir ? path.join(rootRepoDir, baseDir) : rootRepoDir;

    if (!fs.existsSync(targetDir)) {
        throw new Error(`Directory not found: ${targetDir}`);
    }

    const strategy = detectBuildStrategy(targetDir);
    const activeDir = strategy.targetDir || targetDir;

    try {
        if (strategy.type === 'static') {
            publishLog('⚡ Skipping build step — uploading files directly to S3...');
            const count = await uploadFolderToS3(activeDir, PROJECT_ID, ['node_modules', '.git', 'output']);
            publishLog(`✅ Done: ${count} files uploaded to S3!`);

        } else if (strategy.type === 'static-with-pkg') {
            publishLog('📦 Installing production dependencies (no build script needed)...');
            await runCommand('npm install --omit=dev', activeDir);
            publishLog('⚡ Uploading static assets to S3...');
            const count = await uploadFolderToS3(activeDir, PROJECT_ID, ['node_modules', '.git', 'output']);
            publishLog(`✅ Done: ${count} files uploaded to S3!`);

        } else {
            // Build strategy
            publishLog('📦 Installing dependencies with npm install...');
            await runCommand('npm install', activeDir);

            publishLog(`🔨 Executing build: ${strategy.buildCmd}...`);
            await runCommand(strategy.buildCmd, activeDir);

            // Auto-locate output directory
            let finalOutputDir = strategy.outputDir;
            if (!fs.existsSync(finalOutputDir)) {
                publishLog(`⚠️ Expected output dir not found at "${finalOutputDir}". Scanning common output folders...`);
                // Priority order: .next comes before public!
                for (const candidate of ['dist', 'build', 'out', '.output/public', '.next', 'public']) {
                    const candidatePath = path.join(activeDir, candidate);
                    if (!fs.existsSync(candidatePath)) continue;

                    // Do NOT pick 'public' as build folder if it has no index.html (Next.js public folder only holds assets)
                    if (candidate === 'public' && !fs.existsSync(path.join(candidatePath, 'index.html')) && strategy.framework !== 'Gatsby') {
                        continue;
                    }

                    if (fs.readdirSync(candidatePath).length > 0) {
                        finalOutputDir = candidatePath;
                        publishLog(`📁 Found build output at: "${candidate}"`);
                        break;
                    }
                }
            }

            if (!fs.existsSync(finalOutputDir)) {
                throw new Error(`Could not find build output directory. Checked: ${strategy.outputDirName}, dist, build, out, .next`);
            }

            // Ensure root index.html exists so S3 reverse proxy never gets 403 AccessDenied
            const rootIndexPath = path.join(finalOutputDir, 'index.html');
            if (!fs.existsSync(rootIndexPath)) {
                publishLog('🔍 No index.html at root of output. Searching for entrypoint HTML...');
                const findHtml = (dir, depth = 0) => {
                    if (depth > 4) return null;
                    try {
                        for (const item of fs.readdirSync(dir)) {
                            const full = path.join(dir, item);
                            if (fs.statSync(full).isDirectory()) {
                                const found = findHtml(full, depth + 1);
                                if (found) return found;
                            } else if (item.toLowerCase() === 'index.html') {
                                return full;
                            }
                        }
                    } catch {}
                    return null;
                };

                const candidateHtml = findHtml(finalOutputDir) || (fs.existsSync(path.join(activeDir, 'index.html')) ? path.join(activeDir, 'index.html') : null);
                if (candidateHtml) {
                    fs.copyFileSync(candidateHtml, rootIndexPath);
                    publishLog(`📄 Auto-linked entrypoint HTML to root index.html`);
                }
            }

            // If Next.js output directory is .next:
            if (path.basename(finalOutputDir) === '.next') {
                publishLog('⚡ Preparing Next.js static output (Vercel Build Output format)...');

                // 1. Copy App Router pre-rendered HTML (.next/server/app/**/*.html) to root
                const appDir = path.join(finalOutputDir, 'server', 'app');
                if (fs.existsSync(appDir)) {
                    const copyAppHtml = (src, dest) => {
                        const entries = fs.readdirSync(src, { withFileTypes: true });
                        for (const entry of entries) {
                            const srcPath = path.join(src, entry.name);
                            const destPath = path.join(dest, entry.name);
                            if (entry.isDirectory()) {
                                fs.mkdirSync(destPath, { recursive: true });
                                copyAppHtml(srcPath, destPath);
                            } else if (entry.name.endsWith('.html') || entry.name.endsWith('.rsc') || entry.name.endsWith('.json')) {
                                fs.mkdirSync(dest, { recursive: true });
                                fs.copyFileSync(srcPath, destPath);
                                // Create directory index.html (e.g. about.html -> about/index.html)
                                if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
                                    const dirName = entry.name.replace(/\.html$/, '');
                                    const subDir = path.join(dest, dirName);
                                    fs.mkdirSync(subDir, { recursive: true });
                                    fs.copyFileSync(srcPath, path.join(subDir, 'index.html'));
                                }
                            }
                        }
                    };
                    copyAppHtml(appDir, finalOutputDir);
                    publishLog('📄 Extracted and promoted App Router HTML pages to root');
                }

                // 2. Copy Pages Router pre-rendered HTML (.next/server/pages/**/*.html)
                const pagesDir = path.join(finalOutputDir, 'server', 'pages');
                if (fs.existsSync(pagesDir)) {
                    const copyPagesHtml = (src, dest) => {
                        const entries = fs.readdirSync(src, { withFileTypes: true });
                        for (const entry of entries) {
                            const srcPath = path.join(src, entry.name);
                            const destPath = path.join(dest, entry.name);
                            if (entry.isDirectory()) {
                                fs.mkdirSync(destPath, { recursive: true });
                                copyPagesHtml(srcPath, destPath);
                            } else if (entry.name.endsWith('.html') || entry.name.endsWith('.json')) {
                                fs.mkdirSync(dest, { recursive: true });
                                fs.copyFileSync(srcPath, destPath);
                                if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
                                    const dirName = entry.name.replace(/\.html$/, '');
                                    const subDir = path.join(dest, dirName);
                                    fs.mkdirSync(subDir, { recursive: true });
                                    fs.copyFileSync(srcPath, path.join(subDir, 'index.html'));
                                }
                            }
                        }
                    };
                    copyPagesHtml(pagesDir, finalOutputDir);
                    publishLog('📄 Extracted and promoted Pages Router HTML pages to root');
                }

                // 3. Mirror static directory to _next/static
                const staticSrc = path.join(finalOutputDir, 'static');
                const nextStaticDest = path.join(finalOutputDir, '_next', 'static');
                if (fs.existsSync(staticSrc)) {
                    fs.mkdirSync(path.join(finalOutputDir, '_next'), { recursive: true });
                    fs.cpSync(staticSrc, nextStaticDest, { recursive: true });
                    publishLog(`📦 Mirrored Next.js static assets to _next/static`);
                }

                // 4. Copy public/ assets (images, icons) into output root
                const publicDir = path.join(activeDir, 'public');
                if (fs.existsSync(publicDir)) {
                    fs.cpSync(publicDir, finalOutputDir, { recursive: true });
                    publishLog(`📦 Copied public/ assets into build output`);
                }
            }

            publishLog('☁️ Uploading build artifacts to S3...');
            const count = await uploadFolderToS3(finalOutputDir, PROJECT_ID);
            publishLog(`✅ Done: ${count} files uploaded to S3!`);
        }

        publishLog('🎉 Deployment successful! Project is live.');
        console.log('Build & upload finished successfully.');
        process.exit(0);

    } catch (err) {
        publishLog(`❌ Build failed: ${err.message}`);
        console.error('Build failed:', err);
        process.exit(1);
    }
}

init();