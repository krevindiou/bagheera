FROM bagheera_base


RUN apt-get -y update && apt-get -y install nginx

RUN echo "\ndaemon off;" >> /etc/nginx/nginx.conf
RUN sed -i 's/# gzip_types/gzip_types/' /etc/nginx/nginx.conf
RUN ln -sf /dev/stdout /var/log/nginx/access.log
RUN ln -sf /dev/stderr /var/log/nginx/error.log

COPY bagheera.conf /etc/nginx/sites-available/default

CMD ["/usr/sbin/nginx"]

EXPOSE 80 443
