FROM bagheera_base


RUN apt-get -y update \
    && apt-get -y install nginx \
    && rm -rf /var/lib/apt/lists/*

RUN echo "\ndaemon off;" >> /etc/nginx/nginx.conf
RUN sed -i 's/# \(gzip_types.*\)/\1/' /etc/nginx/nginx.conf
RUN sed -i 's/# \(server_tokens off;\)/\1/' /etc/nginx/nginx.conf
RUN ln -sf /dev/stdout /var/log/nginx/access.log
RUN ln -sf /dev/stderr /var/log/nginx/error.log

COPY docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["/usr/sbin/nginx"]

WORKDIR /srv/www/bagheera

EXPOSE 80 443
