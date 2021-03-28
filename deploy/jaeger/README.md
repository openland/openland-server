# Test server setup

sudo docker run -d --name jaeger --restart=unless-stopped \
  -e SPAN_STORAGE_TYPE=badger \
  -e BADGER_SPAN_STORE_TTL=20m \
  -e COLLECTOR_ZIPKIN_HTTP_PORT=9411 \
  -p 5775:5775/udp \
  -p 6831:6831/udp \
  -p 6832:6832/udp \
  -p 5778:5778 \
  -p 16686:16686 \
  -p 14268:14268 \
  -p 14250:14250 \
  -p 9411:9411 \
  jaegertracing/all-in-one:1.22.0


# Use host ip to connect to DaemonSet's Pod

```
- name: JAEGER_AGENT_HOST
  valueFrom:
    fieldRef:
      fieldPath: status.hostIP
```