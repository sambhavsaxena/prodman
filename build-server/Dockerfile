FROM ubuntu:focal

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y curl git && \
    curl -sL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /home/app

COPY main.sh build.js package*.json ./

RUN npm install && \
    chmod +x main.sh build.js

ENTRYPOINT ["/home/app/main.sh"]
