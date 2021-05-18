# Creating a new instance template


## Startup script for a VM (mounts disk if needed)

```
#!/bin/bash
set -euxo pipefail

# Format and mount disk
mkfs.ext4 -m 0 -F -E lazy_itable_init=0,lazy_journal_init=0,discard /dev/nvme0n1
mkdir -p /mnt/disks/data
mount -o discard,defaults /dev/nvme0n1 /mnt/disks/data

# Create FDB working directory
FDB_DIR=/mnt/disks/data/foundationdb
if [[ -d "$FDB_DIR" ]]; then
        echo "FDB folder already created"
else 
        mkdir $FDB_DIR
        chown -R foundationdb:foundationdb /mnt/disks/data/foundationdb
fi
```

## Install FDB

Script
```
wget https://storage.googleapis.com/openland-distrib/foundationdb-clients_6.2.20-1_amd64.deb
wget https://storage.googleapis.com/openland-distrib/foundationdb-server_6.2.20-1_amd64.deb
sudo dpkg -i foundationdb-clients_6.2.20-1_amd64.deb
sudo dpkg -i foundationdb-server_6.2.20-1_amd64.deb

sudo service foundationdb stop
sudo echo "LfYwBoAP:MNrUxed7DA2LrkoAD817TejtsL5j84vX@10.128.0.33:4500,10.138.0.9:4500,10.168.0.7:4500,10.180.0.2:4500,10.182.0.2:4500" > /etc/foundationdb/fdb.cluster
```

Config
```
[fdbmonitor]
user = foundationdb
group = foundationdb
[general]
restart_delay = 60
cluster_file = /etc/foundationdb/fdb.cluster
[fdbserver]
command = /usr/sbin/fdbserver
public_address = auto:$ID
listen_address = public
datadir = /mnt/disks/data/foundationdb/data/$ID
logdir = /mnt/disks/data/foundationdb
[fdbserver.4500]
class=storage
```

### Install Node Exporter

wget https://github.com/prometheus/node_exporter/releases/download/v1.1.2/node_exporter-1.1.2.linux-amd64.tar.gz
tar -xvf node_exporter*
sudo mv node_exporter*/node_exporter /usr/local/bin
sudo useradd -rs /bin/false node_exporter
sudo nano /etc/systemd/system/node_exporter.service

```
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
```

sudo systemctl daemon-reload
sudo systemctl start node_exporter
sudo systemctl enable node_exporter
sudo systemctl status node_exporter