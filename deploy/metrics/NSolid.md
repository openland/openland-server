# Run NSolid

docker run -d -p 9001-9003:9001-9003 -p 6743:6753 \
  --name console  \
  nodesource/nsolid-console:fermium-4.5.2