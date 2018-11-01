set -e
export NODE_ENV="development" 
export DATABASE_USER=testing
export DATABASE_PORT=13002
export ELASTIC_ENDPOINT="http://localhost:13000/"
# export REDIS_HOST="localhost" 
# export REDIS_PORT=13001
export GOOGLE_APPLICATION_CREDENTIALS="`pwd`/scripts/google-cloud-dev.json"
export FILES_BUCKET="files.datamakesperfect.com"
export NO_DEPRECATION=sequelize,crypto
export DATABASE_LOGGING=false
export TESTING=true