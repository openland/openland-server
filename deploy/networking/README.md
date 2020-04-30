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
`infra-zerotier` vm routes tcp traffic on ports 443 and 80 to `infra-haproxy` in Bernal DC