# Bagheera, a personal finance manager

## Local install
- Install Docker and Docker Compose
- Copy `.docker-compose.env.dist` to `.docker-compose.env` and edit values.
- Launch `./bin/start <env>`, <env> could be "dev" or "prod".

## Remote install from scratch
- Install Ansible
- Edit Ansible config (`/etc/ansible/hosts`)
- Launch `ansible-playbook playbook.yml --ask-vault-pass`
