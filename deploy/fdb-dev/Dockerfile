FROM ubuntu:16.04
RUN apt-get update && apt-get install -y curl python

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini

ARG FDB_VERSION=6.0.15
ARG DEB_REVISION=1

RUN curl -sO https://www.foundationdb.org/downloads/${FDB_VERSION}/ubuntu/installers/foundationdb-clients_${FDB_VERSION}-${DEB_REVISION}_amd64.deb
RUN curl -sO https://www.foundationdb.org/downloads/${FDB_VERSION}/ubuntu/installers/foundationdb-server_${FDB_VERSION}-${DEB_REVISION}_amd64.deb
RUN dpkg -i foundationdb-clients_${FDB_VERSION}-${DEB_REVISION}_amd64.deb foundationdb-server_${FDB_VERSION}-${DEB_REVISION}_amd64.deb

RUN rm -r /var/lib/foundationdb/data/*

ENTRYPOINT ["/tini", "-e", "2", "--"]
CMD ["/usr/lib/foundationdb/fdbmonitor"]