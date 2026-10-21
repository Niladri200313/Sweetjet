try { process.loadEnvFile ? process.loadEnvFile() : require('dotenv').config() } catch (e) {}

const express = require('express')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const { Server } = require('socket.io')
const Redis = require('ioredis')

const app = express()
const PORT = process.env.PORT || 9000

const subscriber = new Redis(process.env.REDIS_URL || 'redis://default:EHiJxCUZXeTZwnSNfDQxqPWNur9D4W0Q@redis-15707.c14.us-east-1-2.ec2.cloud.redislabs.com:15707')

const io = new Server({ cors: '*' })

io.on('connection', socket => {
    socket.on('subscribe', channel => {
        socket.join(channel)
        socket.emit('message', `Joined ${channel}`)
    })
})

io.listen(9002, () => console.log('Socket Server 9002'))

const ecsClient = new ECSClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
})

const config = {
    CLUSTER: process.env.CLUSTER_ARN || 'arn:aws:ecs:us-east-1:434658845641:cluster/builder-cluster',
    TASK: process.env.TASK_ARN || 'arn:aws:ecs:us-east-1:434658845641:task-definition/builder-task:3'
}

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json())

app.post('/project', async (req, res) => {
    const { gitURL, slug, env } = req.body
    const projectSlug = slug ? slug : generateSlug()

    const userEnvs = Array.isArray(env)
        ? env.filter(e => e && e.key).map(e => ({ name: String(e.key), value: String(e.value || '') }))
        : []

    // Spin the container
    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: ['subnet-0f5e71048782372b5'],
                securityGroups: ['sg-0de713dcb21a8703c']
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        { name: 'GIT_REPOSITORY_URL', value: gitURL },
                        { name: 'PROJECT_ID', value: projectSlug },
                        { name: 'AWS_ACCESS_KEY_ID', value: process.env.AWS_ACCESS_KEY_ID || '' },
                        { name: 'AWS_SECRET_ACCESS_KEY', value: process.env.AWS_SECRET_ACCESS_KEY || '' },
                        { name: 'AWS_REGION', value: process.env.AWS_REGION || 'us-east-1' },
                        ...userEnvs
                    ]
                }
            ]
        }
    })

    console.log(`[API] Received deployment request for "${projectSlug}" from "${gitURL}"`);

    try {
        await ecsClient.send(command);
        console.log(`[API] ECS RunTaskCommand launched successfully for "${projectSlug}"`);
        return res.json({ status: 'queued', data: { projectSlug, url: `https://${projectSlug}.sweetjet.site` } })
    } catch (err) {
        console.error(`[API] Failed to launch ECS task for "${projectSlug}":`, err.message);
        return res.status(500).json({ error: err.message });
    }
})

async function initRedisSubscribe() {
    console.log('Subscribed to logs....')
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage', (pattern, channel, message) => {
        console.log(`[Redis Log] ${channel} -> ${message.substring(0, 80)}`);
        io.to(channel).emit('message', message)
    })
}


initRedisSubscribe()

app.listen(PORT, () => console.log(`API Server Running..${PORT}`))