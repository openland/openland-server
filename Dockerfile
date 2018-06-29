FROM node:8.9.4-alpine

RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

ADD package.json /app/
COPY node_modules/ /app/node_modules/
COPY build/ /app/

WORKDIR /app
EXPOSE 9000
ENV NODE_ENV=production
ENV BLUEBIRD_LONG_STACK_TRACES=0
CMD [ "node", "index.js" ]