<?php

class Bootstrap extends Zend_Application_Bootstrap_Bootstrap
{
    protected function _initAutoload()
    {
        require __DIR__ . '/../library/Doctrine/Common/ClassLoader.php';

        $autoloader = Zend_Loader_Autoloader::getInstance();

        $doctrineAutoloader = array(
            new \Doctrine\Common\ClassLoader('Symfony'),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Symfony\\');

        $doctrineAutoloader = array(
            new \Doctrine\Common\ClassLoader('Doctrine'),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Doctrine\\');

        $doctrineAutoloader = array(
            new \Doctrine\Common\ClassLoader('DoctrineExtensions'),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'DoctrineExtensions\\');

        $doctrineAutoloader = array(
            new \Doctrine\Common\ClassLoader('Application\\Models', realpath(__DIR__ . '/..')),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Application\\Models\\');

        $doctrineAutoloader = array(
            new \Doctrine\Common\ClassLoader('Application\\Proxies', realpath(__DIR__ . '/..')),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Application\\Proxies');

        return $autoloader;
    }

    protected function _initConfig()
    {
        $config = new Zend_Config_Ini(__DIR__ . '/configs/application.ini', APPLICATION_ENV);

        $registry = Zend_Registry::getInstance();
        $registry->set('config', $config);

        return $config;
    }

    protected function _initDoctrine()
    {
        $config = new \Doctrine\ORM\Configuration;

        // Set up caches
        $cache = new \Doctrine\Common\Cache\ArrayCache;
        $config->setMetadataCacheImpl($cache);
        $config->setQueryCacheImpl($cache);

        $driverImpl = $config->newDefaultAnnotationDriver(__DIR__ . '/models');
        $config->setMetadataDriverImpl($driverImpl);

        // Proxy configuration
        $config->setProxyDir(__DIR__ . '/proxies');
        $config->setProxyNamespace('Application\\Proxies');
        $config->setAutoGenerateProxyClasses(true);

        // Database connection information
        $registry = Zend_Registry::getInstance();
        $appConfig = $registry->config;

        $connectionOptions = array(
            'driver' => 'pdo_mysql',
            'dbname' => $appConfig->database->dbname,
            'user' => $appConfig->database->user,
            'password' => $appConfig->database->password,
            'host' => $appConfig->database->host,
        );

        // Create EntityManager
        $em = \Doctrine\ORM\EntityManager::create($connectionOptions, $config);
        Zend_Registry::set('em', $em);
    }
}
