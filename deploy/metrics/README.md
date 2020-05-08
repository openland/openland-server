# Metrics Deployment

### metrics-ui
UI apps for metrics backends. Grafana and Kibana.

### metrics-foundationdb
FoundationDB metrics collector. fdbcli, influxdb and telegraf.

```
wget https://www.foundationdb.org/downloads/6.0.15/ubuntu/installers/foundationdb-clients_6.0.15-1_amd64.deb
sudo dpkg -i foundationdb-clients_6.0.15-1_amd64.deb
```

### metrics-prometheus

```
sudo apt-get install docker
sudo mkdir -p /opt/prometheus/data
sudo chmod -R a+rw /opt/prometheus/data
```

#### /opt/prometheus/prometheus.yml
```
# my global config
global:
  scrape_interval:     15s # Set the scrape interval to every 15 seconds. Default is every 1 minute.
  evaluation_interval: 15s # Evaluate rules every 15 seconds. The default is every 1 minute.
  # scrape_timeout is set to the global default (10s).

# Alertmanager configuration
alerting:
  alertmanagers:
  - static_configs:
    - targets:
      # - alertmanager:9093

# Load rules once and periodically evaluate them according to the global 'evaluation_interval'.
rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

# A scrape configuration containing exactly one endpoint to scrape:
# Here it's Prometheus itself.
scrape_configs:
  # The job name is added as a label `job=<job_name>` to any timeseries scraped from this config.
  - job_name: 'prometheus'

    # metrics_path defaults to '/metrics'
    # scheme defaults to 'http'.

    static_configs:
    - targets: ['localhost:9090']
```

```
sudo docker run \
    -d \
    --restart always \
    --name prometheus \
    -p 9090:9090 \
    -v /opt/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml \
    -v /opt/prometheus/data:/data/prometheus \
    prom/prometheus --config.file="/etc/prometheus/prometheus.yml" --storage.tsdb.path="/data/prometheus"
```