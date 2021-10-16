FROM php:8.0-fpm-alpine3.13 AS base
RUN apk add --no-cache shadow \
    && usermod -u 1000 www-data \
    && apk del shadow
RUN echo "date.timezone='UTC'" > "$PHP_INI_DIR/conf.d/timezone.ini"
RUN echo 'realpath_cache_size = 5120k' > "$PHP_INI_DIR/conf.d/realpath_cache_size.ini"
RUN echo 'expose_php = off' > "$PHP_INI_DIR/conf.d/expose_php.ini"
RUN echo 'memory_limit = 512M' > "$PHP_INI_DIR/conf.d/memory_limit.ini"
RUN apk add --no-cache icu-dev icu-libs \
    && docker-php-ext-install -j$(nproc) intl \
    && apk del icu-dev
RUN apk add --no-cache postgresql-dev libpq \
    && docker-php-ext-install -j$(nproc) pdo_pgsql \
    && apk del postgresql-dev
RUN apk add --no-cache libzip \
    && docker-php-ext-install -j$(nproc) opcache \
    && apk del libzip
WORKDIR /srv/www/bagheera

FROM base AS build-base
RUN apk add --no-cache bash git acl nodejs yarn make
RUN curl -L -o /usr/local/bin/composer https://github.com/composer/composer/releases/download/2.0.12/composer.phar
RUN chmod +x /usr/local/bin/composer

FROM build-base AS dev
ENV APP_ENV=dev
ENV NODE_ENV=development
RUN apk add --no-cache php8-pecl-xdebug
RUN echo 'zend_extension=/usr/lib/php8/modules/xdebug.so' > "$PHP_INI_DIR/conf.d/xdebug.ini"
RUN echo 'xdebug.max_nesting_level=512' >> "$PHP_INI_DIR/conf.d/xdebug.ini"
RUN echo 'max_execution_time = 60' > "$PHP_INI_DIR/conf.d/max_execution_time.ini"
RUN curl -L -o /usr/local/bin/php-cs-fixer https://github.com/FriendsOfPHP/PHP-CS-Fixer/releases/download/v3.1.0/php-cs-fixer.phar
RUN chmod +x /usr/local/bin/php-cs-fixer
COPY composer.json composer.lock ./
RUN composer install --no-ansi --no-interaction --no-progress --no-scripts
COPY . ./
RUN composer run-script --no-ansi --no-interaction post-install-cmd
RUN setfacl -dR -m u:www-data:rwX -m u:`whoami`:rwX var
RUN setfacl -R -m u:www-data:rwX -m u:`whoami`:rwX var

FROM build-base AS build-prod
ENV APP_ENV=prod
ENV NODE_ENV=production
COPY composer.json composer.lock ./
RUN composer install --no-ansi --no-interaction --no-progress --no-dev --optimize-autoloader --no-scripts
COPY package.json yarn.lock ./
RUN yarn install --production=false
COPY . ./
RUN composer run-script --no-ansi --no-interaction post-install-cmd
RUN setfacl -dR -m u:www-data:rwX -m u:`whoami`:rwX var
RUN setfacl -R -m u:www-data:rwX -m u:`whoami`:rwX var
RUN yarn encore production
RUN yarn install --production=true --ignore-scripts --prefer-offline

FROM base AS prod
ENV APP_ENV=prod
ENV NODE_ENV=production
RUN apk add --no-cache shadow \
    && usermod -u 1000 www-data \
    && apk del shadow
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY --from=build-prod /srv/www/bagheera/ /srv/www/bagheera/
WORKDIR /srv/www/bagheera
USER www-data
