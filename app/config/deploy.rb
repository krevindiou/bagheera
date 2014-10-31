set :domain,                        "192.168.1.5"
set :deploy_to,                     "/usr/share/nginx/www/bagheera"
set :repository,                    "git@bitbucket.org:krevindiou/bagheera.git"
set :scm,                           :git
set :user,                          "pi"
set :model_manager,                 "doctrine"
set :keep_releases,                 2
set :shared_files,                  [app_path + "/config/parameters.yml"]
set :shared_children,               [app_path + "/logs"]
set :deploy_via,                    :remote_cache
set :use_composer,                  true
set :copy_vendors,                  true
set :use_sudo,                      false
set :assets_symlinks,               true
set :dump_assetic_assets,           true
set :normalize_asset_timestamps,    false
set :permission_method,             :acl
set :use_set_permissions,           true
set :interactive_mode,              false

role :web,        domain
role :app,        domain, :primary => true

namespace :deploy do
    task :php_restart do
        run "#{sudo} sh -c '/etc/init.d/php5-fpm restart'"
    end
end

before "deploy", "deploy:php_restart"
