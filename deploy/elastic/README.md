# About

Our infrastrucure provides separate elastic search instances in different regions. All clusters are treated as disposable.

### Clusters

0) default: Old elastic cluster
1) openland-elastic-mission: SF-based cluster

## 1. Install

```
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
sudo apt-get install apt-transport-https
echo "deb https://artifacts.elastic.co/packages/7.x/apt stable main" | sudo tee -a /etc/apt/sources.list.d/elastic-7.x.list
sudo apt-get update && sudo apt-get install elasticsearch
```

## 2. Configure

Configure Cluster:
```
sudo nano /etc/elasticsearch/elasticsearch.yml
```

Specify:
```
cluster.name: openland-elastic-mission (same for each node in cluster)
node.name: openland-elastic-0 (should match VM name)
network.host: 0.0.0.0
discovery.seed_hosts: ["127.0.0.1"] (for first node it is 127.0.0.1, but for other is IP of first node)
```

```
sudo nano /etc/elasticsearch/jvm.options
```
Specify:
```
-Xms2g
-Xmx2g
```

## 3. Start

```
sudo systemctl start elasticsearch.service
sudo systemctl enable elasticsearch.service
```