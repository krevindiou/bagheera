<?php

class Bootstrap extends Zend_Application_Bootstrap_Bootstrap
{
    protected function _initAutoload()
    {
        require __DIR__ . '/../library/Doctrine/Common/ClassLoader.php';

        $autoloader = Zend_Loader_Autoloader::getInstance();
        $autoloader->setAutoloaders(array());
        $autoloader->registerNamespace('Bagheera');

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

        $doctrineAutoloader = array(
            new \Doctrine\Common\ClassLoader('Application\\Services', realpath(__DIR__ . '/..')),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Application\\Services\\');

        $doctrineAutoloader = array(
            new \Doctrine\Common\ClassLoader('Application\\Forms', realpath(__DIR__ . '/..')),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Application\\Forms\\');

        return $autoloader;
    }

    protected function _initConfig()
    {
        $config = new Zend_Config_Ini(__DIR__ . '/configs/application.ini', APPLICATION_ENV);
        Zend_Registry::set('config', $config);

        return $config;
    }

    protected function _initDoctrine()
    {
        $config = Zend_Registry::get('config');

        $doctrineConfig = new \Doctrine\ORM\Configuration;

        // Set up caches
        if (1 == $config->cache) {
            $doctrineCache = new \Doctrine\Common\Cache\ApcCache;
            $doctrineConfig->setMetadataCacheImpl($doctrineCache);
            $doctrineConfig->setQueryCacheImpl($doctrineCache);
        }

        $driverImpl = $doctrineConfig->newDefaultAnnotationDriver(__DIR__ . '/models');
        $doctrineConfig->setMetadataDriverImpl($driverImpl);

        // Proxy configuration
        $doctrineConfig->setProxyDir(__DIR__ . '/proxies');
        $doctrineConfig->setProxyNamespace('Application\\Proxies');
        $doctrineConfig->setAutoGenerateProxyClasses(!(bool)$config->cache);

        // Database connection information
        $connectionOptions = array(
            'driver' => 'pdo_mysql',
            'dbname' => $config->database->dbname,
            'user' => $config->database->user,
            'password' => $config->database->password,
            'host' => $config->database->host,
        );

        // Create EntityManager
        $em = \Doctrine\ORM\EntityManager::create($connectionOptions, $doctrineConfig);
        Zend_Registry::set('em', $em);
    }

    protected function _initCache()
    {
        $config = Zend_Registry::get('config');

        if (1 == $config->cache) {
            $frontendOptions = array(
                'lifetime' => 7200,
                'automatic_serialization' => true
            );

            $cache = Zend_Cache::factory('Core', 'Apc', $frontendOptions);
        } else {
            $cache = null;
        }

        Zend_Registry::set('cache', $cache);

        return $cache;
    }

    protected function _initLocale()
    {
        $locale = new Zend_Locale('en_US');
        Zend_Registry::set('Zend_Locale', $locale);

        return $locale;
    }

    protected function _initTranslate()
    {
        $cache = Zend_Registry::get('cache');
        if (null !== $cache) {
            Zend_Translate::setCache($cache);
        }

        $translate = new Zend_Translate('csv', __DIR__ . '/languages/en_US.csv', 'en_US');
        Zend_Registry::set('Zend_Translate', $translate);

        Zend_Form::setDefaultTranslator($translate);
        Zend_Validate_Abstract::setDefaultTranslator($translate);

        return $translate;
    }

    protected function _initView()
    {
        $config = Zend_Registry::get('config');

        $view = new Zend_View();
        $view->setEncoding('utf-8');
        $view->doctype('XHTML1_STRICT');
        $view->headTitle('Bagheera');
        $view->headMeta()->appendHttpEquiv('Content-Type', 'text/html; charset=utf-8')
                         ->appendHttpEquiv('Content-Language', 'en-US');
        $view->headLink()->headLink(array(
            'rel' => 'stylesheet/less',
            'href' => $config->resources->frontController->baseUrl . '/css/base.less',
            'type' => 'text/css'
        ));
        $view->headLink()->headLink(array(
            'rel' => 'stylesheet/less',
            'href' => $config->resources->frontController->baseUrl . '/css/main.less',
            'type' => 'text/css'
        ));
        $view->headScript()->appendFile($config->resources->frontController->baseUrl . '/js/less-1.0.35.min.js');

        $view->applicationEnv = APPLICATION_ENV;

        $flashMessenger = Zend_Controller_Action_HelperBroker::getStaticHelper('flashMessenger');
        $view->messages = $flashMessenger->getMessages();

        $viewRenderer = Zend_Controller_Action_HelperBroker::getStaticHelper('viewRenderer');
        $viewRenderer->setView($view);

        return $view;
    }

    protected function _initRouter()
    {
        $front = $this->bootstrap('FrontController')->getResource('FrontController');
        $router = $front->getRouter();
        $config = new Zend_Config_Ini(__DIR__ . '/configs/routes.ini');
        $router = new Zend_Controller_Router_Rewrite();
        $router->addConfig($config, 'routes');
        $front->setRouter($router);

        return $router;
    }

    protected function _initMail()
    {
        $config = Zend_Registry::get('config');

        $mailTransportSmtp = new Zend_Mail_Transport_Smtp(
            $config->mail->host,
            $config->mail->toArray()
        );
        Zend_Mail::setDefaultTransport($mailTransportSmtp);
    }
}
