<?php

$doctrineConfig = new \Doctrine\ORM\Configuration;
$doctrineConfig->setMetadataCacheImpl(new \Doctrine\Common\Cache\ArrayCache);
$driverImpl = $doctrineConfig->newDefaultAnnotationDriver(__DIR__ . '/../application/models');
$doctrineConfig->setMetadataDriverImpl($driverImpl);
$doctrineConfig->setProxyDir(__DIR__ . '/../application/proxies');
$doctrineConfig->setProxyNamespace('Application\\Proxies');

$connectionParams = array(
    'driver' => 'pdo_sqlite',
    'memory' => true,
);

$em = \Doctrine\ORM\EntityManager::create($connectionParams, $doctrineConfig);

$helperSet = new \Symfony\Component\Console\Helper\HelperSet(array(
    'em' => new \Doctrine\ORM\Tools\Console\Helper\EntityManagerHelper($em)
));
