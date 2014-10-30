<?php

use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Input\ArrayInput;

require_once __DIR__ . '/bootstrap.php.cache';
require_once __DIR__ . '/AppKernel.php';
require_once __DIR__ . '/AppCache.php';

$kernel = new AppKernel('test', true);

$application = new Application($kernel);
$application->setAutoExit(false);

function phpunit_run_console($application, $command, array $options = []) {
    $options['-e'] = 'test';
    $options['-q'] = null;
    $options['command'] = $command;

    $application->run(new ArrayInput($options));
}

phpunit_run_console($application, 'doctrine:schema:drop', ['--force' => null]);
phpunit_run_console($application, 'doctrine:schema:create');
phpunit_run_console($application, 'doctrine:schema:update', ['--force' => null]); // Still some SQL to execute
phpunit_run_console($application, 'doctrine:fixtures:load', ['--append' => null]);
