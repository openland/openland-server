# FoundationDB

Current used version is 6.2.20.

## Install Server 6.2.20

```
wget https://www.foundationdb.org/downloads/6.2.20/ubuntu/installers/foundationdb-clients_6.2.20-1_amd64.deb
wget https://www.foundationdb.org/downloads/6.2.20/ubuntu/installers/foundationdb-server_6.2.20-1_amd64.deb
sudo dpkg -i foundationdb-clients_6.2.20-1_amd64.deb
sudo dpkg -i foundationdb-server_6.2.20-1_amd64.deb
```

## Update Server

Check if this is a major/minor upgrade or a patch one. If it is not a patch upgrade (changed only third number in version) than you can just upgrade 
server and clients independently. 

If it s not, follow next steps:

### Step 1: Prepare application server
You should have prepared application server with a new FDB client. Docker should be already in docker hub.

### Step 2: Backups
Perform full backup of database to keep most up to date version

### Step 3: Upgrade all client nodes
Upgrade client nodes like monitoring first.

### Step 4: Upgrade all nodes
Execute installation script for a new version

### Step 5: Start deployment of updated application server
Perform rolling update for application. It will fail until we restart FDB.

### Step 6: Restart all FDB processes

Get all nodes execute `kill` in fdbcli, then enumerate all of them:
```
kill <node1> <node2> ... <nodeN>
```

Check that killed right amount of servers.