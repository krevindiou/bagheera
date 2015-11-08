#!/bin/bash

if [ ! -s "$PGDATA/PG_VERSION" ]; then
    mkdir -p "$PGDATA"
    chown -R postgres "$PGDATA"

    gosu postgres initdb

    echo "host all all 172.16.0.0/12 password" >> "$PGDATA/pg_hba.conf"
    echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"

    gosu postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses=''" -w start

    gosu postgres psql -c "CREATE USER ${DATABASE_USER} WITH PASSWORD '${DATABASE_PASSWORD}'";
    gosu postgres psql -c "CREATE DATABASE ${DATABASE_NAME} WITH OWNER ${DATABASE_USER}"

    if [ "$ENV" == 'dev' ]; then
        gosu postgres psql -c "CREATE DATABASE ${DATABASE_NAME}_test WITH OWNER ${DATABASE_USER}"
    fi

    psql -U ${DATABASE_USER} -d ${DATABASE_NAME} -f /srv/www/bagheera/app/Resources/config/docker/postgresql/structure.sql > /dev/null
    psql -U ${DATABASE_USER} -d ${DATABASE_NAME} -f /srv/www/bagheera/app/Resources/config/docker/postgresql/fixtures.sql > /dev/null

    gosu postgres pg_ctl -D "$PGDATA" -m fast -w stop
fi

exec gosu postgres "$@"
