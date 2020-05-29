# Start coordinator (seed) node
This node is used mostly for connecting cluster

```
docker run -d --restart=always --network=host --name nats-server -e NATS_USER=opnats -e NATS_PASSWORD=ggzUaT6xr9nixhQR openland/nats:v1 --client_advertise=10.138.0.38:4222 --cluster_advertise=10.138.0.38:6222
```

# Start second node

This node connects to coordinator to join the cluster
```
docker run -d --restart=always -p 4222:4222 -p 8222:8222 -p 6222:6222 --name nats-server -e NATS_USER=opnats -e NATS_PASSWORD=ggzUaT6xr9nixhQR openland/nats:v1 --routes=nats://opnats:ggzUaT6xr9nixhQR@nats.services.openlandservers.com:6222
```