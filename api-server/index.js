const express = require('express');
const dotenv = require('dotenv');
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')

dotenv.config();
const app = express();
const PORT = process.env.PORT;

const ecs = new ECSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET
    }
});

app.use(express.json());
app.post('/project', async (req, res) => {
    const { git_url } = req.body;
    const project_slug = generateSlug();
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
                        { name: 'PROJECT_ID', value: project_slug }
                    ]
                }
            ]
        }
    });
    await ecs.send(command);
    return res.json({ project_slug, url: `http://${project_slug}.localhost:${process.env.PROXY_PORT}` });
})

app.listen(PORT, () => {
    console.log(`API server running on PORT: ${PORT}`);
});
