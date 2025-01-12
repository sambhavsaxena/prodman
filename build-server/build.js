const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const {Kafka} = require('kafkajs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;
const kafka = new Kafka({
    brokers: [process.env.KAFKA_BROKER],
    clientId: `build-server-${PROJECT_ID}-${DEPLOYMENT_ID}`,
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')],
    },
    sasl: {
        mechanism: 'plain',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD
    }
});

const publisher = kafka.producer();

const publish_logs = async (log) => {
    await publisher.send({ 
        topic: 'container-logs', messages: [
            { 
                key: 'log',
                value: JSON.stringify({PROJECT_ID, DEPLOYMENT_ID, log})
            }
        ] 
    });
}

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET
    }
});

const COMMON_BUILD_DIRS = ['build', 'dist', 'public', 'out', '.output', '.next'];

const findBuildDirectory = (sourceDir) => {
    for (const buildDir of COMMON_BUILD_DIRS) {
        const potentialBuildPath = path.join(sourceDir, buildDir);
        if (fs.existsSync(potentialBuildPath) && fs.lstatSync(potentialBuildPath).isDirectory()) {
            return potentialBuildPath;
        }
    }
    throw new Error(`Build directory not found. Ensure that one of the following directories exists: ${COMMON_BUILD_DIRS.join(', ')}`);
};

const build_app_and_upload_output = async () => {
    await publisher.connect();
    console.log("Starting build process...");
    await publish_logs("Starting build process...");
    const source_directory_path = path.join(__dirname, 'source');

    return new Promise((resolve, reject) => {
        const upload_process = exec(`cd ${source_directory_path} && npm install && npm run build`);

        upload_process.stdout.on('data', async (data) => {
            console.log(data.toString());
            await publish_logs(data.toString());
        });

        upload_process.stderr.on('data', async (data) => {
            console.error("Error: " + data.toString());
            await publish_logs("Error: " + data.toString());
        });

        upload_process.on('close', async (code) => {
            if (code !== 0) {
                await publish_logs(`Build failed with exit code ${code}`);
                await publisher.disconnect();
                reject(new Error(`Build process exited with code ${code}`));
                return;
            }

            try {
                console.log(`Build complete✨\nUploading assets...`);
                await publish_logs("Build complete✨\nUploading assets...");

                const build_directory = findBuildDirectory(source_directory_path);
                const build_contents = fs.readdirSync(build_directory, { recursive: true });

                for (const file of build_contents) {
                    const file_path = path.join(build_directory, file);
                    if (fs.lstatSync(file_path).isDirectory()) continue;

                    console.log(`Uploading ${file}`);
                    await publish_logs(`Uploading ${file}`);

                    const command = new PutObjectCommand({
                        Bucket: process.env.AWS_BUCKET_NAME,
                        Key: `__outputs/${PROJECT_ID}/${file}`,
                        Body: fs.createReadStream(file_path),
                        ContentType: mime.lookup(file_path),
                    });

                    try {
                        await s3.send(command);
                    } catch (err) {
                        console.error(`Error uploading file: ${err}`);
                        await publish_logs(`Error uploading file: ${err}`);
                        await publisher.disconnect();
                        reject(err);
                        return;
                    }
                }

                await publish_logs("Done💫");
                await publisher.disconnect();
                resolve();
            } catch (err) {
                await publisher.disconnect();
                reject(err);
            }
            process.exit(0);
        });
    });
};

build_app_and_upload_output().catch(async error => {
    console.error('Error in build and upload process:', error);
    await publish_logs(`Error in build and upload process: ${error}`);
    await publisher.disconnect();
    process.exit(1);
});
