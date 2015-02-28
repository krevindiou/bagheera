#!/bin/bash
set -e

gosu postgres postgres --single -jE <<-EOSQL
    ALTER DATABASE ${DB_NAME} OWNER TO ${POSTGRES_USER}
EOSQL

gosu postgres postgres --single -jE ${DB_NAME} <<-EOSQL
    ALTER SCHEMA public OWNER TO ${POSTGRES_USER}
EOSQL

gosu postgres postgres --single -jE <<-EOSQL
    CREATE DATABASE ${DB_NAME}_test WITH OWNER ${POSTGRES_USER}
EOSQL

gosu postgres postgres --single -jE ${DB_NAME}_test <<-EOSQL
    ALTER SCHEMA public OWNER TO ${POSTGRES_USER}
EOSQL

gosu postgres postgres --single -jE ${DB_NAME} < /structure.sql
