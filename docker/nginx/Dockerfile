FROM nginx:1

COPY docker/nginx/bagheera.* /etc/nginx/
RUN echo 'server_tokens off;' > /etc/nginx/conf.d/server_tokens.conf
RUN echo 'gzip on;\n\
gzip_types text/plain text/css application/json application/x-javascript text/xml application/xml application/xml+rss text/javascript;\
' > /etc/nginx/conf.d/gzip.conf

COPY docker/nginx/docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["nginx", "-g", "daemon off;"]
