const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const dotenv = require('dotenv');
dotenv.config();

const PROJECT_ID = process.env.PROJECT_ID;

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

build_app_from_source();

const build_app_from_source = async () => {
    console.log("Starting build process...");
    const source_directory_path = path.join(__dirname, 'source');
    const upload_process = exec(`cd ${source_directory_path} && npm install && npm run build`);
    upload_process.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    upload_process.stderr.on('data', (data) => {
        console.log("ERROR: ", data.toString());
    });
    upload_process.on('exit', (code) => {
        console.log(`Installation process exited with code ${code}`);
    });
    upload_process.on('close', async (code) => {
        console.log(`Build complete (${code})✨\nUploading files for deployment...`);
        upload_static_files();
        console.log("Upload complete");
    });
}

const upload_static_files = async () => {
    const possible_build_directories = ["dist", "build"];
    let build_director_path = null;
    for (const folder of possible_build_directories) {
        const valid_build_directory = path.join(__dirname, "source", folder);
        if (existsSync(valid_build_directory)) {
            build_director_path = valid_build_directory;
            break;
        }
    }
    if (!build_director_path) {
        console.log("Error: Build directory not found!");
        return;
    }
    const build_contents = fs.readdirSync(build_director_path, {
        recursive: true,
    });
    for (const file of build_contents) {
        const file_path = path.join(build_director_path, file);
        if (fs.lstatSync(file_path).isDirectory()) continue;
        console.log(`Uploading ${file}`);
        const command = new PutObjectCommand({
            Bucket: "deployments",
            Key: `__outputs/${PROJECT_ID}/${file}`,
            Body: fs.createReadStream(file_path),
            ContentType: mime.lookup(file_path),
        });
        try {
            await s3.send(command);
        } catch (err) {
            console.error(`Error uploading file: ${err}`);
            throw err;
        }
        console.log(`Uploaded ${file}`);
    }
}
