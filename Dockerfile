FROM debian:wheezy


RUN echo "Europe/Paris" > /etc/timezone

RUN apt-get -y update && apt-get -y install \
    sudo \
    locales \
    wget

RUN echo 'en_US.UTF-8 UTF-8' >> /etc/locale.gen && locale-gen

COPY . /srv/project
