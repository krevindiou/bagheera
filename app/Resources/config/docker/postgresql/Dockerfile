FROM bagheera_base


ENV PG_VERSION 9.4
ENV PATH /usr/lib/postgresql/$PG_VERSION/bin:$PATH
ENV PGDATA /var/lib/postgresql/data

RUN apt-get -y update && apt-get -y install postgresql-$PG_VERSION

COPY docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]

USER postgres

RUN initdb
RUN echo "host all all 172.17.0.0/24 password" >> "$PGDATA/pg_hba.conf"
RUN echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"

CMD ["postgres"]

EXPOSE 5432
