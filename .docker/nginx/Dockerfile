FROM nginx:1 AS base
RUN echo 'server_tokens off;' > /etc/nginx/conf.d/server_tokens.conf
RUN echo 'gzip on;\n\
gzip_types text/plain text/css application/json application/x-javascript text/xml application/xml application/xml+rss text/javascript;\
' > /etc/nginx/conf.d/gzip.conf
RUN rm -f /etc/nginx/conf.d/default.conf
WORKDIR /srv/www/bagheera
CMD ["nginx", "-g", "daemon off;"]

FROM base AS dev
COPY .docker/nginx/bagheera.dev.conf /etc/nginx/conf.d/default.conf

FROM base AS prod
COPY .docker/nginx/bagheera.prod.conf /etc/nginx/conf.d/default.conf
