const express = require('express');
const dotenv = require('dotenv');
const http_proxy = require('http-proxy');
const { PrismaClient } = require('@prisma/client');

dotenv.config();
const app = express();
const PORT = process.env.PORT;
const base_url = process.env.BUILD_ENTRY_POINT;

const proxy = http_proxy.createProxy();
const prisma = new PrismaClient();

async function resolveDomain(hostname) {
	try {
		const subdomain = hostname.split('.')[0];
		const projectBySubdomain = await prisma.project.findFirst({
			where: {
				subdomain: subdomain
			},
			include: {
				deployments: true
			}
		});

		if (!projectBySubdomain?.deployments[0]) {
			await prisma.proxyLog.create({
				data: {
					domain: hostname,
					error: 'No successful deployment found for subdomain',
					type: 'ERROR'
				}
			});
			return null;
		}

		const deployment = projectBySubdomain.deployments[0];
		const resolvedUrl = `${base_url}/${deployment.project_id}`;

		await prisma.proxyLog.create({
			data: {
				domain: hostname,
				resolved_url: resolvedUrl,
				type: 'SUBDOMAIN',
				deployment_id: deployment.id
			}
		});

		return resolvedUrl;
	} catch (error) {
		console.error('Error resolving domain:', error);
		await prisma.proxyLog.create({
			data: {
				domain: hostname,
				error: error.message,
				type: 'ERROR'
			}
		});
		return null;
	}
}

app.use(async (req, res) => {
	try {
		const hostname = req.hostname;
		const subdomain = hostname.split('.')[0];
		const resolves_to = await resolveDomain(subdomain);

		if (!resolves_to) {
			return res.status(404).send('Domain not found');
		}

		return proxy.web(req, res, { target: resolves_to, changeOrigin: true });
	} catch (error) {
		console.error('Proxy error:', error);
		res.status(500).send('Internal Server Error');
	}
});

process.on('SIGINT', async () => {
	await prisma.$disconnect();
	process.exit();
});

proxy.on('proxyReq', (proxyReq, req, res) => {
	const url = req.url;
	if (url === '/') {
		proxyReq.path += 'index.html';
	}
});

app.listen(PORT, () => {
	console.log(`Proxy server running on PORT: ${PORT}`);
});
