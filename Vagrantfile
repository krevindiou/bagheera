unless Vagrant.has_plugin?("vagrant-vbguest")
  raise "vagrant-vbguest is not installed (vagrant plugin install vagrant-vbguest)"
end

VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.ssh.forward_agent = true

  config.vm.box = "debian/jessie64"
  config.vm.hostname = "bagheera"
  config.vm.synced_folder ".", "/vagrant", disabled: true
  config.vm.synced_folder ".", "/srv/www/bagheera"
  config.vm.network "forwarded_port", guest: 80, host: 8080, auto_correct: true

  config.vm.provider "virtualbox" do |vb|
    vb.name = "bagheera"
  end

  config.vm.provision "ansible" do |ansible|
    ansible.playbook = "app/Resources/config/ansible/site.yml"
    ansible.ask_vault_pass = true
    ansible.extra_vars = {
      "vagrant" => "1",
      "env" => "dev"
    }
  end
end
