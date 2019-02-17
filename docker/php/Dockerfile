FROM php:7.3-fpm

ENV PATH="$PATH:/root/.yarn/bin"

RUN usermod -u 1000 www-data
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
RUN echo "date.timezone='UTC'" > "$PHP_INI_DIR/conf.d/timezone.ini"
RUN echo 'realpath_cache_size = 5120k' > "$PHP_INI_DIR/conf.d/realpath_cache_size.ini"
RUN echo 'expose_php = off' > "$PHP_INI_DIR/conf.d/expose_php.ini"
RUN echo 'memory_limit = 512M' > "$PHP_INI_DIR/conf.d/memory_limit.ini"
RUN apt-get update && apt-get install -y zip git

# mcrypt
RUN apt-get update && apt-get install -y libmcrypt-dev
RUN yes '' | pecl install mcrypt-1.0.2 && docker-php-ext-enable mcrypt

# postgresql
RUN apt-get update && apt-get install -y libpq-dev
RUN docker-php-ext-install -j$(nproc) pdo_pgsql

# zip
RUN apt-get update && apt-get install -y libzip-dev
RUN docker-php-ext-install -j$(nproc) zip

# intl
RUN apt-get update && apt-get install -y libicu-dev
RUN docker-php-ext-install -j$(nproc) intl

# xdebug
RUN pecl install xdebug-2.7.0RC1 && docker-php-ext-enable xdebug
RUN echo 'xdebug.max_nesting_level=512' > "$PHP_INI_DIR/conf.d/xdebug.ini"

# apc
RUN yes '' | pecl install apcu-5.1.16 && docker-php-ext-enable apcu

# opcache
RUN docker-php-ext-install -j$(nproc) opcache

# php-cs-fixer
RUN curl -L -o /usr/local/bin/php-cs-fixer https://github.com/FriendsOfPHP/PHP-CS-Fixer/releases/download/v2.14.1/php-cs-fixer.phar
RUN chmod +x /usr/local/bin/php-cs-fixer

# composer
RUN curl -L -o /usr/local/bin/composer https://github.com/composer/composer/releases/download/1.8.0/composer.phar
RUN chmod +x /usr/local/bin/composer

# node
RUN apt-get update && apt-get install -y gnupg
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash - && apt-get install -y nodejs
RUN curl -L -o- https://yarnpkg.com/install.sh | bash -s -- --version 1.13.0

COPY docker/php/docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]

WORKDIR /srv/www/bagheera

CMD ["php-fpm"]
