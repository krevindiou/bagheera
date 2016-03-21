# Bagheera, a personal finance manager
## Local install (dev)
- Install VirtualBox
- Install Vagrant
- Install Ansible
- Clone project repository (get read/write access to repository)
- cd to project directory, then execute `vagrant up`

## Remote server install (prod)
### On remote server
- Install Debian jessie
- Configure network
- Add your SSH public key into remote server /root/.ssh/authorized_keys

### On local computer
- Install Ansible
- Add ansible SSH public key into BitBucket deployment keys
- Execute `ANSIBLE_SSH_ARGS='-o ForwardAgent=yes' env=prod ansible-playbook --inventory-file='<host>,' --ask-vault-pass app/Resources/config/ansible/site.yml --user=root`
