const express = require('express');
const dotenv = require('dotenv');
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const { Server } = require('socket.io')
const Redis = require('ioredis');

dotenv.config();
const app = express();
const PORT = process.env.PORT;
const PROXY_PORT = process.env.PROXY_PORT;
const SOCKET_PORT = process.env.SOCKET_PORT;
const REDIS_URI = process.env.REDIS_URI;

const subscriber = new Redis(REDIS_URI);

const io = new Server({ cors: { origin: '*' } });

io.on('connection', (socket) => {
    socket.on('subscribe', (channel) => {
        socket.join(channel);
        socket.emit('message', `Joined channel: ${channel}`);
    });
});

io.listen(SOCKET_PORT, () => {
    console.log(`Socket server running on PORT: SOCKET_PORT`);
})

const ecs = new ECSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET
    }
});

app.use(express.json());

app.post('/project', async (req, res) => {
    const { git_url, slug } = req.body;
    const project_slug = slug ? slug : generateSlug();
    const command = new RunTaskCommand({
        cluster: process.env.AWS_ECS_CLUSTER,
        taskDefinition: process.env.AWS_ECS_TASK_DEFINITION,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: [
                    process.env.AWS_VPC_SUBNET_1,
                    process.env.AWS_VPC_SUBNET_2,
                    process.env.AWS_VPC_SUBNET_3
                ],
                securityGroups: [process.env.AWS_VPC_SECURITY_GROUP]
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: process.env.AWS_ECS_IMAGE_NAME,
                    environment: [
                        { name: 'AWS_BUCKET_NAME', value: process.env.AWS_BUCKET_NAME },
                        { name: 'AWS_REGION', value: process.env.AWS_REGION },
                        { name: 'AWS_ACCESS_KEY_ID', value: process.env.AWS_ACCESS_KEY_ID },
                        { name: 'AWS_ACCESS_KEY_SECRET', value: process.env.AWS_ACCESS_KEY_SECRET },
                        { name: 'GIT_REPOSITORY_URL', value: git_url },
                        { name: 'PROJECT_ID', value: project_slug },
                        { name: 'REDIS_URI', value: REDIS_URI }
                    ]
                }
            ]
        }
    });
    await ecs.send(command);
    return res.json({ project_slug, url: `http://${project_slug}.localhost:${PROXY_PORT}` });
})

const initialize_redis = async () => {
    subscriber.psubscribe('logs:*');
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message);
    });
}

initialize_redis().then(() => {
    console.log('Redis initialized');
}).catch((err) => {
    console.error(err);
});

app.listen(PORT, () => {
    console.log(`API server running on PORT: ${PORT}`);
});
