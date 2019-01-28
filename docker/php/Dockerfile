FROM php:5.6-fpm

RUN usermod -u 1000 www-data
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
RUN echo "date.timezone='UTC'" > "$PHP_INI_DIR/conf.d/timezone.ini"
RUN echo 'realpath_cache_size = 5120k' > "$PHP_INI_DIR/conf.d/realpath_cache_size.ini"
RUN echo 'expose_php = off' > "$PHP_INI_DIR/conf.d/expose_php.ini"
RUN echo 'memory_limit = 512M' > "$PHP_INI_DIR/conf.d/memory_limit.ini"
RUN apt-get update && apt-get install -y zip git

# mcrypt
RUN apt-get update && apt-get install -y libmcrypt-dev
RUN docker-php-ext-install mcrypt

# postgresql
RUN apt-get update && apt-get install -y libpq-dev
RUN docker-php-ext-install pdo_pgsql

# intl
RUN apt-get update && apt-get install -y libicu-dev
RUN pecl install intl-3.0.0 && docker-php-ext-enable intl

# xdebug
RUN pecl install xdebug-2.5.5 && docker-php-ext-enable xdebug
RUN echo 'xdebug.max_nesting_level=512' > "$PHP_INI_DIR/conf.d/xdebug.ini"

# apc
RUN pecl install apcu-4.0.11 && docker-php-ext-enable apcu

# phpunit
RUN curl -L -o /usr/local/bin/phpunit https://phar.phpunit.de/phpunit-5.phar
RUN chmod +x /usr/local/bin/phpunit

# composer
RUN curl -L -o /usr/local/bin/composer https://github.com/composer/composer/releases/download/1.8.0/composer.phar
RUN chmod +x /usr/local/bin/composer

# node
RUN apt-get update && apt-get install -y gnupg
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash - && apt-get install -y nodejs

COPY docker/php/docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]

WORKDIR /srv/www/bagheera

CMD ["php-fpm"]
