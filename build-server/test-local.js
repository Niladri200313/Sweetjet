const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

// User can pass git repo URL and project slug as arguments:
// node test-local.js https://github.com/user/repo my-test-project
const repoUrl = process.argv[2] || 'https://github.com/Niladri200313/Sweetjet';
const projectId = process.argv[3] || `test-${Date.now().toString(36)}`;
const branch = process.argv[4] || '';
const baseDir = process.argv[5] || '';

console.log('==============================================');
console.log('🧪 LOCAL BUILD SERVER TEST RUNNER');
console.log('==============================================');
console.log(`📦 Repo URL   : ${repoUrl}`);
console.log(`🏷️  Project ID : ${projectId}`);
if (branch) console.log(`🌿 Branch     : ${branch}`);
if (baseDir) console.log(`📁 Subfolder  : ${baseDir}`);
console.log('==============================================\n');

const outputDir = path.join(__dirname, 'output');

// Clean previous test output if exists
if (fs.existsSync(outputDir)) {
    console.log('🧹 Cleaning previous output directory...');
    fs.rmSync(outputDir, { recursive: true, force: true });
}

// Clone repo
console.log('📥 Cloning repo locally...');
const cloneCmd = branch 
    ? `git clone --depth 1 -b ${branch} ${repoUrl} "${outputDir}"`
    : `git clone --depth 1 ${repoUrl} "${outputDir}"`;

try {
    execSync(cloneCmd, { stdio: 'inherit' });
    console.log('✅ Clone complete.\n');
} catch (err) {
    console.error('❌ Failed to clone repository:', err.message);
    process.exit(1);
}

// Run script.js with environment variables
console.log('🚀 Running script.js to build and upload...');
const env = {
    ...process.env,
    PROJECT_ID: projectId,
    GIT_REPOSITORY_URL: repoUrl,
    BASE_DIR: baseDir,
};

const child = spawn('node', ['script.js'], {
    cwd: __dirname,
    env,
    stdio: 'inherit'
});

child.on('close', code => {
    console.log('\n==============================================');
    if (code === 0) {
        console.log(`🎉 TEST COMPLETED SUCCESSFULLY!`);
        console.log(`🔗 Output was uploaded to S3 path: __output/${projectId}/`);
        console.log(`🌐 If DNS/Proxy is active: https://${projectId}.sweetjet.site`);
    } else {
        console.log(`❌ TEST FAILED with exit code: ${code}`);
    }
    console.log('==============================================');
});
