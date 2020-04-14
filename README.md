# Starting Server

1) Instal Docker
2) Instal Docker Compose
3) Install FoundationDB 6.0.15 Client https://foundationdb-origin.apple.com/download/download-6.0.15/
4) Install NodeJS v10.16.0
5) Install yarn: `brew install yarn`
6) Install dependencies `yarn`
7) Run dev infrastructure `docker-compose up -d`
8) [Optional] Reset database `fdbcli --exec 'writemode on; clearrange \x00 \xff;' && yarn dev:init`
9) Start server `yarn dev`