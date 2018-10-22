#!/bin/bash
sudo apt-get update
wget https://www.foundationdb.org/downloads/5.2.5/ubuntu/installers/foundationdb-clients_5.2.5-1_amd64.deb
wget https://www.foundationdb.org/downloads/5.2.5/ubuntu/installers/foundationdb-server_5.2.5-1_amd64.deb
sudo dpkg -i foundationdb-clients_5.2.5-1_amd64.deb foundationdb-clients_5.2.5-1_amd64.deb
sudo dpkg -i foundationdb-server_5.2.5-1_amd64.deb foundationdb-server_5.2.5-1_amd64.deb
sudo apt-get update
sudo apt -y --fix-broken install