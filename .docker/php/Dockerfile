FROM php:8.0-fpm-buster AS base
RUN usermod -u 1000 www-data
RUN echo "date.timezone='UTC'" > "$PHP_INI_DIR/conf.d/timezone.ini"
RUN echo 'realpath_cache_size = 5120k' > "$PHP_INI_DIR/conf.d/realpath_cache_size.ini"
RUN echo 'expose_php = off' > "$PHP_INI_DIR/conf.d/expose_php.ini"
RUN echo 'memory_limit = 512M' > "$PHP_INI_DIR/conf.d/memory_limit.ini"
RUN apt-get update && apt-get install -y zip git acl
RUN apt-get update && apt-get install -y libmcrypt-dev
RUN yes '' | pecl install mcrypt-1.0.4 && docker-php-ext-enable mcrypt
RUN apt-get update && apt-get install -y libpq-dev
RUN docker-php-ext-install -j$(nproc) pdo_pgsql
RUN apt-get update && apt-get install -y libzip-dev
RUN docker-php-ext-install -j$(nproc) zip
RUN apt-get update && apt-get install -y libicu-dev
RUN docker-php-ext-install -j$(nproc) intl
RUN yes '' | pecl install apcu-5.1.20 && docker-php-ext-enable apcu
RUN docker-php-ext-install -j$(nproc) opcache
RUN apt-get update && apt-get install -y gnupg
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash - && apt-get install -y nodejs
ENV PATH="$PATH:/root/.yarn/bin"
RUN curl -L -o- https://yarnpkg.com/install.sh | bash -s -- --version 1.13.0
RUN curl -L -o /usr/local/bin/composer https://github.com/composer/composer/releases/download/2.0.12/composer.phar
RUN chmod +x /usr/local/bin/composer
WORKDIR /srv/www/bagheera
EXPOSE 9000
CMD ["php-fpm"]

FROM base AS dev
ENV APP_ENV=dev
ENV NODE_ENV=development
RUN pecl install xdebug-3.0.3 && docker-php-ext-enable xdebug
RUN echo 'xdebug.max_nesting_level=512' > "$PHP_INI_DIR/conf.d/xdebug.ini"
RUN curl -L -o /usr/local/bin/php-cs-fixer https://github.com/FriendsOfPHP/PHP-CS-Fixer/releases/download/v3.1.0/php-cs-fixer.phar
RUN chmod +x /usr/local/bin/php-cs-fixer
COPY composer.json composer.lock ./
RUN composer install --no-ansi --no-interaction --no-progress --no-scripts
COPY . ./
RUN composer run-script --no-ansi --no-interaction post-install-cmd

FROM base AS prod
ENV APP_ENV=prod
ENV NODE_ENV=production
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY composer.json composer.lock ./
RUN composer install --no-ansi --no-interaction --no-progress --no-dev --optimize-autoloader --no-scripts
COPY package.json yarn.lock ./
RUN yarn install --production=false
COPY . ./
RUN composer run-script --no-ansi --no-interaction post-install-cmd
RUN yarn encore production
RUN yarn install --production=true --ignore-scripts --prefer-offline
RUN setfacl -R -m u:www-data:rwX -m u:`whoami`:rwX var
RUN setfacl -dR -m u:www-data:rwX -m u:`whoami`:rwX var
USER www-data
