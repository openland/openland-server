set -e
export NODE_ENV="development" 
export DATABASE_USER=$(id -un)
export ELASTIC_ENDPOINT="http://localhost:9200/"
export REDIS_HOST="localhost"
export GOOGLE_APPLICATION_CREDENTIALS="`pwd`/scripts/google-cloud-dev.json"
export FILES_BUCKET="files.datamakesperfect.com"
export WEB_PUSH_PUBLIC="BOvxoJt3pHvDl9XDfwtcYPEtKxu7-K1Ztfxh7AyYyNSZa65rsBlt--8d72Y5X7_5kwQWlbaY30J82Olt_g-R7oE"
export WEB_PUSH_PRIVATE="B6r9Ld6ple838FBD8V-f08Sgc1oA2M8dlX-SrYYhzIA"
export SERVER_ROLES=""
export CLICKHOUSE_ENDPOINT="localhost:8123"
export CLICKHOUSE_USER="default"
export CLICKHOUSE_PASSWORD=""