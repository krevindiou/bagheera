<?php

declare(strict_types=1);

$finder = PhpCsFixer\Finder::create()
    ->name('.php_cs.dist')
    ->ignoreDotFiles(false)
    ->exclude('node_modules')
    ->exclude('var')
    ->exclude('.phpunit')
    ->in(__DIR__)
;

$config = new PhpCsFixer\Config();
$config
    ->setRiskyAllowed(true)
    ->setRules([
        '@PhpCsFixer' => true,
        '@PhpCsFixer:risky' => true,
        '@PHP80Migration' => true,
        '@PHP80Migration:risky' => true,
        '@PHPUnit84Migration:risky' => true,
        'backtick_to_shell_exec' => true,
        'blank_line_before_statement' => true,
        'heredoc_indentation' => true,
        'linebreak_after_opening_tag' => true,
        'native_function_invocation' => false,
        'no_php4_constructor' => true,
        'phpdoc_add_missing_param_annotation' => false,
    ])
    ->setFinder($finder)
;

return $config;
