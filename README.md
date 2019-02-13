<p align="center">
    <img src="./assets/img/logo-dark.png" alt="Bagheera"/>
    <p align="center">A personal finance manager</p>
    <p align="center">
        <a href="https://travis-ci.org/krevindiou/bagheera"><img src="https://travis-ci.org/krevindiou/bagheera.svg?branch=master" alt="Build Status"/></a>
        <a href="https://codecov.io/gh/krevindiou/bagheera"><img src="https://codecov.io/gh/krevindiou/bagheera/branch/master/graph/badge.svg" alt="Code Coverage"/></a>
    </p>
</p>


## Install
- Install Docker and Docker Compose
- Copy `docker/.docker-compose.env.dist` to `docker/.docker-compose.env` and edit values
- Execute `./bin/docker-start <env>` (env=dev by default)
- Execute `./bin/docker-http` once docker-start is complete
