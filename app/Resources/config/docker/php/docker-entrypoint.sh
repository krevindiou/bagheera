#!/bin/bash

if [ "$ENV" == 'prod' ]; then
    rm -f /etc/php5/cli/conf.d/20-xdebug.ini
    rm -f /etc/php5/fpm/conf.d/20-xdebug.ini
fi

mkdir -p /dev/shm/bagheera/cache /dev/shm/bagheera/logs
setfacl -R -m u:www-data:rwX -m u:`whoami`:rwX /dev/shm/bagheera/cache /dev/shm/bagheera/logs
setfacl -dR -m u:www-data:rwX -m u:`whoami`:rwX /dev/shm/bagheera/cache /dev/shm/bagheera/logs

npm install --prefix /srv/www/bagheera/app/Resources

composer self-update
composer --working-dir=/srv/www/bagheera --no-interaction install

/srv/www/bagheera/app/console assetic:dump --env=$ENV

exec "$@"
