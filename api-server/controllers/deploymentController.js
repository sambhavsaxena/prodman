const { PrismaClient } = require('@prisma/client');
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');
const prisma = new PrismaClient();

const dotenv = require('dotenv');
dotenv.config();

const ecs = new ECSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET,
  },
});

const deployProject = async (req, res) => {
  try {
    const { project_id } = req.body;
    if (!project_id) return res.status(400).json({ error: 'Project ID is required' });

    const project = await prisma.project.findUnique({ where: { id: project_id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const deployment = await prisma.deployment.create({
      data: { project_id, status: 'QUEUED' },
    });

    await prisma.project.update({
      where: { id: project_id },
      data: { deployments: { connect: { id: deployment.id } } },
    });

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
            process.env.AWS_VPC_SUBNET_3,
          ],
          securityGroups: [process.env.AWS_VPC_SECURITY_GROUP],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: process.env.AWS_ECS_IMAGE_NAME,
            environment: [
              { name: 'GIT_REPOSITORY_URL', value: project.git_url },
              { name: 'PROJECT_ID', value: project_id },
              { name: 'DEPLOYMENT_ID', value: deployment.id },
              ...Object.keys(process.env)
                .filter((key) => key.startsWith('AWS_') || key.startsWith('KAFKA_'))
                .map((key) => ({ name: key, value: process.env[key] })),
            ],
          },
        ],
      },
    });

    await ecs.send(command);

    res.json({ status: 'QUEUED', data: { deployment_id: deployment.id } });
  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

module.exports = { deployProject };