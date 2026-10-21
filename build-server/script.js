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

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log) {
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

async function init() {
    console.log("Executing script.js");
    publishLog("Build Started...");
    const outDirPath = path.join(__dirname, "output");

    const p = exec(`cd ${outDirPath} && npm install && npm run build`);

    p.stdout.on("data", data => {
        console.log(data.toString());
        publishLog(data.toString());
    });

    p.stderr.on("data", data => {
        console.log('Error', data.toString());
        publishLog(`error: ${data.toString()}`);
    });

    p.on('close', async function () {
        console.log('Build Complete');
        publishLog('Build Complete');

        const distFolderPath = path.join(__dirname, "output", "dist");
        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true });

        publishLog('Starting to upload...');
        for (const filePath of distFolderContents) {
            const fullFilePath = path.join(distFolderPath, filePath);
            if (fs.lstatSync(fullFilePath).isDirectory()) continue;

            console.log("Uploading", filePath);
            publishLog(`uploading ${filePath}`);

            const command = new PutObjectCommand({
                Bucket: 'sweetjet',
                Key: `__output/${PROJECT_ID}/${filePath.replace(/\\/g, '/')}`,
                Body: fs.createReadStream(fullFilePath),
                ContentType: mime.lookup(fullFilePath)
            });
            await s3Client.send(command);

            publishLog(`uploaded ${filePath}`);
            console.log("Uploaded", filePath);
        }

        publishLog('Done');
        console.log("Done.....");
        process.exit(0);
    });
}

init();