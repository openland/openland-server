# Starting Server

1) Install Redis: `brew install redis`
2) Install Java
3) Install Elasticsearch: `brew install elasticsearch`
4) Install Kibana: `brew install kibana`
5) Install FoundationDB: https://apple.github.io/foundationdb/downloads.html (Minimum required version of FoundationDB is 6.0.0.)
6) Install NodeJS v10.16.0
7) Install yarn: `brew install yarn`
8) Install dependencies `yarn install`
9) Run Services: 
   - `brew services start elasticsearch`
   - `sudo brew services start kibana`
   - `brew services start redis`
10) Run server `yarn dev`
11) Authorize, & run `mutation { debugDeveloperInit }` in sandbox
11) go get some coffee

# Running Integration Tests

1) Install Docker
2) Prepare production build: `yarn build`
3) Start testing infrastructure: `yarn test:start`
4) Prepare testing infrastructure: `yarn test:prepare`
5) Run tests: `yarn test`, `yarn test:watch`
6) Stop infrastructure: `yarn test:stop`