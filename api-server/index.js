const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const projectRoutes = require('./routes/projectRoutes');
const deploymentRoutes = require('./routes/deploymentRoutes');
const logRoutes = require('./routes/logRoutes');
const { initializeKafkaConsumer } = require('./services/kafkaService');

dotenv.config();
const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(cors());

app.use('/project', projectRoutes);
app.use('/deploy', deploymentRoutes);
app.use('/logs', logRoutes);
app.use('/login', require('./routes/authRoutes'));

initializeKafkaConsumer();

app.listen(PORT, () => console.log(`API server running on PORT: ${PORT}`));