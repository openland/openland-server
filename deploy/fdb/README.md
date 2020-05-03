# FoundationDB

Current used version is 6.0.15.

## Install Server

```
wget https://www.foundationdb.org/downloads/6.0.15/ubuntu/installers/foundationdb-clients_6.0.15-1_amd64.deb
wget https://www.foundationdb.org/downloads/6.0.15/ubuntu/installers/foundationdb-server_6.0.15-1_amd64.deb
sudo dpkg -i foundationdb-clients_6.0.15-1_amd64.deb
sudo dpkg -i foundationdb-server_6.0.15-1_amd64.deb
sudo apt -y --fix-broken install
```