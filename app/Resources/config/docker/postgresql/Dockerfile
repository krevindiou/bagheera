FROM bagheera_base


ENV PATH /usr/lib/postgresql/9.4/bin/:$PATH
ENV PGDATA /var/lib/postgresql/data

RUN apt-get -y update \
    && apt-get -y install \
    postgresql-9.4 \
    postgresql-contrib \
    postgresql-client-9.4 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN wget --quiet "https://github.com/tianon/gosu/releases/download/1.6/gosu-$(dpkg --print-architecture)" -O /usr/local/bin/gosu \
    && wget --quiet "https://github.com/tianon/gosu/releases/download/1.6/gosu-$(dpkg --print-architecture).asc" -O /usr/local/bin/gosu.asc \
    && gpg --keyserver pool.sks-keyservers.net --recv-keys B42F6819007F00F88E364FD4036A9C25BF357DD4 \
    && gpg --verify /usr/local/bin/gosu.asc \
    && rm /usr/local/bin/gosu.asc \
    && chmod +x /usr/local/bin/gosu

COPY docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["postgres"]

EXPOSE 5432
