# Creating a new instance template


## Startup script for a VM (mounts disk if needed)

```
#!/bin/bash
set -euxo pipefail

# Format and mount disk
MNT_DIR=/mnt/disks/data
if [[ -d "$MNT_DIR" ]]; then
        echo "Disk already mounted"
else 
        mkfs.ext4 -m 0 -F -E lazy_itable_init=0,lazy_journal_init=0,discard /dev/nvme0n1; \
        mkdir -p $MNT_DIR
        mount -o discard,defaults /dev/nvme0n1 $MNT_DIR
        echo UUID=`blkid -s UUID -o value /dev/nvme0n1` $MNT_DIR ext4 discard,defaults,nofail 0 2 | tee -a /etc/fstab
fi

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
wget https://www.foundationdb.org/downloads/6.2.20/ubuntu/installers/foundationdb-clients_6.2.20-1_amd64.deb
wget https://www.foundationdb.org/downloads/6.2.20/ubuntu/installers/foundationdb-server_6.2.20-1_amd64.deb
sudo dpkg -i foundationdb-clients_6.2.20-1_amd64.deb
sudo dpkg -i foundationdb-server_6.2.20-1_amd64.deb

service foundationdb stop
sudo echo "LfYwBoAP:CJKgoyyf5r9egRead2kVPeGNfB25GVoh@10.138.0.15:4500,10.138.0.16:4500,10.138.0.17:4500,10.138.0.18:4500,10.138.0.19:4500" > /etc/foundationdb/fdb.cluster
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