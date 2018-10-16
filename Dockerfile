FROM node:8.12.0

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

WORKDIR /
ADD https://www.foundationdb.org/downloads/5.2.5/ubuntu/installers/foundationdb-clients_5.2.5-1_amd64.deb ./foundationdb-clients_5.2.5-1_amd64.deb
RUN apt-get update && dpkg -i foundationdb-clients_5.2.5-1_amd64.deb foundationdb-clients_5.2.5-1_amd64.deb && apt-get install libpq-dev python && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ADD package.json /app/
ADD yarn.lock /app/
ADD tsconfig.json /app/
ADD tslint.json /app/
COPY src/ /app/src/
COPY node_modules/ /app/node_modules/

RUN yarn install && yarn build && yarn lint

EXPOSE 9000
WORKDIR /app/build
ENV NODE_ENV=production
ENV BLUEBIRD_LONG_STACK_TRACES=0
CMD [ "node", "index.js" ]