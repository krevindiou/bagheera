<p align="center">
    <img src="./assets/img/logo-dark.png" alt="Bagheera"/>
    <p align="center">A personal finance manager</p>
    <p align="center">
        <a href="https://travis-ci.com/krevindiou/bagheera"><img src="https://travis-ci.com/krevindiou/bagheera.svg?branch=master" alt="Build Status"/></a>
        <a href="https://codecov.io/gh/krevindiou/bagheera"><img src="https://codecov.io/gh/krevindiou/bagheera/branch/master/graph/badge.svg" alt="Code Coverage"/></a>
    </p>
</p>

![screenshot-dashboard](./assets/img/screenshot-dashboard.png)

## Install on a local computer
- Copy `.docker/.docker-compose.env.dist` to `.docker/.docker-compose.env` and edit values
- Execute `make docker-start ENV=<env>` (ENV=dev by default)

## Install on a server
- Install Ansible
- Run provisioning `ansible-playbook .ansible/provision.yml`
- Copy `.docker/.docker-compose.env.dist` to `.docker/.docker-compose.env` and edit values
- Execute `make docker-start ENV=<env>` (ENV=dev by default)
