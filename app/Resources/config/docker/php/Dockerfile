FROM bagheera_base


RUN apt-get -y update && apt-get -y install \
    curl \
    acl \
    php5-cli \
    php5-fpm \
    php5-mcrypt \
    php5-intl \
    php5-pgsql \
    php5-curl \
    php5-gd \
    php5-xdebug \
    php5-apcu \
    nodejs-legacy

RUN echo "[global]\ndaemonize = no" > /etc/php5/fpm/pool.d/daemonize.conf
RUN echo "cgi.fix_pathinfo=0" >> /etc/php5/fpm/php.ini
RUN echo "error_log = /proc/self/fd/2" >> /etc/php5/fpm/php.ini
RUN echo "date.timezone = \"Europe/Paris\"" >> /etc/php5/fpm/php.ini
RUN echo "date.timezone = \"Europe/Paris\"" >> /etc/php5/cli/php.ini
RUN echo "listen = 9000" >> /etc/php5/fpm/pool.d/www.conf
RUN echo "access.log = /proc/self/fd/2" >> /etc/php5/fpm/pool.d/www.conf
RUN echo "xdebug.max_nesting_level=500" >> /etc/php5/fpm/conf.d/20-xdebug.ini

RUN php5enmod mcrypt

RUN php -r "readfile('https://getcomposer.org/installer');" | php
RUN mv composer.phar /usr/local/bin/composer

RUN wget --quiet https://phar.phpunit.de/phpunit.phar
RUN chmod +x phpunit.phar
RUN mv phpunit.phar /usr/local/bin/phpunit

RUN wget --quiet https://www.npmjs.org/install.sh && sh install.sh && rm install.sh

CMD ["/usr/sbin/php5-fpm"]

EXPOSE 9000
