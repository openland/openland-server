FROM nodesource/nsolid:fermium-latest

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini

WORKDIR /
ADD https://foundationdb-origin.apple.com/downloads/6.2.20/ubuntu/installers/foundationdb-clients_6.2.20-1_amd64.deb ./foundationdb-clients_6.2.20-1_amd64.deb
RUN apt-get update && dpkg -i foundationdb-clients_6.2.20-1_amd64.deb && apt-get install python && rm -rf /var/lib/apt/lists/*
RUN apt-get install imagemagick

WORKDIR /app
ADD package.json /app/
ADD yarn.lock /app/
#COPY patches/ /app/patches/
RUN yarn install

ADD tsconfig.json /app/
COPY packages/ /app/packages/
RUN yarn build

EXPOSE 9000
WORKDIR /app/build
ENV NODE_ENV=production
ENTRYPOINT ["/tini", "-e", "2", "--"]
CMD [ "node", "--max-old-space-size=1024", "--max-semi-space-size=256", "openland-server/index.js" ]
