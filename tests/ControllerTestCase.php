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
    protected static $_conn;

    public function setUp()
    {
        $this->application = new Zend_Application(
            APPLICATION_ENV,
            APPLICATION_PATH . '/configs/application.ini'
        );

        $this->bootstrap = array($this, 'appBootstrap');

        parent::setUp();

        self::$_conn = createDatabase();
        self::$_conn->beginTransaction();
    }

    public function tearDown()
    {
        self::$_conn->rollback();
    }

    public function appBootstrap()
    {
        $this->application->bootstrap();
    }
}

function createDatabase()
{
    static $sqliteConn;

    if (null === $sqliteConn) {
        $em = Zend_Registry::get('em');
        $mysqlConn = $em->getConnection();

        $sm = $mysqlConn->getSchemaManager();
        try {
            $sqlite = new Doctrine\DBAL\Driver\PDOSqlite\Driver();

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

        // SQLite schema import
        $connectionParams = array(
            'driver' => 'pdo_sqlite',
            'memory' => true,
        );

        $sqliteConn = Doctrine\DBAL\DriverManager::getConnection($connectionParams);

        $sqliteConn->executeUpdate($sql);

        // Data import
        $array = Spyc::YAMLLoad(__DIR__ . '/fixtures.yaml');
        foreach ($array as $table => $v) {
            foreach ($v as $data) {
                $sqliteConn->insert($table, $data);
            }
        }
    }

    $doctrineConfig = new Doctrine\ORM\Configuration;
    $driverImpl = $doctrineConfig->newDefaultAnnotationDriver(realpath(__DIR__ . '/../application/models'));
    $doctrineConfig->setMetadataDriverImpl($driverImpl);

    $doctrineConfig->setProxyDir(realpath(__DIR__ . '/../application/proxies'));
    $doctrineConfig->setProxyNamespace('Application\\Proxies');
    $doctrineConfig->setAutoGenerateProxyClasses(true);

    $em = Doctrine\ORM\EntityManager::create($sqliteConn, $doctrineConfig);
    Zend_Registry::set('em', $em);

    return $sqliteConn;
}
