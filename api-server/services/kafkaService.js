const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@clickhouse/client');
const dotenv = require('dotenv');

dotenv.config();

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USERNAME,
  password: process.env.CLICKHOUSE_PASSWORD,
  database: 'default',
});

const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKER],
  clientId: 'api-server',
  ssl: { ca: [require('fs').readFileSync('kafka.pem', 'utf-8')] },
  sasl: { mechanism: 'plain', username: process.env.KAFKA_USERNAME, password: process.env.KAFKA_PASSWORD },
});

const initializeKafkaConsumer = async () => {
  const subscriber = kafka.consumer({ groupId: 'api-server-logs-consumer' });
  await subscriber.connect();
  await subscriber.subscribe({ topic: 'container-logs' });
  await subscriber.run({
    eachBatch: async ({ batch, resolveOffset, commitOffsetsIfNecessary, heartbeat }) => {
      for (const message of batch.messages) {
        if (!message.value) continue;
        const { PROJECT_ID, DEPLOYMENT_ID, log } = JSON.parse(message.value.toString());
        await clickhouse.insert({
          table: 'log_events',
          values: [{ event_id: uuidv4(), deployment_id: DEPLOYMENT_ID, log }],
          format: 'JSONEachRow',
        });
        resolveOffset(message.offset);
        await commitOffsetsIfNecessary(message.offset);
        await heartbeat();
      }
    },
  });
};

module.exports = { initializeKafkaConsumer };