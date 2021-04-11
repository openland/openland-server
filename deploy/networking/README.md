# Description of openland networking

### DNS
Who have access: everyone for openlandservers.com, Steve for openand.com/io/etc.

Google Cloud and Bernal DC have separate dns servers and they are not connected.
To share hostname between use openlandservers.com zone with .corp within.
DNS zone is managed via Google Cloud DNS.

### Google Cloud
Who have access: everyone.

Rules enabled:
- Local trafic is allowed
- Ingress traffic should be explicitly enabled
- Egress traffic allowed
- Trafic between bernal dc and google cloud allowed (since bernal network is not a local for google)

### Bernal DC
- Unifi DreamMachine for routing (access: Steve).
- Zerotier VM on bernal1 that connects to google cloud network
- For google traffic everything is routed via zerotier VM

### Nats
NATS is deployed to google cloud. Primary (bootstrap nodes) are in us-central1. 
This could (should?) be changed to any other region. But configuration should be updated everywhere.
Both k8s clusters have nats as daemon set.

### Corporate Services
Corporate services are shielded by cloudflare with OTP and then routed to `infra-zerotier` vm in google cloud.
`infra-zerotier` vm routes tcp traffic on ports 443 and 80 to `infra-haproxy` in Bernal DC.

GCP's `infra-zerotier` haproxy is plain tcp proxy with ip limitter to allow only cloudflare origin IP.
Bernal DC `infra-haproxy` is http proxy that have origin certificate and verifies client certificate 
from cloudflare (Origin Pull Certificate).


### Networks

Google networks:
* VPC: 10.128.0.0/9 (10.128.0.1 - 10.255.255.254)
* * 00001010.10000000.00000000.00000001
* * 00001010.11111111.11111111.11111110

* k8s: 10.0.0.0/20 (10.0.0.1 - 10.0.15.254)
* * 00001010.00000000.00000000.00000001
* * 00001010.00000000.00001111.11111110

* k8s-pods: 10.20.0.0/14 (10.20.0.1 - 10.23.255.254)
* * 00001010.00010100.00000000.00000001
* * 00001010.00010111.11111111.11111110

* k8s(?): 10.16.0.0/14 (10.16.0.1 - 10.19.255.254)
* * 00001010.00010000.00000000.00000001
* * 00001010.00010011.11111111.11111110

* Kubernetes Base Network:
Useful calculator for splitting network to subnets: http://www.davidc.net/sites/default/subnets/subnets.html

* 10.32.0.0/11 (10.32.0.1 - 10.63.255.254)
* * 00001010.00100000.00000000.00000001
* * 00001010.00111111.11111111.11111110

* Kubernetes Base Blocks:
* 10.32.0.0/14 (used)
* 10.36.0.0/14 (lb)
* 10.40.0.0/14 (lb?)
* 10.44.0.0/14
* 10.48.0.0/14
* 10.52.0.0/14
* 10.56.0.0/14
* 10.60.0.0/14

* Kubernetes Subnets
* * 10.32.0.0/18 (openland-server-us-west1/pods)
* * 10.32.64.0/18 (openland-server-us-west1/services)
* * 10.32.128.0/18 (openland-workers-us-west1/pods)
* * 10.32.192.0/18 (openland-workers-us-west1/services)
* * 10.33.0.0/18
* * 10.33.64.0/18
* * 10.33.128.0/18
* * 10.33.192.0/18
* * 10.34.0.0/18
* * 10.34.64.0/18
* * 10.34.128.0/18
* * 10.34.192.0/18
* * 10.35.0.0/18
* * 10.35.64.0/18
* * 10.35.128.0/18
* * 10.35.192.0/18

Zerotier:
* 172.28.0.0/16

Mission DC:
* Internal: 10.12.0.0/16 (10.12.0.1 - 10.12.255.254)
* * 00001010.00001100.00000000.00000001
* * 00001010.00001100.11111111.11111110

* VPN: 10.24.0.0/24 (10.24.0.1 - 10.24.0.254)
* * 00001010.00011000.00000000.00000001
* * 00001010.00011000.00000000.11111110

### IPs

* Mission Public IP: 192.195.80.6

* Mission DL360 iLO: 10.12.0.2
* Mission DL360 ESXi: 10.12.0.5
* Mission DL380 iLO: 10.12.0.3
* Mission DL380 ESXi: 10.12.0.6
* Mission Synology: 10.12.0.4

* Mission Zerotier Local: 10.12.0.7
* Mission Zerotier ZT: 172.28.218.102
* Mission HA Proxy: 10.12.0.8
* Mission Metrics Elastic: 10.12.0.9
* Mission Metrics FDB: 10.12.0.10
* Mission Metrics UI: 10.12.0.11
* Mission Clickhouse: 10.12.0.19
* Mission Jaeger: 10.12.69.10
* Mission openland-elastic-0: 10.12.233.241
* Mission openland-elastic-1: 10.12.126.50
* Mission staging-elastic: 10.12.55.42
* Mission infra-nsolid: 10.12.202.146