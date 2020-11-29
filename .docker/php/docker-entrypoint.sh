#!/usr/bin/env bash

if [[ $DOCKER_ENV != 'dev' ]]; then
    rm -f /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini
fi

exec "$@"
