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
    console.log("Starting build process...");
    const source_directory_path = path.join(__dirname, 'source');

    return new Promise((resolve, reject) => {
        const upload_process = exec(`cd ${source_directory_path} && npm install && npm run build`);

        upload_process.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        upload_process.stderr.on('data', (data) => {
            console.error(data.toString());
        });

        upload_process.on('close', async (code) => {
            if (code !== 0) {
                reject(new Error(`Build process exited with code ${code}`));
                return;
            }

            try {
                console.log(`Build complete✨\nUploading assets...`);
                const build_directory = findBuildDirectory(source_directory_path);
                console.log(`Found build directory: ${build_directory}`);

                const build_contents = fs.readdirSync(build_directory, {
                    recursive: true,
                });

                for (const file of build_contents) {
                    const file_path = path.join(build_directory, file);
                    if (fs.lstatSync(file_path).isDirectory()) continue;

                    console.log(`Uploading ${file}`);
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
                        reject(err);
                        return;
                    }
                }

                console.log("Upload complete");
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    });
};

build_app_and_upload_output().catch(error => {
    console.error('Error in build and upload process:', error);
    process.exit(1);
});
