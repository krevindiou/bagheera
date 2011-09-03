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

require_once 'Zend/Test/PHPUnit/ControllerTestCase.php';
require_once 'Zend/Application.php';
require_once 'Spyc.php';

abstract class ControllerTestCase extends Zend_Test_PHPUnit_ControllerTestCase
{
    public $application;
    protected static $_em;

    public function setUp()
    {
        $this->application = new Zend_Application(
            APPLICATION_ENV,
            APPLICATION_PATH . '/configs/application.ini'
        );

        $this->bootstrap = array($this, 'appBootstrap');

        parent::setUp();

        self::$_em = createDatabase();
        self::$_em->clear();
        self::$_em->getConnection()->beginTransaction();
    }

    public function tearDown()
    {
        self::$_em->getConnection()->rollback();
    }

    public function appBootstrap()
    {
        $this->application->bootstrap();
    }
}

function createDatabase()
{
    static $emTest;

    if (null === $emTest) {
        $em = Zend_Registry::get('em');

        try {
            $sqlite = new Doctrine\DBAL\Driver\PDOSqlite\Driver();

            $sm = $em->getConnection()->getSchemaManager();
            $schema = $sm->createSchema();
            $sql = $schema->toSql($sqlite->getDatabasePlatform());
            $sql = implode(';', $sql);

            // SQL table name escaping
            $sql = preg_replace('#(CREATE TABLE )([a-z0-9_]+) #i', '$1[$2] ', $sql);
            $sql = preg_replace('#( ON )([a-z0-9_]+) #i', '$1[$2] ', $sql);
        } catch (Exception $e) {
            echo $e->getMessage() . "\n";
            exit;
        }

        $doctrineConfig = new \Doctrine\ORM\Configuration;

        if (extension_loaded('apc')) {
            $doctrineCache = new \Doctrine\Common\Cache\ApcCache;
        } else {
            $doctrineCache = new \Doctrine\Common\Cache\ArrayCache;
        }

        $doctrineConfig->setMetadataCacheImpl($doctrineCache);
        $doctrineConfig->setQueryCacheImpl($doctrineCache);

        $driverImpl = $doctrineConfig->newDefaultAnnotationDriver(__DIR__ . '/../application/models');
        $doctrineConfig->setMetadataDriverImpl($driverImpl);

        // Proxy configuration
        $doctrineConfig->setProxyDir(__DIR__ . '/../application/proxies');
        $doctrineConfig->setProxyNamespace('Application\\Proxies');
        $doctrineConfig->setAutoGenerateProxyClasses(true);

        // Database connection information
        $connectionParams = array(
            'driver' => 'pdo_sqlite',
            'memory' => true,
        );
        $emTest = \Doctrine\ORM\EntityManager::create($connectionParams, $doctrineConfig);

        $emTest->getConnection()->executeUpdate($sql);

        // Data import
        $array = Spyc::YAMLLoad(__DIR__ . '/fixtures.yaml');
        foreach ($array as $table => $v) {
            foreach ($v as $data) {
                $emTest->getConnection()->insert($table, $data);
            }
        }
    }

    Zend_Registry::set('em', $emTest);

    return $emTest;
}
