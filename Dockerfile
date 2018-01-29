FROM node:8.9.4-alpine

# Create app directory
WORKDIR /usr/src/app

COPY package.json ./
COPY . .

EXPOSE 9000
CMD [ "yarn", "start" ]