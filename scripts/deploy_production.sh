#!/bin/sh
set -e
./kubectl set image deployment/statecraft-server statecraft-server=index.docker.io/openland/server:${1}
./kubectl rollout status deployments statecraft-server
# apollo schema:publish --key="service:openland-production:qrYALC8Flb8hv-SGm4grug" --endpoint="https://api.openland.com/api"