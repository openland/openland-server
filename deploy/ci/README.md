Build agent requirements:
* Docker
* Node 12 + Yarn
* FoundationDB
* JDK 8

## User
sudo useradd teamcity

## Docker
sudo apt-get install -y docker.io
sudo usermod -aG docker unicorn
sudo usermod -aG docker teamcity
sudo -u teamcity docker login

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

##### Start
sudo systemctl daemon-reload
sudo systemctl start teamcity
sudo systemctl enable teamcity