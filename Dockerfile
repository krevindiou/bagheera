FROM ubuntu:14.04


RUN locale-gen en_US en_US.UTF-8
RUN echo "Europe/Paris" > /etc/timezone
RUN dpkg-reconfigure -f noninteractive tzdata

RUN apt-get -y update
RUN apt-get -y install \
  build-essential \
  git \
  vim \
  htop \
  curl \
  acl \
  npm \
  nodejs-legacy \
  php5-cli \
  php5-fpm \
  php5-mcrypt \
  php5-intl \
  php5-pgsql \
  php5-curl \
  php5-gd \
  php5-xdebug \
  php-apc \
  phpunit \
  postgresql-9.3 \
  postgresql-contrib-9.3 \
  nginx \
  openssh-server \
  supervisor

ENV PROJECT_NAME        bagheera
ENV PROJECT_DB_USER     username
ENV PROJECT_DB_PASSWORD password
ENV PROJECT_DB_NAME     $PROJECT_NAME

ADD . /srv/project

WORKDIR /srv/project

# Supervisor
ADD app/Resources/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# OpenSSH
RUN echo "root:$(cat /dev/urandom | tr -cd 'a-f0-9' | head -c 12)"|chpasswd
RUN sed -i 's/UsePAM yes/#UsePAM yes/g' /etc/ssh/sshd_config
RUN sed -i 's/#UsePAM no/UsePAM no/g' /etc/ssh/sshd_config
RUN echo 'UseDNS no' >> /etc/ssh/sshd_config
RUN mkdir /root/.ssh && cat app/Resources/ssh/id_rsa.pub > /root/.ssh/authorized_keys
RUN mkdir -p /var/run/sshd

# PHP
RUN echo "[global]\ndaemonize = no" > /etc/php5/fpm/pool.d/daemonize.conf
RUN echo 'cgi.fix_pathinfo=0;' >> /etc/php5/fpm/php.ini
RUN echo 'apc.enable_cli = 0' > /etc/php5/cli/conf.d/enable-apc-cli.ini
RUN sed -i 's/;date.timezone =/date.timezone = "Europe\/Paris"/' /etc/php5/cli/php.ini
RUN sed -i 's/;date.timezone =/date.timezone = "Europe\/Paris"/' /etc/php5/fpm/php.ini
RUN php5enmod mcrypt
RUN curl -sS https://getcomposer.org/installer | php
RUN mv composer.phar /usr/local/bin/composer

# PostgreSQL
RUN echo "listen_addresses='*'" >> /etc/postgresql/9.3/main/postgresql.conf
RUN echo 'host all  all    0.0.0.0/0  md5' >> /etc/postgresql/9.3/main/pg_hba.conf
RUN echo "127.0.0.1:5432:${PROJECT_DB_NAME}:${PROJECT_DB_USER}:${PROJECT_DB_PASSWORD}" > /root/.pgpass
RUN echo "127.0.0.1:5432:${PROJECT_DB_NAME}_test:${PROJECT_DB_USER}:${PROJECT_DB_PASSWORD}" >> /root/.pgpass
RUN chmod 0600 /root/.pgpass
RUN service postgresql start &&\
    sudo -i -u postgres psql -c "CREATE USER $PROJECT_DB_USER WITH LOGIN PASSWORD '$PROJECT_DB_PASSWORD';" &&\
    sudo -i -u postgres createdb -O $PROJECT_DB_USER $PROJECT_DB_NAME &&\
    sudo -i -u postgres createdb -O $PROJECT_DB_USER ${PROJECT_DB_NAME}_test &&\
    sudo -i -u postgres psql -c "ALTER SCHEMA public OWNER TO $PROJECT_DB_USER;" ${PROJECT_DB_NAME} &&\
    sudo -i -u postgres psql -c "ALTER SCHEMA public OWNER TO $PROJECT_DB_USER;" ${PROJECT_DB_NAME}_test &&\
    sudo -i -u postgres psql $PROJECT_DB_NAME -c "CREATE EXTENSION \"uuid-ossp\";" &&\
    sudo -i -u postgres psql ${PROJECT_DB_NAME}_test -c "CREATE EXTENSION \"uuid-ossp\";" &&\
    psql -h 127.0.0.1 -d $PROJECT_DB_NAME -U $PROJECT_DB_USER < app/Resources/db/structure.sql

# Nginx
RUN echo "\ndaemon off;" >> /etc/nginx/nginx.conf
ADD app/Resources/vhost.nginx /etc/nginx/sites-available/default

CMD ["/usr/bin/supervisord"]

EXPOSE 22 80 5432
