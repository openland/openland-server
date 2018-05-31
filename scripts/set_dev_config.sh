set -e
export NODE_ENV="development" 
export DATABASE_USER=$(id -un)
export ELASTIC_ENDPOINT="http://localhost:9200/"
export REDIS_HOST="localhost" 
export GOOGLE_APPLICATION_CREDENTIALS="`pwd`/scripts/google-cloud-dev.json"
export FILES_BUCKET="files.datamakesperfect.com"