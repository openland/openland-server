Build agent requirements:
* Docker
* Node 12 + Yarn
* FoundationDB
* JDK 8
* Fly
* GoogleSDK

## User
sudo useradd teamcity
sudo mkdir /home/teamcity && sudo chown teamcity:teamcity /home/teamcity

## Docker
sudo apt-get install -y docker.io
sudo usermod -aG docker unicorn
sudo usermod -aG docker teamcity
sudo -u teamcity docker login
sudo docker login

## Node JS
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs 
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install -y yarn

## JDK and utils
sudo apt-get update && sudo apt-get install -y openjdk-8-jdk nano unzip git

## FoundationDB
wget https://foundationdb-origin.apple.com/downloads/6.2.15/ubuntu/installers/foundationdb-clients_6.2.15-1_amd64.deb
wget https://foundationdb-origin.apple.com/downloads/6.2.15/ubuntu/installers/foundationdb-server_6.2.15-1_amd64.deb
sudo dpkg -i foundationdb-clients_6.2.15-1_amd64.deb
sudo dpkg -i foundationdb-server_6.2.15-1_amd64.deb

## Fly
sudo su -
curl -L https://getfly.fly.dev/install.sh | sh

## Rancher
wget https://releases.rancher.com/cli2/v2.4.3/rancher-linux-amd64-v2.4.3.tar.gz
tar -xvf rancher-linux-amd64-v2.4.3.tar.gz
sudo mv ./rancher-v2.4.3/rancher /usr/bin/

## Openland Secondary K8S
Copy config to /home/teamcity/openland-secondary.yaml

## Agent
sudo mkdir /opt/teamcity
cd /opt/teamcity
sudo wget https://storage.googleapis.com/openland-distrib/buildAgent.zip
sudo unzip buildAgent.zip
sudo rm buildAgent.zip
sudo chown -R teamcity:teamcity .


Write /etc/systemd/system/teamcity.service:
[Unit]
Description=TeamCity Build Agent
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
SuccessExitStatus=0 143
User=teamcity
Group=teamcity
PIDFile=/opt/teamcity/logs/buildAgent.pid
ExecStart=/opt/teamcity/bin/agent.sh start
ExecStop=/opt/teamcity/bin/agent.sh stop

[Install]
WantedBy=multi-user.target

## GoogleSDK
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
sudo apt-get install apt-transport-https ca-certificates gnupg
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
sudo apt-get update && sudo apt-get install google-cloud-sdk
sudo apt-get install kubectl
#### Write /opt/teamcity/conf/service-account.json
sudo -u teamcity gcloud auth activate-service-account --key-file=/opt/teamcity/conf/service-account.json
sudo -u teamcity gcloud config set project statecraft-188615

##### Start
sudo systemctl daemon-reload
sudo systemctl enable teamcity
sudo systemctl start teamcity (could hang, just skip)