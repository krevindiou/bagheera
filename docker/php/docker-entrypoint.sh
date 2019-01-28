#!/usr/bin/env bash

if [[ $ENV != 'dev' ]]; then
    rm -f /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini
fi

./bin/build "$ENV"

exec "$@"
