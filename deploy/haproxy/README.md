# Haproxy Deployment

### Installation

```
sudo apt-get install haproxy

```

### Configuration

Edit: /etc/haproxy/haproxy.cfg
- Leave crypto config default
- Route via sni

#### Define backend

```
backend <backend_name>
    server <node1_name> <node1_host>:<node1_port> check
    server <node2_name> <node2_host>:<node2_port> check
```

### Define frontend

```
frontend <frontend_name>
    bind *:443 # Listen for 443 port ssl cert <path_to_certificate> # Bind with certificate
    mode tcp # Frontend type http or tcp
    acl <acl_name> hdr(host) -i <host> # Route by host header
    use_backend <backend_name> if <acl_name> # Route to <backend_name> if <acl_name> is successful
```

### Redirect http to https
redirect scheme https code 301 if !{ ssl_fc }