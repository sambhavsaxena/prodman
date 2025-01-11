const express = require('express');
const dotenv = require('dotenv');
const http_proxy = require('http-proxy');

dotenv.config();
const app = express();
const PORT = process.env.PORT;
const base_url = process.env.BUILD_ENTRY_POINT;

const proxy = http_proxy.createProxy();

app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];
    // TODO: add support for custom domains using DB query
    const resolves_to = `${base_url}/${subdomain}`;
    return proxy.web(req, res, { target: resolves_to, changeOrigin: true });
});

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/') {
        proxyReq.path += 'index.html';
    }
});

app.listen(PORT || 3600, () => {
    console.log(`Proxy server running on PORT: ${PORT}`);
});
