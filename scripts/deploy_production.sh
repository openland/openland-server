#!/bin/sh
set -e
./kubectl set image deployment/statecraft-server statecraft-server=index.docker.io/openland/server:${1}
./kubectl set image deployment/openland-server-workers openland-server-workers=index.docker.io/openland/server:${1}
./kubectl set image deployment/openland-server-delivery openland-server-workers=index.docker.io/openland/server:${1}
./kubectl set image deployment/openland-server-admin openland-server-admin=index.docker.io/openland/server:${1}
./kubectl rollout status deployments statecraft-server
./kubectl rollout status deployments openland-server-workers
./kubectl rollout status deployments openland-server-delivery
./kubectl rollout status deployments openland-server-admin