FROM node:10.12.0

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "-e", "2", "--"]

WORKDIR /
ADD https://www.foundationdb.org/downloads/6.0.15/ubuntu/installers/foundationdb-clients_6.0.15-1_amd64.deb ./foundationdb-clients_6.0.15-1_amd64.deb
RUN apt-get update && dpkg -i foundationdb-clients_6.0.15-1_amd64.deb && apt-get install python && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ADD package.json /app/
ADD yarn.lock /app/
RUN yarn install

ADD tsconfig.json /app/
ADD tslint.json /app/
COPY packages/ /app/packages/
RUN yarn build 
RUN yarn lint

EXPOSE 9000
WORKDIR /app/build
ENV NODE_ENV=production
ENV BLUEBIRD_LONG_STACK_TRACES=0
CMD [ "node", "--max_old_space_size=2048", "--max-semi-space-size=64", "openland-server/index.js" ]