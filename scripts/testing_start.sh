set -e
docker pull docker.elastic.co/elasticsearch/elasticsearch-oss:6.3.0
docker pull postgres:10.4-alpine
docker pull redis:4.0.10
docker-compose -p ci up -d
sleep 15