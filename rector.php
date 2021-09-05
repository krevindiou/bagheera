<?php

declare(strict_types=1);

use Rector\Core\Configuration\Option;
use Rector\Doctrine\Set\DoctrineSetList;
use Rector\Php74\Rector\Property\TypedPropertyRector;
use Rector\Symfony\Set\SymfonySetList;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;

return static function (ContainerConfigurator $containerConfigurator): void {
    $containerConfigurator->import(SymfonySetList::SYMFONY_52);
    $containerConfigurator->import(DoctrineSetList::DOCTRINE_ORM_29);
    $services = $containerConfigurator->services();
    $services->set(TypedPropertyRector::class);

    $parameters = $containerConfigurator->parameters();
    $parameters->set(
        Option::SYMFONY_CONTAINER_XML_PATH_PARAMETER,
        __DIR__.'/var/cache/dev/App_KernelDevDebugContainer.xml'
    );
    $parameters->set(Option::PATHS, [__DIR__.'/src']);
    $parameters->set(Option::AUTO_IMPORT_NAMES, true);
    $parameters->set(Option::IMPORT_SHORT_CLASSES, false);
};
