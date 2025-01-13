const express = require('express');
const dotenv = require('dotenv');
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const { Server } = require('socket.io')
const cors = require('cors');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@clickhouse/client');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

dotenv.config();
const app = express();
const PORT = process.env.PORT;
const PROXY_PORT = process.env.PROXY_PORT;
const SOCKET_PORT = process.env.SOCKET_PORT;

const kafka = new Kafka({
	brokers: [process.env.KAFKA_BROKER],
	clientId: `api-server`,
	ssl: {
		ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')],
	},
	sasl: {
		mechanism: 'plain',
		username: process.env.KAFKA_USERNAME,
		password: process.env.KAFKA_PASSWORD
	}
});

const clickhouse = createClient({
	url: process.env.CLICKHOUSE_URL,
	username: process.env.CLICKHOUSE_USERNAME,
	password: process.env.CLICKHOUSE_PASSWORD,
	database: "default"
});

const subscriber = kafka.consumer({ groupId: 'api-server-logs-consumer' });
const prisma = new PrismaClient();

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
app.use(cors())

app.post('/project', async (req, res) => {
	const schema = z.object({
		name: z.string(),
		git_url: z.string().url()
	})
	const parsed_result = schema.safeParse(req.body);
	if (!parsed_result.success) {
		return res.status(400).json({ error: parsed_result.error });
	}
	const { name, git_url } = parsed_result.data;

	const project = await prisma.project.create({
		data: {
			name,
			git_url,
			subdomain: generateSlug()
		}
	});

	return res.json({ status: "success", data: { project } });
})

app.post('/deploy', async (req, res) => {
	try {
		const { project_id } = req.body;
		if (!project_id) {
			return res.status(400).json({ error: 'Project ID is required' });
		}

		const project = await prisma.project.findUnique({
			where: {
				id: project_id
			}
		});

		if (!project) {
			return res.status(404).json({ error: 'Project not found' });
		}

		const deployment = await prisma.deployment.create({
			data: {
				project_id: project_id,
				status: 'QUEUED'
			}
		});

		await prisma.project.update({
			where: { id: project_id },
			data: {
				deployments: {
					connect: { id: deployment.id }
				}
			}
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
							{ name: 'GIT_REPOSITORY_URL', value: project.git_url },
							{ name: 'PROJECT_ID', value: project_id },
							{ name: 'DEPLOYMENT_ID', value: deployment.id },
							{ name: 'KAFKA_BROKER', value: process.env.KAFKA_BROKER },
							{ name: 'KAFKA_USERNAME', value: process.env.KAFKA_USERNAME },
							{ name: 'KAFKA_PASSWORD', value: process.env.KAFKA_PASSWORD }
						]
					}
				]
			}
		});

		await ecs.send(command);

		return res.json({ status: "QUEUED", data: { deployment_id: deployment.id } });
	} catch (error) {
		console.error('Deployment error:', error);
		res.status(500).json({ error: 'Internal server error', details: error.message });
	}
});

app.get('/logs/:id', async (req, res) => {
	const id = req.params.id;
	const logs = await clickhouse.query({
		query: `SELECT event_id, deployment_id, log, timestamp from log_events where deployment_id = {deployment_id:String}`,
		query_params: {
			deployment_id: id
		},
		format: 'JSONEachRow'
	})

	const rawLogs = await logs.json()

	return res.json({ logs: rawLogs })
})

const initialize_kafka_consumer = async () => {
	await subscriber.connect();
	await subscriber.subscribe({ topic: 'container-logs' });
	await subscriber.run({
		autoCommit: false,
		eachBatch: async function ({ batch, heartbeat, commitOffsetsIfNecessary, resolveOffset }) {
			const messages = batch.messages;
			console.log(`Received ${messages.length} messages.`)
			for (const message of messages) {
				if (!message.value) continue;
				const stringMessage = message.value.toString()
				const { PROJECT_ID, DEPLOYMENT_ID, log } = JSON.parse(stringMessage)
				console.log({ log, DEPLOYMENT_ID })
				try {
					const { query_id } = await clickhouse.insert({
						table: 'log_events',
						values: [{ event_id: uuidv4(), deployment_id: DEPLOYMENT_ID, log }],
						format: 'JSONEachRow'
					})
					console.log(query_id)
					resolveOffset(message.offset)
					await commitOffsetsIfNecessary(message.offset);
					await heartbeat();
				} catch (err) {
					console.log(err)
				}

			}
		}
	});
}

initialize_kafka_consumer();

app.listen(PORT, () => {
	console.log(`API server running on PORT: ${PORT}`);
});
