const {exec} = require('child_process');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const {S3Client, PutObjectCommand} = require('@aws-sdk/client-s3');

const dotenv = require('dotenv');
dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID;

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials : {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const initialize = async () => {
    console.log("Executing build script...");
    const output_directory_path = path.join(__dirname, 'output');
    const upload_process = exec(`cd ${output_directory_path} && npm install && npm run build`);
    upload_process.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    upload_process.stderr.on('data', (data) => {
        console.log("ERROR: ", data.toString());
    });
    upload_process.on('exit', (code) => {
        console.log(`child process exited with code ${code}`);
    });
    upload_process.on('close', async (code) => {
        console.log(`Build complete✨\nSTATUS: ${code}`);
        const static_source_path = path.join(__dirname, 'output', 'build');
        const static_files = fs.readdirSync(static_source_path, {recursive: true});
        for(const file of static_files) {
            const file_path = path.join(static_source_path, file);
            if(fs.lstatSync(file_path).isDirectory()) continue;
            console.log(`Uploading ${file_path}`);
            const stream = new PutObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: `build/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(file_path),
                ContentType: mime.lookup(file_path)
            })
            await s3.send(stream);
        }
        console.log(`Build uploaded to S3 bucket: ${process.env.AWS_BUCKET_NAME}`);
    });
};

initialize();
