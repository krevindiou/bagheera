#!/usr/bin/env bash

if [[ $APP_ENV != 'dev' ]]; then
    rm -f /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini
fi

setfacl -R -m u:www-data:rwX -m u:`whoami`:rwX var
setfacl -dR -m u:www-data:rwX -m u:`whoami`:rwX var

exec "$@"
