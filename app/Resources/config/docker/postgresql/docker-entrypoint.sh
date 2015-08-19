#!/bin/bash

pg_ctl -w start

psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}'";
psql -c "CREATE DATABASE ${DB_NAME} WITH OWNER ${DB_USER}"
psql -c "CREATE DATABASE ${DB_NAME}_test WITH OWNER ${DB_USER}"

psql -U ${DB_USER} -d ${DB_NAME} -f /srv/www/bagheera/app/Resources/config/docker/postgresql/structure.sql > /dev/null
psql -U ${DB_USER} -d ${DB_NAME} -f /srv/www/bagheera/app/Resources/config/docker/postgresql/fixtures.sql > /dev/null

pg_ctl -w stop

exec "$@"
