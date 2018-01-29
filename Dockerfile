FROM node:8.9.4-alpine

# Create app directory
WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./
COPY . .

RUN yarn install
RUN yarn build

EXPOSE 8080
CMD [ "yarn", "start" ]