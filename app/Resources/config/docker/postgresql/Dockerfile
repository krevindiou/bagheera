FROM bagheera_base


ENV PGVERSION 9.4.4
ENV PATH /usr/local/pgsql/bin:$PATH
ENV PGDATA /var/lib/postgresql/data

RUN apt-get -y update && apt-get -y install \
    libreadline-dev \
    zlib1g-dev \
    gcc \
    make

RUN groupadd -r postgres && useradd -r -g postgres postgres
RUN mkdir -p $PGDATA
RUN chown -R postgres $PGDATA

RUN mkdir /srv/src && wget http://ftp.postgresql.org/pub/source/v${PGVERSION}/postgresql-${PGVERSION}.tar.gz -O - | tar xvz -C /srv/src

WORKDIR /srv/src/postgresql-${PGVERSION}
RUN ./configure
RUN make
RUN make install
RUN rm -rf /srv/src

COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

USER postgres

RUN initdb
RUN echo "host all all 172.17.0.0/24 password" >> "$PGDATA/pg_hba.conf"
RUN echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"

CMD ["postgres"]

EXPOSE 5432
