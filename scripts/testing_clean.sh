set -e
rm -fr .data
mkdir .data
mkdir .data/elastic
mkdir .data/postgres
chmod -R 757 .data/elastic
chmod -R 757 .data/postgres