<p align="center">
    <img src="./assets/img/logo-dark.png" alt="Bagheera"/>
    <p align="center">A personal finance manager</p>
    <p align="center">
        <a href="https://travis-ci.com/krevindiou/bagheera"><img src="https://travis-ci.com/krevindiou/bagheera.svg?branch=master" alt="Build Status"/></a>
        <a href="https://codecov.io/gh/krevindiou/bagheera"><img src="https://codecov.io/gh/krevindiou/bagheera/branch/master/graph/badge.svg" alt="Code Coverage"/></a>
        <a href="https://insight.symfony.com/projects/16f13cc4-0bf7-41a3-a764-47cfef31af40"><img src="https://insight.symfony.com/projects/16f13cc4-0bf7-41a3-a764-47cfef31af40/mini.svg" alt="Insight"/></a>
    </p>
</p>

![screenshot-dashboard](./assets/img/screenshot-dashboard.png)

## Install on a local computer
- Copy `.docker/.docker-compose.env.dist` to `.docker/.docker-compose.env` and edit values
- Execute `APP_ENV=<env> make docker-start` (APP_ENV=dev by default)

## Install on a server
- Install Ansible
- Copy `.ansible/host_vars/example.yml` to `.ansible/host_vars/<your-server-host>.yml` and update values accordingly
- Run provisioning `ansible-playbook .ansible/provision.yml -i <your-server-host>,`
- Run deployment `ansible-playbook .ansible/deploy.yml -i <your-server-host>,`
