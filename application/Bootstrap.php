<?php
/**
 * This file is part of the Bagheera project, a personal finance manager.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

class Bootstrap extends Zend_Application_Bootstrap_Bootstrap
{
    protected function _initAutoload()
    {
        require_once __DIR__ . '/../library/Doctrine/Common/ClassLoader.php';

        $autoloader = Zend_Loader_Autoloader::getInstance();
        $autoloader->setAutoloaders(array());
        $autoloader->registerNamespace('Bagheera');

        $doctrineAutoloader = array(
            new \Bagheera\ClassLoader('Doctrine'),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Doctrine\\');

        $doctrineAutoloader = array(
            new \Bagheera\ClassLoader('DoctrineExtensions'),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'DoctrineExtensions\\');

        $doctrineAutoloader = array(
            new \Bagheera\ClassLoader('Application\\Models', realpath(__DIR__ . '/..')),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Application\\Models\\');

        $doctrineAutoloader = array(
            new \Bagheera\ClassLoader('Application\\Models\\Repositories', realpath(__DIR__ . '/..')),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Application\\Models\\Repositories\\');

        $doctrineAutoloader = array(
            new \Bagheera\ClassLoader('Application\\Proxies', realpath(__DIR__ . '/..')),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Application\\Proxies');

        $doctrineAutoloader = array(
            new \Bagheera\ClassLoader('Application\\Services', realpath(__DIR__ . '/..')),
            'loadClass'
        );
        $autoloader->pushAutoloader($doctrineAutoloader, 'Application\\Services\\');

        $doctrineAutoloader = array(
            new \Bagheera\ClassLoader('Application\\Forms', realpath(__DIR__ . '/..')),
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
            if (extension_loaded('apc')) {
                $doctrineCache = new \Doctrine\Common\Cache\ApcCache;
            } else {
                $doctrineCache = new \Doctrine\Common\Cache\ArrayCache;
            }

            $doctrineConfig->setMetadataCacheImpl($doctrineCache);
            $doctrineConfig->setQueryCacheImpl($doctrineCache);
        }

        $driverImpl = $doctrineConfig->newDefaultAnnotationDriver(__DIR__ . '/models');
        $doctrineConfig->setMetadataDriverImpl($driverImpl);

        // Proxy configuration
        $doctrineConfig->setProxyDir(__DIR__ . '/proxies');
        $doctrineConfig->setProxyNamespace('Application\\Proxies');
        $doctrineConfig->setAutoGenerateProxyClasses(true);

        // Database connection information
        $connectionParams = array(
            'driver' => 'pdo_mysql',
            'dbname' => $config->database->dbname,
            'user' => $config->database->user,
            'password' => $config->database->password,
            'host' => $config->database->host,
        );

        // Create EntityManager
        $em = \Doctrine\ORM\EntityManager::create($connectionParams, $doctrineConfig);
        $em->getEventManager()->addEventSubscriber(
            new \Doctrine\DBAL\Event\Listeners\MysqlSessionInit('utf8')
        );

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

            if (extension_loaded('apc')) {
                $cache = Zend_Cache::factory('Core', 'Apc', $frontendOptions);
            } else {
                $cache = Zend_Cache::factory(
                    'Core',
                    'File',
                    $frontendOptions,
                    array('cache_dir' => realpath(__DIR__ . '/../tmp'))
                );
            }
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
            'rel' => 'stylesheet',
            'href' => $config->resources->frontController->baseUrl . '/css/turbine/css.php?files=main.cssp',
            'type' => 'text/css'
        ));

        $view->addHelperPath(__DIR__ . '/views/helpers', 'Application_View_Helper');

        $view->applicationEnv = APPLICATION_ENV;
        $view->baseUrl = $config->resources->frontController->baseUrl;

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

        if ('' != $config->mail->host) {
            $mailTransportSmtp = new Zend_Mail_Transport_Smtp(
                $config->mail->host,
                $config->mail->toArray()
            );
        } else {
            $mailTransportSmtp = new Bagheera_Mail_Transport_Array();
        }

        Zend_Mail::setDefaultTransport($mailTransportSmtp);
    }

    protected function _initPaginator()
    {
        Zend_Paginator::setConfig(new Zend_Config(
            array(
                'itemcountperpage' => 20,
                'pagerange' => 9
            )
        ));

        Zend_View_Helper_PaginationControl::setDefaultViewPartial('paginator.phtml');
    }

    protected function _initPlugin()
    {
        $frontController = Zend_Controller_Front::getInstance();
        $frontController->registerPlugin(new Bagheera_Controller_Plugin_Auth());
    }
}
