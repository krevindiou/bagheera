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

abstract class ControllerTestCase extends Zend_Test_PHPUnit_ControllerTestCase
{
    public $application;
    protected $_conn;

    public function setUp()
    {
        $this->application = new Zend_Application(
            APPLICATION_ENV,
            APPLICATION_PATH . '/configs/application.ini'
        );

        $config = new Zend_Config_Ini(__DIR__ . '/../application/configs/application.ini', APPLICATION_ENV);
        Zend_Registry::set('config', $config);

        $this->bootstrap = array($this, 'appBootstrap');

        parent::setUp();

        $this->createDatabase();
    }

    public function appBootstrap()
    {
        $this->application->bootstrap();
    }

    public function createDatabase()
    {
        $config = Zend_Registry::get('config');

        // MySQL schema export
        $connectionParams = array(
            'driver' => 'pdo_mysql',
            'dbname' => $config->database->dbname,
            'user' => $config->database->user,
            'password' => $config->database->password,
            'host' => $config->database->host,
        );

        try {
            $conn = Doctrine\DBAL\DriverManager::getConnection($connectionParams);
        } catch (Exception $e) {
            echo $e->getMessage() . "\n";
            exit;
        }

        $sm = $conn->getSchemaManager();
        try {
            $sqlite = new Doctrine\DBAL\Driver\PDOSqlite\Driver();

            $schema = $sm->createSchema();
            $sql = $schema->toSql($sqlite->getDatabasePlatform());
            $sql = implode(';', $sql);
        } catch (Exception $e) {
            echo $e->getMessage() . "\n";
            exit;
        }

        // SQLite schema import
        $connectionParams = array(
            'driver' => 'pdo_sqlite',
            'memory' => true,
        );
        $this->_conn = Doctrine\DBAL\DriverManager::getConnection($connectionParams);

        $sql = preg_replace('#(CREATE TABLE )([a-z0-9_]+) #i', '$1[$2] ', $sql);
        $sql = preg_replace('#( ON )([a-z0-9_]+) #i', '$1[$2] ', $sql);
        $this->_conn->executeUpdate($sql);
    }
}
