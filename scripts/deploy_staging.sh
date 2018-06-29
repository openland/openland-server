#!/bin/sh
set -e
./kubectl set image deployment/statecraft-server-staging statecraft-server-staging=index.docker.io/statecraft/statecraft-server:${1}
./kubectl rollout status deployments statecraft-server-staging || true