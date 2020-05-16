set -e
export NODE_ENV="development" 
export ELASTIC_ENDPOINT="http://localhost:13000/"
export GOOGLE_APPLICATION_CREDENTIALS="`pwd`/scripts/google-cloud-dev.json"
export OPENLAND_CONFIG="`pwd`/scripts/config_test.json"