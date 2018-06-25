# Starting Server

1) Install Postgres: `brew install postgresql`
2) Install Redis: `brew install redis`
3) Install Java
4) Install Elasticsearch: `brew install elasticsearch`
5) Install Kibana: `brew install kibana`
6) Install Minio: `brew install minio/stable/minio`
   - Change Port: `/usr/local/Cellar/minio/{version}/Library/homebrew.mxcl.minio.plist` from `:9000` to `:9900`
7) Install yarn (+ node): `brew install yarn`
8) Install dependencies `yarn install`
9) Run Services: 
   - `brew services start postgresql`
   - `brew services start elasticsearch`
   - `sudo brew services start kibana`
   - `sudo brew services start minio`
   - `brew services start redis`
10) Configure credentials: 
 - `/usr/local/etc/minio/config.json`
     - accessKey: DVCZH2DPBB0PNY5SQSFB
     - secretKey: 6yElhMkUjDYB8Y+gTE9hBJXUY+otqDp5zRnl0zYm
 - restart: `sudo brew services restart minio`
 - create bucket `files` at http://127.0.0.1:9900/
9) Run server `yarn dev`
10) go get some coffee
