# Installing and configuring Zerotier L3 bridge

## 1. Create gateway VM
For google cloud you have to create new VM with "ip forward" enabled!!

## Install Zerotier to gateway VM
```
curl -s https://install.zerotier.com | sudo bash
```

## Join both gateway
Add routes to my.zerotier.com for both subnets and repsected routers.
IMPORTANT: Add pod networks from kubernetes too

## Configure routes
In GCP specify routes for remote subnet to be routed via this VM.
IMPORTANT: add new rule allowing all ingress traffic from this subnet.

In Unifi it is enougth just to define subnets.

No configuration on VMs are needed.