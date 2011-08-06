-- MySQL dump 10.13  Distrib 5.1.36, for Win32 (ia32)
--
-- Host: localhost    Database: bagheera
-- ------------------------------------------------------
-- Server version	5.1.36-community-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `account`
--

DROP TABLE IF EXISTS `account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `account` (
  `account_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `bank_id` int(10) unsigned NOT NULL,
  `name` varchar(32) NOT NULL,
  `initial_balance` decimal(10,2) NOT NULL,
  `overdraft_facility` decimal(10,2) NOT NULL,
  `details` varchar(64) NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`account_id`),
  KEY `fk_account_bank` (`bank_id`),
  CONSTRAINT `fk_account_bank` FOREIGN KEY (`bank_id`) REFERENCES `bank` (`bank_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bank`
--

DROP TABLE IF EXISTS `bank`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bank` (
  `bank_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `name` varchar(32) NOT NULL,
  `info` text NOT NULL,
  `contact` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`bank_id`),
  KEY `fk_bank_user` (`user_id`),
  CONSTRAINT `fk_bank_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `category`
--

DROP TABLE IF EXISTS `category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `category` (
  `category_id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `parent_category_id` smallint(5) unsigned DEFAULT NULL,
  `name` varchar(32) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`category_id`),
  KEY `fk_category_category` (`parent_category_id`),
  CONSTRAINT `fk_category_category` FOREIGN KEY (`parent_category_id`) REFERENCES `category` (`category_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment_method`
--

DROP TABLE IF EXISTS `payment_method`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payment_method` (
  `payment_method_id` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(16) NOT NULL DEFAULT 'creditCard',
  `type` varchar(8) NOT NULL DEFAULT 'debit',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`payment_method_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_method`
--

LOCK TABLES `payment_method` WRITE;
/*!40000 ALTER TABLE `payment_method` DISABLE KEYS */;
INSERT INTO `payment_method` VALUES (1,'creditCard','debit',NOW(),NOW()),(2,'check','debit',NOW(),NOW()),(3,'withdrawal','debit',NOW(),NOW()),(4,'transfer','debit',NOW(),NOW()),(5,'check','credit',NOW(),NOW()),(6,'transfer','credit',NOW(),NOW()),(7,'deposit','credit',NOW(),NOW());
/*!40000 ALTER TABLE `payment_method` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report`
--

DROP TABLE IF EXISTS `report`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report` (
  `report_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `type` varchar(16) NOT NULL DEFAULT 'sum',
  `title` varchar(255) NOT NULL,
  `display_on_homepage` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`report_id`),
  KEY `fk_report_user` (`user_id`),
  CONSTRAINT `fk_report_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_account`
--

DROP TABLE IF EXISTS `report_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_account` (
  `report_id` int(10) unsigned NOT NULL,
  `account_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`report_id`),
  KEY `fk_report_account_account` (`account_id`),
  CONSTRAINT `fk_report_account_account` FOREIGN KEY (`account_id`) REFERENCES `account` (`account_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_report_account_report_common` FOREIGN KEY (`report_id`) REFERENCES `report_common` (`report_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_average`
--

DROP TABLE IF EXISTS `report_average`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_average` (
  `report_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `display` varchar(16) NOT NULL,
  PRIMARY KEY (`report_id`),
  CONSTRAINT `fk_report_average_report_common` FOREIGN KEY (`report_id`) REFERENCES `report_common` (`report_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_category`
--

DROP TABLE IF EXISTS `report_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_category` (
  `report_id` int(10) unsigned NOT NULL,
  `category_id` smallint(5) unsigned NOT NULL,
  PRIMARY KEY (`report_id`),
  KEY `fk_report_category_category` (`category_id`),
  CONSTRAINT `fk_report_category_category` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_report_category_report_common` FOREIGN KEY (`report_id`) REFERENCES `report_common` (`report_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_common`
--

DROP TABLE IF EXISTS `report_common`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_common` (
  `report_id` int(10) unsigned NOT NULL,
  `value_date_start` date DEFAULT NULL,
  `value_date_end` date DEFAULT NULL,
  `reconciled_only` tinyint(1) NOT NULL,
  PRIMARY KEY (`report_id`),
  CONSTRAINT `fk_report_common_report` FOREIGN KEY (`report_id`) REFERENCES `report` (`report_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_distribution`
--

DROP TABLE IF EXISTS `report_distribution`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_distribution` (
  `report_id` int(10) unsigned NOT NULL,
  `display` varchar(16) NOT NULL,
  `significant_transaction_nb` smallint(6) NOT NULL DEFAULT '0',
  PRIMARY KEY (`report_id`),
  CONSTRAINT `fk_report_distribution_report_common` FOREIGN KEY (`report_id`) REFERENCES `report_common` (`report_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_estimate`
--

DROP TABLE IF EXISTS `report_estimate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_estimate` (
  `report_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `month_expenses` decimal(10,2) NOT NULL,
  `month_incomes` decimal(10,2) NOT NULL,
  `duration_scale_unit` varchar(8) NOT NULL DEFAULT 'month',
  `duration_scale_value` tinyint(3) NOT NULL,
  PRIMARY KEY (`report_id`),
  CONSTRAINT `fk_report_estimate_report` FOREIGN KEY (`report_id`) REFERENCES `report` (`report_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_payment_method`
--

DROP TABLE IF EXISTS `report_payment_method`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_payment_method` (
  `report_id` int(10) unsigned NOT NULL,
  `payment_method_id` tinyint(3) unsigned NOT NULL,
  PRIMARY KEY (`report_id`),
  KEY `fk_report_payment_method_payment_method` (`payment_method_id`),
  CONSTRAINT `fk_report_payment_method_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method` (`payment_method_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_report_payment_method_report_common` FOREIGN KEY (`report_id`) REFERENCES `report_common` (`report_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_sum`
--

DROP TABLE IF EXISTS `report_sum`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_sum` (
  `report_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `display` varchar(8) NOT NULL,
  PRIMARY KEY (`report_id`),
  CONSTRAINT `fk_report_sum_report_common` FOREIGN KEY (`report_id`) REFERENCES `report_common` (`report_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `report_third_party`
--

DROP TABLE IF EXISTS `report_third_party`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_third_party` (
  `report_id` int(10) unsigned NOT NULL,
  `third_party` varchar(64) NOT NULL,
  PRIMARY KEY (`report_id`),
  CONSTRAINT `fk_report_third_party_report_common` FOREIGN KEY (`report_id`) REFERENCES `report_common` (`report_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scheduler`
--

DROP TABLE IF EXISTS `scheduler`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `scheduler` (
  `scheduler_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `account_id` int(10) unsigned NOT NULL,
  `transfer_account_id` int(10) unsigned DEFAULT NULL,
  `category_id` smallint(5) unsigned NOT NULL,
  `third_party` varchar(64) NOT NULL,
  `payment_method_id` tinyint(3) unsigned NOT NULL,
  `debit` decimal(10,2) unsigned DEFAULT NULL,
  `credit` decimal(10,2) unsigned DEFAULT NULL,
  `value_date` date NOT NULL,
  `limit_date` date DEFAULT NULL,
  `is_reconciled` tinyint(1) unsigned NOT NULL,
  `notes` text NOT NULL,
  `frequency_unit` varchar(16) NOT NULL DEFAULT 'month',
  `frequency_value` tinyint(3) unsigned NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`scheduler_id`),
  KEY `category_id` (`category_id`),
  KEY `fk_scheduler_payment_method` (`payment_method_id`),
  KEY `fk_scheduler_account` (`account_id`),
  CONSTRAINT `fk_scheduler_account` FOREIGN KEY (`account_id`) REFERENCES `account` (`account_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_scheduler_category` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_scheduler_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method` (`payment_method_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transaction_search`
--

DROP TABLE IF EXISTS `transaction_search`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transaction_search` (
  `transaction_search_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `account_id` int(10) unsigned NOT NULL,
  `third_party` varchar(64) NOT NULL,
  `value_date_start` date DEFAULT NULL,
  `value_date_end` date DEFAULT NULL,
  `is_reconciled` tinyint(1) DEFAULT NULL,
  `type` varchar(8) DEFAULT NULL,
  `amount_inferior_to` decimal(10,2) DEFAULT NULL,
  `amount_inferior_or_equal_to` decimal(10,2) DEFAULT NULL,
  `amount_equal_to` decimal(10,2) DEFAULT NULL,
  `amount_superior_or_equal_to` decimal(10,2) DEFAULT NULL,
  `amount_superior_to` decimal(10,2) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`transaction_search_id`),
  KEY `fk_transaction_search_account` (`account_id`),
  CONSTRAINT `fk_transaction_search_account` FOREIGN KEY (`account_id`) REFERENCES `account` (`account_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transaction_search_category`
--

DROP TABLE IF EXISTS `transaction_search_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transaction_search_category` (
  `transaction_search_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` smallint(5) unsigned NOT NULL,
  PRIMARY KEY (`transaction_search_id`),
  KEY `fk_transaction_search_category_category` (`category_id`),
  CONSTRAINT `fk_transaction_search_category_category` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_transaction_search_category_transaction_search` FOREIGN KEY (`transaction_search_id`) REFERENCES `transaction_search` (`transaction_search_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transaction_search_payment_method`
--

DROP TABLE IF EXISTS `transaction_search_payment_method`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transaction_search_payment_method` (
  `transaction_search_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `payment_method_id` tinyint(3) unsigned NOT NULL,
  PRIMARY KEY (`transaction_search_id`),
  KEY `fk_transaction_search_payment_method_payment_method` (`payment_method_id`),
  CONSTRAINT `fk_transaction_search_payment_method_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method` (`payment_method_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_transaction_search_payment_method_transaction_search` FOREIGN KEY (`transaction_search_id`) REFERENCES `transaction_search` (`transaction_search_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `shared_account`
--

DROP TABLE IF EXISTS `shared_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `shared_account` (
  `account_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `write_access` tinyint(1) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`account_id`,`user_id`),
  KEY `fk_shared_account_account` (`account_id`),
  KEY `fk_shared_account_user` (`user_id`),
  CONSTRAINT `fk_shared_account_account` FOREIGN KEY (`account_id`) REFERENCES `account` (`account_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_shared_account_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transaction`
--

DROP TABLE IF EXISTS `transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `transaction` (
  `transaction_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `scheduler_id` int(10) unsigned DEFAULT NULL,
  `account_id` int(10) unsigned NOT NULL,
  `transfer_transaction_id` int(10) unsigned DEFAULT NULL,
  `category_id` smallint(5) unsigned NOT NULL,
  `third_party` varchar(64) NOT NULL,
  `payment_method_id` tinyint(3) unsigned NOT NULL,
  `debit` decimal(10,2) unsigned DEFAULT NULL,
  `credit` decimal(10,2) unsigned DEFAULT NULL,
  `value_date` date NOT NULL,
  `is_reconciled` tinyint(1) unsigned NOT NULL,
  `notes` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`transaction_id`),
  KEY `fk_transaction_payment_method` (`payment_method_id`),
  KEY `fk_transaction_category` (`category_id`),
  KEY `fk_transaction_account` (`account_id`),
  KEY `fk_transaction_scheduler` (`scheduler_id`),
  CONSTRAINT `fk_transaction_account` FOREIGN KEY (`account_id`) REFERENCES `account` (`account_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_transaction_category` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_transaction_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_method` (`payment_method_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_transaction_scheduler` FOREIGN KEY (`scheduler_id`) REFERENCES `scheduler` (`scheduler_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user` (
  `user_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `firstname` varchar(64) NOT NULL,
  `lastname` varchar(64) NOT NULL,
  `email` varchar(128) NOT NULL,
  `password` varchar(32) NOT NULL,
  `activation` varchar(32) DEFAULT NULL,
  `is_admin` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) unsigned NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2010-09-28 19:53:12
