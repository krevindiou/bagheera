#!/bin/bash

cp /srv/www/bagheera/app/Resources/config/docker/nginx/bagheera.${ENV}.conf /etc/nginx/sites-available/default

exec "$@"
