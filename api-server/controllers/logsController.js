const { createClient } = require('@clickhouse/client');
const dotenv = require('dotenv');
dotenv.config();
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USERNAME,
  password: process.env.CLICKHOUSE_PASSWORD,
  database: 'default',
});

const fetchLogs = async (req, res) => {
  const id = req.params.id;
  const logs = await clickhouse.query({
    query: `SELECT event_id, deployment_id, log, timestamp from log_events where deployment_id = {deployment_id:String}`,
    query_params: { deployment_id: id },
    format: 'JSONEachRow',
  });
  const rawLogs = await logs.json();
  res.json({ logs: rawLogs });
};

module.exports = { fetchLogs };