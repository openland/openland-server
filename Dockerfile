FROM node:8.9.4-alpine

WORKDIR /app

RUN apk add --no-cache tini libpq
ENTRYPOINT ["/sbin/tini", "--"]

ADD package.json /app/
COPY node_modules/ /app/node_modules/
COPY build/ /app/
RUN yarn install

EXPOSE 9000
ENV NODE_ENV=production
ENV BLUEBIRD_LONG_STACK_TRACES=0
CMD [ "node", "index.js" ]