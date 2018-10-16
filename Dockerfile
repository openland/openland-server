FROM node:8.12.0

WORKDIR /app

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

RUN apt-get update && apt-get install libpq-dev python && rm -rf /var/lib/apt/lists/*

ADD package.json /app/
COPY node_modules/ /app/node_modules/
RUN yarn install

COPY build/ /app/

EXPOSE 9000
ENV NODE_ENV=production
ENV BLUEBIRD_LONG_STACK_TRACES=0
CMD [ "node", "index.js" ]