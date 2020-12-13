#!/usr/bin/env bash

rm -f /etc/nginx/conf.d/default.conf
ln -s "/etc/nginx/bagheera.${APP_ENV}.conf" /etc/nginx/conf.d/default.conf

exec "$@"
