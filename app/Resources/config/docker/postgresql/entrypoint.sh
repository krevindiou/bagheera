#!/bin/bash
set -e

gosu postgres pg_ctl -w start

gosu postgres psql -c "ALTER DATABASE ${DB_NAME} OWNER TO ${POSTGRES_USER}"
gosu postgres psql -d ${DB_NAME} -c "ALTER SCHEMA public OWNER TO ${POSTGRES_USER}"

gosu postgres psql -c "CREATE DATABASE ${DB_NAME}_test WITH OWNER ${POSTGRES_USER}"
gosu postgres psql -d ${DB_NAME}_test -c "ALTER SCHEMA public OWNER TO ${POSTGRES_USER}"

gosu postgres psql -d ${DB_NAME} -a -f /srv/www/bagheera/app/Resources/config/docker/postgresql/structure.sql
gosu postgres psql -d ${DB_NAME} -a -f /srv/www/bagheera/app/Resources/config/docker/postgresql/fixtures.sql
