-- MySQL dump 10.13  Distrib 8.0.36, for Linux (x86_64)
--
-- Host: localhost    Database: morphobank
-- ------------------------------------------------------
-- Server version	8.0.36-0ubuntu0.22.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `annotation_events`
--

DROP TABLE IF EXISTS `annotation_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `annotation_events` (
  `event_id` int unsigned NOT NULL AUTO_INCREMENT,
  `annotation_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `date_time` int unsigned NOT NULL,
  `typecode` tinyint unsigned NOT NULL,
  PRIMARY KEY (`event_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_annotation_events_annotation_id` (`annotation_id`),
  CONSTRAINT `fk_annotation_events_annotation_id` FOREIGN KEY (`annotation_id`) REFERENCES `annotations` (`annotation_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=381457 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `annotations`
--

DROP TABLE IF EXISTS `annotations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `annotations` (
  `annotation_id` int unsigned NOT NULL AUTO_INCREMENT,
  `table_num` tinyint unsigned NOT NULL DEFAULT '0',
  `row_id` int unsigned NOT NULL DEFAULT '0',
  `typecode` char(1) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `annotation` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_on` int NOT NULL DEFAULT '0',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `specifier_id` int unsigned DEFAULT NULL,
  `subspecifier_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`annotation_id`),
  KEY `i_row_id` (`row_id`),
  KEY `i_row` (`table_num`,`row_id`),
  KEY `i_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=85134 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=85134 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bibliographic_authors`
--

DROP TABLE IF EXISTS `bibliographic_authors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bibliographic_authors` (
  `author_id` int unsigned NOT NULL AUTO_INCREMENT,
  `forename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `middlename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `surname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `institution` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `forename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `middlename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `surname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `institution` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_id` int unsigned NOT NULL,
  `typecode` tinyint unsigned NOT NULL,
  PRIMARY KEY (`author_id`),
  UNIQUE KEY `u_name` (`surname`,`middlename`,`forename`,`reference_id`,`typecode`),
  KEY `fk_bibliographic_authors_reference_id` (`reference_id`),
  CONSTRAINT `fk_bibliographic_authors_reference_id` FOREIGN KEY (`reference_id`) REFERENCES `bibliographic_references` (`reference_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=105719 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
) ENGINE=InnoDB AUTO_INCREMENT=105719 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bibliographic_references`
--

DROP TABLE IF EXISTS `bibliographic_references`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bibliographic_references` (
  `reference_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL,
  `article_title` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `journal_title` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `monograph_title` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `authors` json DEFAULT NULL,
  `editors` json DEFAULT NULL,
  `vol` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `num` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `article_title` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `journal_title` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `monograph_title` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `authors` json DEFAULT NULL,
  `editors` json DEFAULT NULL,
  `vol` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `num` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pubyear` smallint unsigned DEFAULT NULL,
  `publisher` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abstract` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `collation` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_identifier` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `secondary_authors` json DEFAULT NULL,
  `article_secondary_title` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `urls` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `worktype` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `edition` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sect` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isbn` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `keywords` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `lang` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `electronic_resource_num` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_address` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `publisher` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abstract` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `collation` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_identifier` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `secondary_authors` json DEFAULT NULL,
  `article_secondary_title` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `urls` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `worktype` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `edition` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sect` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isbn` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `keywords` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `lang` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `electronic_resource_num` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_address` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_type` tinyint unsigned NOT NULL,
  `place_of_publication` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `place_of_publication` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_citation` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`reference_id`),
  KEY `fk_bibliographic_references_project_id` (`project_id`),
  CONSTRAINT `fk_bibliographic_references_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=52810 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=52810 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_application_vars`
--

DROP TABLE IF EXISTS `ca_application_vars`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_application_vars` (
  `vars` longtext NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_change_log`
--

DROP TABLE IF EXISTS `ca_change_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_change_log` (
  `log_id` bigint NOT NULL AUTO_INCREMENT,
  `log_datetime` int unsigned NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `changetype` char(1) NOT NULL,
  `logged_table_num` tinyint unsigned NOT NULL,
  `logged_row_id` int unsigned NOT NULL,
  `snapshot` json DEFAULT NULL,
  `rolledback` tinyint unsigned NOT NULL,
  `unit_id` char(32) DEFAULT NULL,
  `batch_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `i_datetime` (`log_datetime`),
  KEY `i_user_id` (`user_id`),
  KEY `i_logged` (`logged_row_id`,`logged_table_num`),
  KEY `i_unit_id` (`unit_id`),
  KEY `i_table_num` (`logged_table_num`),
  KEY `i_batch_id` (`batch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=73812922 DEFAULT CHARSET=utf8mb3 ROW_FORMAT=COMPRESSED;
) ENGINE=InnoDB AUTO_INCREMENT=73812922 DEFAULT CHARSET=utf8mb3 ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_change_log_subjects`
--

DROP TABLE IF EXISTS `ca_change_log_subjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_change_log_subjects` (
  `log_id` bigint NOT NULL,
  `subject_table_num` tinyint unsigned NOT NULL,
  `subject_row_id` int unsigned NOT NULL,
  KEY `i_log_id` (`log_id`),
  KEY `i_subject` (`subject_row_id`,`subject_table_num`),
  CONSTRAINT `fk_ca_change_log_subjects_log_id` FOREIGN KEY (`log_id`) REFERENCES `ca_change_log` (`log_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_eventlog`
--

DROP TABLE IF EXISTS `ca_eventlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_eventlog` (
  `date_time` int unsigned NOT NULL,
  `code` char(4) NOT NULL,
  `message` text NOT NULL,
  `source` varchar(255) NOT NULL,
  KEY `i_when` (`date_time`),
  KEY `i_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_locales`
--

DROP TABLE IF EXISTS `ca_locales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_locales` (
  `locale_id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `language` varchar(3) NOT NULL,
  `country` char(2) NOT NULL,
  `dialect` varchar(8) DEFAULT NULL,
  `dont_use_for_cataloguing` tinyint unsigned NOT NULL,
  PRIMARY KEY (`locale_id`),
  KEY `u_language_country` (`language`,`country`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_mysql_fulltext_search`
--

DROP TABLE IF EXISTS `ca_mysql_fulltext_search`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_mysql_fulltext_search` (
  `index_id` int unsigned NOT NULL AUTO_INCREMENT,
  `table_num` tinyint unsigned NOT NULL,
  `row_id` int unsigned NOT NULL,
  `field_table_num` tinyint unsigned NOT NULL,
  `field_num` tinyint unsigned NOT NULL,
  `field_row_id` int unsigned NOT NULL,
  `fieldtext` longtext NOT NULL,
  `boost` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`index_id`),
  KEY `i_table_num` (`table_num`),
  KEY `i_row_id` (`row_id`),
  KEY `i_field_table_num` (`field_table_num`),
  KEY `i_field_num` (`field_num`),
  KEY `i_boost` (`boost`),
  KEY `i_field_row_id` (`field_row_id`),
  FULLTEXT KEY `f_fulltext` (`fieldtext`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_search_log`
--

DROP TABLE IF EXISTS `ca_search_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_search_log` (
  `search_id` int unsigned NOT NULL AUTO_INCREMENT,
  `log_datetime` int unsigned NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `table_num` tinyint unsigned NOT NULL,
  `search_expression` varchar(1024) NOT NULL,
  `num_hits` int unsigned NOT NULL,
  `form_id` int unsigned DEFAULT NULL,
  `ip_addr` char(15) DEFAULT NULL,
  `details` text NOT NULL,
  `execution_time` decimal(7,3) NOT NULL,
  `search_source` varchar(40) NOT NULL,
  PRIMARY KEY (`search_id`),
  KEY `i_log_datetime` (`log_datetime`),
  KEY `i_user_id` (`user_id`),
  KEY `i_form_id` (`form_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3920550 DEFAULT CHARSET=utf8mb3;
) ENGINE=InnoDB AUTO_INCREMENT=3920550 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_sql_search_ngrams`
--

DROP TABLE IF EXISTS `ca_sql_search_ngrams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_sql_search_ngrams` (
  `word_id` int unsigned NOT NULL,
  `ngram` char(4) NOT NULL,
  `seq` tinyint unsigned NOT NULL,
  PRIMARY KEY (`word_id`,`seq`),
  KEY `i_ngram` (`ngram`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_sql_search_word_index`
--

DROP TABLE IF EXISTS `ca_sql_search_word_index`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_sql_search_word_index` (
  `table_num` tinyint unsigned NOT NULL,
  `row_id` int unsigned NOT NULL,
  `field_table_num` tinyint unsigned NOT NULL,
  `field_num` varchar(20) NOT NULL,
  `field_row_id` int unsigned NOT NULL,
  `word_id` int unsigned NOT NULL,
  `boost` tinyint unsigned NOT NULL DEFAULT '1',
  `access` tinyint unsigned NOT NULL DEFAULT '0',
  KEY `i_field_num` (`field_row_id`,`field_table_num`),
  KEY `i_index_table_num` (`word_id`,`table_num`,`row_id`),
  KEY `i_table_num_row_id_field` (`table_num`,`row_id`,`field_table_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_sql_search_words`
--

DROP TABLE IF EXISTS `ca_sql_search_words`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_sql_search_words` (
  `word_id` int unsigned NOT NULL AUTO_INCREMENT,
  `word` varchar(255) NOT NULL,
  `stem` varchar(255) NOT NULL,
  `locale_id` smallint unsigned DEFAULT NULL,
  PRIMARY KEY (`word_id`),
  UNIQUE KEY `u_word` (`word`),
  KEY `i_stem` (`stem`)
) ENGINE=InnoDB AUTO_INCREMENT=829867 DEFAULT CHARSET=utf8mb3;
) ENGINE=InnoDB AUTO_INCREMENT=829867 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_task_queue`
--

DROP TABLE IF EXISTS `ca_task_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_task_queue` (
  `task_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned DEFAULT NULL,
  `row_key` char(32) DEFAULT NULL,
  `entity_key` char(32) DEFAULT NULL,
  `status` tinyint unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL,
  `completed_on` int unsigned DEFAULT NULL,
  `priority` smallint unsigned NOT NULL,
  `handler` varchar(20) NOT NULL,
  `parameters` json DEFAULT NULL,
  `notes` text NOT NULL,
  `error_code` smallint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`task_id`),
  KEY `i_user_id` (`user_id`),
  KEY `i_entity_key` (`entity_key`),
  KEY `i_row_key` (`row_key`),
  KEY `i_status_priority` (`status`,`priority`)
) ENGINE=InnoDB AUTO_INCREMENT=51561 DEFAULT CHARSET=utf8mb3;
) ENGINE=InnoDB AUTO_INCREMENT=51561 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_user_roles`
--

DROP TABLE IF EXISTS `ca_user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_user_roles` (
  `role_id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `code` varchar(20) NOT NULL,
  `description` text NOT NULL,
  `vars` json DEFAULT NULL,
  `field_access` json DEFAULT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `u_name` (`name`),
  UNIQUE KEY `u_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_users`
--

DROP TABLE IF EXISTS `ca_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_users` (
  `user_id` int unsigned NOT NULL AUTO_INCREMENT,
  `userclass` tinyint unsigned NOT NULL,
  `password_hash` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vars` json DEFAULT NULL,
  `volatile_vars` json DEFAULT NULL,
  `active` tinyint unsigned NOT NULL,
  `confirmed_on` int unsigned DEFAULT NULL,
  `confirmation_key` char(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmation_key` char(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_on` int unsigned DEFAULT NULL,
  `advisor_user_id` int unsigned DEFAULT NULL,
  `last_confirmed_profile_on` int unsigned DEFAULT NULL,
  `accepted_terms_of_use` tinyint unsigned NOT NULL DEFAULT '0',
  `orcid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `orcid_access_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `orcid_refresh_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `orcid` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `orcid_access_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `orcid_refresh_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `u_confirmation_key` (`confirmation_key`),
  UNIQUE KEY `u_email` (`email`),
  UNIQUE KEY `u_orcid` (`orcid`) USING BTREE,
  UNIQUE KEY `u_orcid` (`orcid`) USING BTREE,
  KEY `i_userclass` (`userclass`),
  KEY `i_approved_on` (`approved_on`)
) ENGINE=InnoDB AUTO_INCREMENT=5313 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
) ENGINE=InnoDB AUTO_INCREMENT=5313 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_users_x_lockouts`
--

DROP TABLE IF EXISTS `ca_users_x_lockouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_users_x_lockouts` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `session_begin` int unsigned NOT NULL DEFAULT '0',
  `lockout_time` int unsigned NOT NULL DEFAULT '0',
  `unsuccessful_count` int unsigned NOT NULL DEFAULT '0',
  `duration` int unsigned NOT NULL DEFAULT '300',
  `last_successful` int unsigned NOT NULL DEFAULT '0',
  `last_unsuccessful` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `user_id_UNIQUE` (`user_id`),
  CONSTRAINT `fk_ca_users_x_lockouts_user_id` FOREIGN KEY (`user_id`) REFERENCES `ca_users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2161 DEFAULT CHARSET=utf8mb3;
) ENGINE=InnoDB AUTO_INCREMENT=2161 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ca_users_x_roles`
--

DROP TABLE IF EXISTS `ca_users_x_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ca_users_x_roles` (
  `relation_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `role_id` smallint unsigned NOT NULL,
  PRIMARY KEY (`relation_id`),
  UNIQUE KEY `u_all` (`user_id`,`role_id`),
  KEY `i_role_id` (`role_id`),
  CONSTRAINT `fk_ca_users_x_roles_role_id` FOREIGN KEY (`role_id`) REFERENCES `ca_user_roles` (`role_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_ca_users_x_roles_user_id` FOREIGN KEY (`user_id`) REFERENCES `ca_users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb3;
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cell_batch_log`
--

DROP TABLE IF EXISTS `cell_batch_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cell_batch_log` (
  `log_id` int unsigned NOT NULL AUTO_INCREMENT,
  `matrix_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `started_on` int unsigned NOT NULL,
  `finished_on` int unsigned NOT NULL,
  `batch_type` int unsigned DEFAULT '0',
  `description` text NOT NULL,
  `reverted` tinyint unsigned NOT NULL DEFAULT '0',
  `reverted_user_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `i_batch_id` (`matrix_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=26377 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=26377 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cell_change_log`
--

DROP TABLE IF EXISTS `cell_change_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cell_change_log` (
  `change_id` int unsigned NOT NULL AUTO_INCREMENT,
  `change_type` char(1) NOT NULL,
  `table_num` tinyint unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `changed_on` int unsigned NOT NULL,
  `matrix_id` int unsigned NOT NULL,
  `character_id` int unsigned NOT NULL,
  `taxon_id` int unsigned NOT NULL,
  `state_id` int unsigned DEFAULT NULL,
  `snapshot` json DEFAULT NULL,
  PRIMARY KEY (`change_id`),
  KEY `i_all` (`matrix_id`,`character_id`,`taxon_id`,`state_id`),
  KEY `i_character_id` (`character_id`),
  KEY `i_taxon_id` (`taxon_id`)
) ENGINE=InnoDB AUTO_INCREMENT=68047715 DEFAULT CHARSET=latin1 ROW_FORMAT=COMPRESSED;
) ENGINE=InnoDB AUTO_INCREMENT=68047715 DEFAULT CHARSET=latin1 ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cell_notes`
--

DROP TABLE IF EXISTS `cell_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cell_notes` (
  `note_id` int unsigned NOT NULL AUTO_INCREMENT,
  `matrix_id` int unsigned NOT NULL DEFAULT '0',
  `character_id` int unsigned NOT NULL DEFAULT '0',
  `taxon_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `created_on` int unsigned NOT NULL,
  `last_modified_on` int unsigned NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` tinyint unsigned NOT NULL,
  `ancestor_note_id` int unsigned DEFAULT NULL,
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`note_id`),
  UNIQUE KEY `u_all` (`matrix_id`,`character_id`,`taxon_id`),
  KEY `fk_cell_notes_taxon_id` (`taxon_id`),
  KEY `fk_cell_notes_character_id` (`character_id`),
  CONSTRAINT `fk_cell_notes_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cell_notes_matrix_id` FOREIGN KEY (`matrix_id`) REFERENCES `matrices` (`matrix_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cell_notes_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34333325 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=34333325 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cells`
--

DROP TABLE IF EXISTS `cells`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cells` (
  `cell_id` int unsigned NOT NULL AUTO_INCREMENT,
  `taxon_id` int unsigned NOT NULL DEFAULT '0',
  `character_id` int unsigned NOT NULL DEFAULT '0',
  `state_id` int unsigned DEFAULT NULL,
  `matrix_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `access` tinyint unsigned NOT NULL DEFAULT '0',
  `last_modified_on` int unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `is_npa` tinyint NOT NULL DEFAULT '0',
  `is_uncertain` tinyint DEFAULT '0',
  `ancestor_cell_id` int unsigned DEFAULT NULL,
  `start_value` decimal(20,10) DEFAULT NULL,
  `end_value` decimal(20,10) DEFAULT NULL,
  PRIMARY KEY (`cell_id`),
  KEY `i_user_id` (`user_id`),
  KEY `i_created_on` (`created_on`),
  KEY `fk_cells_taxon_id` (`taxon_id`),
  KEY `fk_cells_character_id` (`character_id`),
  KEY `fk_cells_state_id` (`state_id`),
  KEY `fk_cells_matrix_id` (`matrix_id`),
  CONSTRAINT `fk_cells_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cells_matrix_id` FOREIGN KEY (`matrix_id`) REFERENCES `matrices` (`matrix_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cells_state_id` FOREIGN KEY (`state_id`) REFERENCES `character_states` (`state_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cells_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `is_npa_and_is_uncertion_never_both_enabled_check` CHECK (((`is_npa` <> 1) or (`is_uncertain` <> 1)))
) ENGINE=InnoDB AUTO_INCREMENT=100779827 DEFAULT CHARSET=latin1;
  CONSTRAINT `fk_cells_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `is_npa_and_is_uncertion_never_both_enabled_check` CHECK (((`is_npa` <> 1) or (`is_uncertain` <> 1)))
) ENGINE=InnoDB AUTO_INCREMENT=100779827 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cells_x_bibliographic_references`
--

DROP TABLE IF EXISTS `cells_x_bibliographic_references`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cells_x_bibliographic_references` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `reference_id` int unsigned NOT NULL,
  `pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `character_id` int unsigned NOT NULL,
  `taxon_id` int unsigned NOT NULL,
  `matrix_id` int unsigned NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`link_id`),
  KEY `u_all` (`taxon_id`,`character_id`,`matrix_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_cells_x_bibliographic_references_reference_id` (`reference_id`),
  KEY `fk_cells_x_bibliographic_references_matrix_id` (`matrix_id`),
  KEY `fk_cells_x_bibliographic_references_character_id` (`character_id`),
  CONSTRAINT `fk_cells_x_bibliographic_references_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cells_x_bibliographic_references_matrix_id` FOREIGN KEY (`matrix_id`) REFERENCES `matrices` (`matrix_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cells_x_bibliographic_references_reference_id` FOREIGN KEY (`reference_id`) REFERENCES `bibliographic_references` (`reference_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cells_x_bibliographic_references_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2007134 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=2007134 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cells_x_media`
--

DROP TABLE IF EXISTS `cells_x_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cells_x_media` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `media_id` int unsigned NOT NULL DEFAULT '0',
  `notes` text NOT NULL,
  `taxon_id` int unsigned NOT NULL DEFAULT '0',
  `character_id` int unsigned NOT NULL DEFAULT '0',
  `matrix_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned DEFAULT NULL,
  `created_on` int unsigned NOT NULL,
  `ancestor_link_id` int unsigned DEFAULT NULL,
  `set_by_automation` tinyint unsigned NOT NULL DEFAULT '0',
  `source` varchar(40) NOT NULL DEFAULT '',
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `u_all` (`media_id`,`character_id`,`taxon_id`,`matrix_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_cells_x_media_matrix_id` (`matrix_id`),
  KEY `fk_cells_x_media_taxon_id` (`taxon_id`),
  KEY `fk_cells_x_media_character_id` (`character_id`),
  CONSTRAINT `fk_cells_x_media_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cells_x_media_matrix_id` FOREIGN KEY (`matrix_id`) REFERENCES `matrices` (`matrix_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cells_x_media_media_id` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`media_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cells_x_media_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4256388 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=4256388 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `character_change_log`
--

DROP TABLE IF EXISTS `character_change_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `character_change_log` (
  `change_id` int unsigned NOT NULL AUTO_INCREMENT,
  `change_type` char(1) NOT NULL,
  `user_id` int unsigned NOT NULL,
  `changed_on` int unsigned NOT NULL,
  `character_id` int unsigned NOT NULL,
  `is_minor_edit` tinyint unsigned NOT NULL,
  PRIMARY KEY (`change_id`),
  KEY `i_character_id` (`character_id`),
  KEY `i_user_id` (`user_id`),
  KEY `i_changed_on` (`changed_on`)
) ENGINE=InnoDB AUTO_INCREMENT=4160257 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=4160257 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `character_orderings`
--

DROP TABLE IF EXISTS `character_orderings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `character_orderings` (
  `order_id` int unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `order_type` tinyint NOT NULL DEFAULT '0',
  `step_matrix` text NOT NULL,
  `user_id` int unsigned NOT NULL,
  `matrix_id` int unsigned NOT NULL,
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `last_modified_on` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`order_id`),
  KEY `fk_character_orderings_project_id` (`matrix_id`),
  CONSTRAINT `fk_character_orderings_project_id` FOREIGN KEY (`matrix_id`) REFERENCES `matrices` (`matrix_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `character_rule_actions`
--

DROP TABLE IF EXISTS `character_rule_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `character_rule_actions` (
  `action_id` int unsigned NOT NULL AUTO_INCREMENT,
  `rule_id` int unsigned NOT NULL,
  `action` varchar(20) NOT NULL,
  `character_id` int unsigned NOT NULL,
  `state_id` int unsigned DEFAULT NULL,
  `settings` json DEFAULT NULL,
  `user_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`action_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_character_rule_actions_rule_id` (`rule_id`),
  KEY `fk_character_rule_actions_character_id` (`character_id`),
  KEY `fk_character_rule_actions_state_id` (`state_id`),
  CONSTRAINT `fk_character_rule_actions_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_character_rule_actions_rule_id` FOREIGN KEY (`rule_id`) REFERENCES `character_rules` (`rule_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_character_rule_actions_state_id` FOREIGN KEY (`state_id`) REFERENCES `character_states` (`state_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=48046 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=48046 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `character_rules`
--

DROP TABLE IF EXISTS `character_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `character_rules` (
  `rule_id` int unsigned NOT NULL AUTO_INCREMENT,
  `character_id` int unsigned NOT NULL,
  `state_id` int unsigned DEFAULT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `created_on` int unsigned NOT NULL,
  `source` varchar(40) NOT NULL DEFAULT '',
  PRIMARY KEY (`rule_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_character_rules_state_id` (`state_id`),
  KEY `fk_character_rules_character_id` (`character_id`),
  CONSTRAINT `fk_character_rules_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_character_rules_state_id` FOREIGN KEY (`state_id`) REFERENCES `character_states` (`state_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9297 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=9297 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `character_states`
--

DROP TABLE IF EXISTS `character_states`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `character_states` (
  `state_id` int unsigned NOT NULL AUTO_INCREMENT,
  `character_id` int unsigned NOT NULL DEFAULT '0',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `num` int NOT NULL DEFAULT '0',
  `color` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `color` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `access` tinyint unsigned NOT NULL DEFAULT '0',
  `ancestor_state_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`state_id`),
  KEY `i_character_id` (`character_id`),
  KEY `i_user_id` (`user_id`),
  KEY `i_name` (`name`),
  CONSTRAINT `fk_character_states_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5805734 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=5805734 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `characters`
--

DROP TABLE IF EXISTS `characters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `characters` (
  `character_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL DEFAULT '0',
  `name` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL,
  `num` int NOT NULL DEFAULT '0',
  `color` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `color` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `ordering` tinyint DEFAULT '0',
  `order_id` int unsigned DEFAULT NULL,
  `type` tinyint unsigned NOT NULL DEFAULT '0',
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `access` tinyint unsigned NOT NULL DEFAULT '0',
  `last_modified_on` int unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `ancestor_character_id` int unsigned DEFAULT NULL,
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`character_id`),
  KEY `i_user_id` (`user_id`),
  KEY `i_name` (`name`(767)),
  KEY `fk_characters_project_id` (`project_id`),
  CONSTRAINT `fk_characters_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2219974 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=2219974 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `characters_x_bibliographic_references`
--

DROP TABLE IF EXISTS `characters_x_bibliographic_references`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `characters_x_bibliographic_references` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `reference_id` int unsigned NOT NULL,
  `character_id` int unsigned NOT NULL,
  `pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `u_all2` (`reference_id`,`character_id`,`pp`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_characters_x_bibliographic_references_character_id` (`character_id`),
  CONSTRAINT `fk_characters_x_bibliographic_references_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_characters_x_bibliographic_references_reference_id` FOREIGN KEY (`reference_id`) REFERENCES `bibliographic_references` (`reference_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37859 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
) ENGINE=InnoDB AUTO_INCREMENT=37859 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `characters_x_media`
--

DROP TABLE IF EXISTS `characters_x_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `characters_x_media` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `character_id` int unsigned NOT NULL DEFAULT '0',
  `media_id` int unsigned NOT NULL DEFAULT '0',
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `state_id` int unsigned DEFAULT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `created_on` int unsigned NOT NULL,
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`link_id`),
  KEY `u_all` (`character_id`,`media_id`,`state_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_characters_x_media_state_id` (`state_id`),
  KEY `fk_characters_x_media_media_id` (`media_id`),
  CONSTRAINT `fk_characters_x_media_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_characters_x_media_media_id` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`media_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_characters_x_media_state_id` FOREIGN KEY (`state_id`) REFERENCES `character_states` (`state_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=278988 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=278988 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `characters_x_partitions`
--

DROP TABLE IF EXISTS `characters_x_partitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `characters_x_partitions` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `partition_id` int unsigned NOT NULL DEFAULT '0',
  `character_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `u_all` (`partition_id`,`character_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_characters_x_partitions_character_id` (`character_id`),
  CONSTRAINT `fk_characters_x_partitions_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_characters_x_partitions_project_id` FOREIGN KEY (`partition_id`) REFERENCES `partitions` (`partition_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=270495 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=270495 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cipres_requests`
--

DROP TABLE IF EXISTS `cipres_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cipres_requests` (
  `request_id` int unsigned NOT NULL AUTO_INCREMENT,
  `matrix_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `notes` text NOT NULL,
  `created_on` int unsigned NOT NULL,
  `last_updated_on` int unsigned DEFAULT NULL,
  `cipres_job_id` varchar(255) NOT NULL,
  `cipres_last_status` varchar(255) DEFAULT NULL,
  `cipres_tool` varchar(255) NOT NULL,
  `input_file` json DEFAULT NULL,
  `output_file` json DEFAULT NULL,
  `cipres_settings` json DEFAULT NULL,
  `jobname` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`request_id`),
  KEY `i_user_id` (`user_id`),
  KEY `i_cipres_job_id` (`cipres_job_id`),
  KEY `fk_cipres_requests_matrix_id` (`matrix_id`),
  CONSTRAINT `fk_cipres_requests_matrix_id` FOREIGN KEY (`matrix_id`) REFERENCES `matrices` (`matrix_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=648 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=648 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `curation_requests`
--

DROP TABLE IF EXISTS `curation_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `curation_requests` (
  `request_id` int unsigned NOT NULL AUTO_INCREMENT,
  `request_type` tinyint NOT NULL,
  `status` tinyint unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL,
  `completed_on` int unsigned DEFAULT NULL,
  `table_num` tinyint unsigned NOT NULL,
  `row_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `parameters` json DEFAULT NULL,
  PRIMARY KEY (`request_id`)
) ENGINE=InnoDB AUTO_INCREMENT=393 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
) ENGINE=InnoDB AUTO_INCREMENT=393 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `curator_communication_log`
--

DROP TABLE IF EXISTS `curator_communication_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `curator_communication_log` (
  `log_id` int unsigned NOT NULL AUTO_INCREMENT,
  `potential_id` int unsigned NOT NULL,
  `contact_date` int unsigned NOT NULL,
  `contact_person` varchar(100) NOT NULL,
  `notes` text NOT NULL,
  `created_on` int unsigned NOT NULL,
  `last_modified` int unsigned NOT NULL,
  PRIMARY KEY (`log_id`),
  KEY `i_potential_id` (`potential_id`),
  KEY `i_created_on` (`created_on`),
  KEY `i_last_modified` (`last_modified`),
  KEY `i_contact_date` (`contact_date`),
  KEY `i_contact_person` (`contact_person`),
  CONSTRAINT `fk_curator_potential_projects_potential_id` FOREIGN KEY (`potential_id`) REFERENCES `curator_potential_projects` (`potential_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=854 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `curator_potential_projects`
--

DROP TABLE IF EXISTS `curator_potential_projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `curator_potential_projects` (
  `potential_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned DEFAULT NULL,
  `owner_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `journal_title` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `journal_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `journal_volume` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `journal_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `owner_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `journal_title` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `journal_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `journal_volume` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `journal_number` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `journal_in_press` tinyint unsigned NOT NULL DEFAULT '0',
  `journal_year` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `article_title` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `article_authors` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `article_pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `article_doi` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `pages` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `journal_year` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `article_title` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `article_authors` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `article_pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `article_doi` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `pages` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `publication_date` int unsigned DEFAULT NULL,
  `url` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_on` int unsigned NOT NULL,
  `last_modified` int unsigned NOT NULL,
  `approved_on` int unsigned DEFAULT NULL,
  `approved_by_id` int unsigned DEFAULT NULL,
  `checklist_project_published` int unsigned DEFAULT NULL,
  `checklist_citation_listed` int unsigned DEFAULT NULL,
  `checklist_exemplar_entered` int unsigned DEFAULT NULL,
  `checklist_exemplar_affiliated` int unsigned DEFAULT NULL,
  `checklist_species_spelled_in_full` int unsigned DEFAULT NULL,
  `checklist_enough_media` int unsigned DEFAULT NULL,
  `checklist_extinct_taxa_present` int unsigned DEFAULT NULL,
  `checklist_project_tweeted` int unsigned DEFAULT NULL,
  `status` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `status` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `checklist_publication_is_url_listed` tinyint unsigned NOT NULL DEFAULT '0',
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`potential_id`),
  UNIQUE KEY `u_project_id` (`project_id`),
  KEY `fk_projects_approved_by_id` (`approved_by_id`),
  KEY `i_project_id` (`project_id`),
  KEY `i_created_on` (`created_on`),
  KEY `i_last_modified` (`last_modified`),
  KEY `i_status` (`status`),
  CONSTRAINT `fk_projects_approved_by_id` FOREIGN KEY (`approved_by_id`) REFERENCES `ca_users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=1393 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
) ENGINE=InnoDB AUTO_INCREMENT=1393 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `faq_categories`
--

DROP TABLE IF EXISTS `faq_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faq_categories` (
  `category_id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `category` varchar(255) NOT NULL DEFAULT '',
  `description` text NOT NULL,
  `position` smallint unsigned DEFAULT NULL,
  PRIMARY KEY (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `faq_items`
--

DROP TABLE IF EXISTS `faq_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `faq_items` (
  `item_id` int unsigned NOT NULL AUTO_INCREMENT,
  `category_id` smallint unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `position` int unsigned DEFAULT NULL,
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `last_modified` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `folios`
--

DROP TABLE IF EXISTS `folios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `folios` (
  `folio_id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` text COLLATE utf8mb4_unicode_ci,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` text COLLATE utf8mb4_unicode_ci,
  `project_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL,
  `last_modified_on` int unsigned NOT NULL,
  `created_on` int unsigned NOT NULL,
  `last_modified_on` int unsigned NOT NULL,
  `published` tinyint NOT NULL,
  PRIMARY KEY (`folio_id`),
  KEY `fk_folios_project_id` (`project_id`),
  CONSTRAINT `fk_folios_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1047 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=1047 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `folios_x_media_files`
--

DROP TABLE IF EXISTS `folios_x_media_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `folios_x_media_files` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `folio_id` int unsigned NOT NULL DEFAULT '0',
  `media_id` int unsigned NOT NULL DEFAULT '0',
  `notes` text NOT NULL,
  `position` int unsigned DEFAULT NULL,
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `u_all` (`folio_id`,`media_id`),
  KEY `fk_folios_x_media_files_media_id` (`media_id`),
  CONSTRAINT `fk_folios_x_media_files_folio_id` FOREIGN KEY (`folio_id`) REFERENCES `folios` (`folio_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_folios_x_media_files_media_id` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`media_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26453 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=26453 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hp_announcements`
--

DROP TABLE IF EXISTS `hp_announcements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hp_announcements` (
  `announcement_id` int unsigned NOT NULL AUTO_INCREMENT,
  `description` text NOT NULL,
  `sdate` int unsigned NOT NULL,
  `edate` int unsigned NOT NULL,
  `created_on` int unsigned NOT NULL,
  `link` text NOT NULL,
  `title` varchar(255) NOT NULL,
  PRIMARY KEY (`announcement_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hp_featured_projects`
--

DROP TABLE IF EXISTS `hp_featured_projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hp_featured_projects` (
  `featured_project_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `description` text NOT NULL,
  `created_on` int unsigned NOT NULL,
  PRIMARY KEY (`featured_project_id`),
  KEY `fk_hp_featured_projects_project_id` (`project_id`),
  CONSTRAINT `fk_hp_featured_projects_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hp_matrix_images`
--

DROP TABLE IF EXISTS `hp_matrix_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hp_matrix_images` (
  `image_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `media` json DEFAULT NULL,
  `description` text NOT NULL,
  `created_on` int unsigned NOT NULL,
  PRIMARY KEY (`image_id`),
  KEY `fk_hp_matrix_images_project_id` (`project_id`),
  CONSTRAINT `fk_hp_matrix_images_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=228 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=228 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hp_tools`
--

DROP TABLE IF EXISTS `hp_tools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hp_tools` (
  `tool_id` int unsigned NOT NULL AUTO_INCREMENT,
  `media` json DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `link` text NOT NULL,
  `created_on` int unsigned NOT NULL,
  PRIMARY KEY (`tool_id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inactive_deletion`
--

DROP TABLE IF EXISTS `inactive_deletion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inactive_deletion` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `status` tinyint unsigned NOT NULL DEFAULT '0',
  `table_num` int unsigned DEFAULT NULL,
  `row_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`link_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `institutions`
--

DROP TABLE IF EXISTS `institutions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institutions` (
  `institution_id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_on` int unsigned NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`institution_id`),
  UNIQUE KEY `name_unique` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3709 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=3709 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `institutions_x_projects`
--

DROP TABLE IF EXISTS `institutions_x_projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institutions_x_projects` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `institution_id` int unsigned NOT NULL,
  `created_on` int unsigned NOT NULL,
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `projects_x_institution_unique` (`project_id`,`institution_id`),
  KEY `institution_id` (`institution_id`),
  CONSTRAINT `institutions_x_projects_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `institutions_x_projects_ibfk_2` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`institution_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=4496 DEFAULT CHARSET=utf8mb3;
) ENGINE=InnoDB AUTO_INCREMENT=4496 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `institutions_x_users`
--

DROP TABLE IF EXISTS `institutions_x_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `institutions_x_users` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `institution_id` int unsigned NOT NULL,
  `created_on` int unsigned NOT NULL,
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `user_x_institution_unique` (`user_id`,`institution_id`),
  KEY `institution_id` (`institution_id`),
  CONSTRAINT `institutions_x_users_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `ca_users` (`user_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `institutions_x_users_ibfk_2` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`institution_id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=3425 DEFAULT CHARSET=utf8mb3;
) ENGINE=InnoDB AUTO_INCREMENT=3425 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `labels`
--

DROP TABLE IF EXISTS `labels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `labels` (
  `label_id` int unsigned NOT NULL AUTO_INCREMENT,
  `media_id` int unsigned NOT NULL DEFAULT '0',
  `text_pos_x` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `text_pos_y` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `area_pos_x` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `area_pos_y` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `area_width` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `area_height` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `color` varchar(6) NOT NULL DEFAULT '',
  `label_text` text NOT NULL,
  `url` text NOT NULL,
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `link_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`label_id`),
  KEY `i_media_id` (`media_id`),
  KEY `i_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrices`
--

DROP TABLE IF EXISTS `matrices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrices` (
  `matrix_id` int unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `title_extended` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `title_extended` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `published` tinyint unsigned NOT NULL DEFAULT '0',
  `project_id` int unsigned NOT NULL DEFAULT '0',
  `deleted` tinyint unsigned NOT NULL DEFAULT '0',
  `otu` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otu` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `access` tinyint unsigned NOT NULL DEFAULT '0',
  `type` tinyint unsigned NOT NULL DEFAULT '0',
  `last_modified_on` int unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `other_options` json DEFAULT NULL,
  `matrix_doi` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `matrix_doi` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`matrix_id`),
  KEY `i_title` (`title`),
  KEY `i_user_id` (`user_id`),
  KEY `i_created_on` (`created_on`),
  KEY `fk_matrices_project_id` (`project_id`),
  CONSTRAINT `fk_matrices_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27670 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=27670 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrix_additional_blocks`
--

DROP TABLE IF EXISTS `matrix_additional_blocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrix_additional_blocks` (
  `block_id` int unsigned NOT NULL AUTO_INCREMENT,
  `matrix_id` int unsigned NOT NULL,
  `upload_id` int unsigned DEFAULT NULL,
  `name` varchar(20) NOT NULL,
  `content` longtext NOT NULL,
  PRIMARY KEY (`block_id`),
  KEY `fk_matrix_additional_blocks_matrix_id` (`matrix_id`),
  KEY `fk_matrix_additional_blocks_upload_id` (`upload_id`),
  CONSTRAINT `fk_matrix_additional_blocks_matrix_id` FOREIGN KEY (`matrix_id`) REFERENCES `matrices` (`matrix_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_matrix_additional_blocks_upload_id` FOREIGN KEY (`upload_id`) REFERENCES `matrix_file_uploads` (`upload_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4273 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=4273 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrix_character_order`
--

DROP TABLE IF EXISTS `matrix_character_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrix_character_order` (
  `order_id` int unsigned NOT NULL AUTO_INCREMENT,
  `matrix_id` int unsigned NOT NULL DEFAULT '0',
  `character_id` int unsigned NOT NULL DEFAULT '0',
  `position` smallint unsigned DEFAULT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`order_id`),
  UNIQUE KEY `u_all` (`character_id`,`matrix_id`),
  UNIQUE KEY `u_rank` (`matrix_id`,`position`),
  CONSTRAINT `fk_matrix_character_order_character_id` FOREIGN KEY (`character_id`) REFERENCES `characters` (`character_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_matrix_character_order_matrix_id` FOREIGN KEY (`matrix_id`) REFERENCES `matrices` (`matrix_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2450221 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=2450221 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrix_file_uploads`
--

DROP TABLE IF EXISTS `matrix_file_uploads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrix_file_uploads` (
  `upload_id` int unsigned NOT NULL AUTO_INCREMENT,
  `upload` json DEFAULT NULL,
  `comments` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_note` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `comments` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_note` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `matrix_id` int unsigned NOT NULL DEFAULT '0',
  `uploaded_on` int unsigned NOT NULL DEFAULT '0',
  `matrix_note` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `otu` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `format` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `matrix_note` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `otu` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `format` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`upload_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_matrix_file_uploads_matrix_id` (`matrix_id`),
  CONSTRAINT `fk_matrix_file_uploads_matrix_id` FOREIGN KEY (`matrix_id`) REFERENCES `matrices` (`matrix_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6343 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=6343 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `matrix_taxa_order`
--

DROP TABLE IF EXISTS `matrix_taxa_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matrix_taxa_order` (
  `order_id` int unsigned NOT NULL AUTO_INCREMENT,
  `matrix_id` int unsigned NOT NULL DEFAULT '0',
  `taxon_id` int unsigned NOT NULL DEFAULT '0',
  `position` smallint unsigned DEFAULT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci,
  `user_id` int unsigned DEFAULT NULL,
  `group_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`order_id`),
  UNIQUE KEY `u_all` (`taxon_id`,`matrix_id`),
  UNIQUE KEY `u_rank` (`matrix_id`,`position`),
  KEY `fk_matrix_taxa_order_group_id` (`group_id`),
  CONSTRAINT `fk_matrix_taxa_order_group_id` FOREIGN KEY (`group_id`) REFERENCES `project_member_groups` (`group_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  KEY `fk_matrix_taxa_order_group_id` (`group_id`),
  CONSTRAINT `fk_matrix_taxa_order_group_id` FOREIGN KEY (`group_id`) REFERENCES `project_member_groups` (`group_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_matrix_taxa_order_matrix_id` FOREIGN KEY (`matrix_id`) REFERENCES `matrices` (`matrix_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_matrix_taxa_order_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=863427 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=863427 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `media_files`
--

DROP TABLE IF EXISTS `media_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `media_files` (
  `media_id` int unsigned NOT NULL AUTO_INCREMENT,
  `specimen_id` int unsigned DEFAULT NULL,
  `project_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `media` json DEFAULT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `published` tinyint unsigned NOT NULL DEFAULT '0',
  `view_id` int unsigned DEFAULT NULL,
  `is_copyrighted` tinyint unsigned DEFAULT NULL,
  `is_sided` tinyint unsigned NOT NULL DEFAULT '0',
  `copyright_permission` tinyint unsigned NOT NULL DEFAULT '0',
  `copyright_info` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `copyright_info` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `access` tinyint unsigned NOT NULL DEFAULT '0',
  `last_modified_on` int unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `url` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `url_description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `url_description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `citation_number` smallint unsigned DEFAULT NULL,
  `copyright_license` tinyint unsigned NOT NULL,
  `ancestor_media_id` int unsigned DEFAULT NULL,
  `in_use_in_matrix` tinyint unsigned DEFAULT NULL,
  `cataloguing_status` tinyint unsigned NOT NULL,
  `eol_id` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `media_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uuid` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `eol_id` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `media_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uuid` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`media_id`),
  KEY `i_user_id` (`user_id`),
  KEY `i_created_on` (`created_on`),
  KEY `fk_media_files_specimen_id` (`specimen_id`),
  KEY `fk_media_files_view_id` (`view_id`),
  KEY `fk_media_files_project_id` (`project_id`),
  CONSTRAINT `fk_media_files_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_media_files_specimen_id` FOREIGN KEY (`specimen_id`) REFERENCES `specimens` (`specimen_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_media_files_view_id` FOREIGN KEY (`view_id`) REFERENCES `media_views` (`view_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=842363 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=842363 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `media_files_x_bibliographic_references`
--

DROP TABLE IF EXISTS `media_files_x_bibliographic_references`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `media_files_x_bibliographic_references` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `reference_id` int unsigned NOT NULL,
  `media_id` int unsigned NOT NULL,
  `pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `u_all` (`media_id`,`reference_id`,`pp`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_media_files_x_bibliographic_references_reference_id` (`reference_id`),
  CONSTRAINT `fk_media_files_x_bibliographic_references_media_id` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`media_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_media_files_x_bibliographic_references_reference_id` FOREIGN KEY (`reference_id`) REFERENCES `bibliographic_references` (`reference_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=104439 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
) ENGINE=InnoDB AUTO_INCREMENT=104439 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `media_files_x_documents`
--

DROP TABLE IF EXISTS `media_files_x_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `media_files_x_documents` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `document_id` int unsigned NOT NULL,
  `media_id` int unsigned NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `NoDoubleDocument` (`media_id`,`document_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_media_files_x_documents_document_id` (`document_id`),
  CONSTRAINT `fk_media_files_x_documents_document_id` FOREIGN KEY (`document_id`) REFERENCES `project_documents` (`document_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_media_files_x_documents_media_id` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`media_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15833 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=15833 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `media_labels`
--

DROP TABLE IF EXISTS `media_labels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `media_labels` (
  `label_id` int unsigned NOT NULL AUTO_INCREMENT,
  `media_id` int unsigned NOT NULL DEFAULT '0',
  `link_id` int unsigned DEFAULT NULL,
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `typecode` tinyint unsigned NOT NULL DEFAULT '0',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `content` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `content` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `properties` json DEFAULT NULL,
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `table_num` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`label_id`),
  KEY `i_link_id` (`link_id`),
  KEY `i_user_id` (`user_id`),
  KEY `i_table_num` (`table_num`),
  KEY `fk_media_labels_media_id` (`media_id`),
  CONSTRAINT `fk_media_labels_media_id` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`media_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2940475 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=2940475 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `media_views`
--

DROP TABLE IF EXISTS `media_views`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `media_views` (
  `view_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `ancestor_view_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`view_id`),
  UNIQUE KEY `u_view` (`project_id`,`name`),
  KEY `i_name` (`name`),
  CONSTRAINT `fk_media_views_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20882 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
) ENGINE=InnoDB AUTO_INCREMENT=20882 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `member_stats`
--

DROP TABLE IF EXISTS `member_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member_stats` (
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `member_name` varchar(50) NOT NULL,
  `fname` varchar(25) NOT NULL,
  `lname` varchar(25) NOT NULL,
  `administrator` tinyint NOT NULL,
  `membership_status` tinyint NOT NULL,
  `member_email` varchar(50) NOT NULL,
  `member_role` tinyint NOT NULL,
  `last_access` int NOT NULL,
  `taxa` int NOT NULL,
  `specimens` int NOT NULL,
  `media` int NOT NULL,
  `media_notes` int NOT NULL,
  `characters` int NOT NULL,
  `character_comments` int NOT NULL,
  `character_notes` int NOT NULL,
  `character_media` int NOT NULL,
  `character_media_labels` int NOT NULL,
  `cell_scorings` int NOT NULL,
  `cell_scorings_scored` int NOT NULL,
  `cell_scorings_npa` int NOT NULL,
  `cell_scorings_not` int NOT NULL,
  `cell_comments` int NOT NULL,
  `cell_notes` int NOT NULL,
  `cell_media` int NOT NULL,
  `cell_media_labels` int NOT NULL,
  `rules` int NOT NULL,
  `warnings` int NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`,`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `overview_stats`
--

DROP TABLE IF EXISTS `overview_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `overview_stats` (
  `project_id` int NOT NULL,
  `media` int NOT NULL,
  `matrices` int NOT NULL,
  `docs` int NOT NULL,
  `folios` int NOT NULL,
  `taxa` int NOT NULL,
  `specimens` int NOT NULL,
  `characters` int NOT NULL,
  `media_size` int NOT NULL,
  `matrix_cells_scored` int NOT NULL,
  `matrix_cell_media` int NOT NULL,
  `matrix_cell_media_labels` int NOT NULL,
  `character_characters` int NOT NULL,
  `character_media_characters` int NOT NULL,
  `character_media_states` int NOT NULL,
  `character_states` int NOT NULL,
  `character_state_media` int NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `partitions`
--

DROP TABLE IF EXISTS `partitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `partitions` (
  `partition_id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `project_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`partition_id`),
  UNIQUE KEY `u_all` (`name`,`project_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_partitions_project_id` (`project_id`),
  CONSTRAINT `fk_partitions_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1233 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
) ENGINE=InnoDB AUTO_INCREMENT=1233 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `press`
--

DROP TABLE IF EXISTS `press`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `press` (
  `press_id` int unsigned NOT NULL AUTO_INCREMENT,
  `date` int unsigned NOT NULL,
  `author` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `publication` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `author` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `publication` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `media` json DEFAULT NULL,
  `type` tinyint unsigned NOT NULL,
  `featured` tinyint unsigned NOT NULL,
  `position` int unsigned DEFAULT NULL,
  `created_on` int unsigned NOT NULL,
  PRIMARY KEY (`press_id`),
  KEY `i_press_id` (`press_id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_document_folders`
--

DROP TABLE IF EXISTS `project_document_folders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_document_folders` (
  `folder_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `access` tinyint unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  PRIMARY KEY (`folder_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_project_document_folders_project_id` (`project_id`),
  CONSTRAINT `fk_project_document_folders_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=322 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=322 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_documents`
--

DROP TABLE IF EXISTS `project_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_documents` (
  `document_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `upload` json DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned NOT NULL,
  `access` tinyint unsigned NOT NULL,
  `published` tinyint unsigned NOT NULL,
  `uploaded_on` int unsigned NOT NULL,
  `folder_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`document_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_project_documents_folder_id` (`folder_id`),
  KEY `fk_project_documents_project_id` (`project_id`),
  CONSTRAINT `fk_project_documents_folder_id` FOREIGN KEY (`folder_id`) REFERENCES `project_document_folders` (`folder_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_project_documents_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9408 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=9408 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_duplication_requests`
--

DROP TABLE IF EXISTS `project_duplication_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_duplication_requests` (
  `request_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `request_remarks` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_remarks` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `onetime_use_action` tinyint unsigned DEFAULT NULL,
  `status` tinyint unsigned NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `new_project_number` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `new_project_number` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned NOT NULL,
  `created_on` int unsigned NOT NULL,
  PRIMARY KEY (`request_id`),
  KEY `i_request_id` (`request_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_project_duplication_requests_project_id` (`project_id`),
  CONSTRAINT `fk_project_duplication_requests_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=95 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=95 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_groups`
--

DROP TABLE IF EXISTS `project_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_groups` (
  `group_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`group_id`),
  UNIQUE KEY `u_all` (`user_id`,`name`),
  KEY `i_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_member_groups`
--

DROP TABLE IF EXISTS `project_member_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_member_groups` (
  `group_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `group_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` char(6) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` char(6) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`group_id`),
  UNIQUE KEY `u_project_group_name` (`project_id`,`group_name`),
  CONSTRAINT `fk_project_member_groups_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=267 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPRESSED;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_members_x_groups`
--

DROP TABLE IF EXISTS `project_members_x_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_members_x_groups` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `membership_id` int unsigned NOT NULL,
  `group_id` int unsigned NOT NULL,
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `u_all` (`membership_id`,`group_id`),
  KEY `fk_project_members_x_groups_group_id` (`group_id`),
  CONSTRAINT `fk_project_members_x_groups_group_id` FOREIGN KEY (`group_id`) REFERENCES `project_member_groups` (`group_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_project_members_x_groups_membership_id` FOREIGN KEY (`membership_id`) REFERENCES `projects_x_users` (`link_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1239 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=1239 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `project_id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `published` tinyint unsigned NOT NULL DEFAULT '0',
  `deleted` tinyint unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `last_accessed_on` int unsigned NOT NULL DEFAULT '0',
  `journal_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `journal_url` varchar(2048) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `journal_volume` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `journal_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `journal_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `journal_url` varchar(2048) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `journal_volume` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `journal_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `journal_cover` json DEFAULT NULL,
  `journal_year` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `article_authors` mediumtext COLLATE utf8mb4_unicode_ci,
  `article_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `article_pp` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `journal_year` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `article_authors` mediumtext COLLATE utf8mb4_unicode_ci,
  `article_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `article_pp` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allow_reviewer_login` tinyint unsigned NOT NULL DEFAULT '0',
  `reviewer_login_password` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewer_login_password` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_id` int unsigned DEFAULT NULL,
  `publish_character_comments` tinyint NOT NULL DEFAULT '1',
  `publish_cell_comments` tinyint NOT NULL DEFAULT '1',
  `publish_change_logs` tinyint NOT NULL DEFAULT '1',
  `publish_cell_notes` tinyint NOT NULL DEFAULT '1',
  `publish_character_notes` tinyint NOT NULL DEFAULT '1',
  `publish_media_notes` tinyint NOT NULL DEFAULT '1',
  `publish_inactive_members` tinyint NOT NULL DEFAULT '1',
  `exemplar_image` json DEFAULT NULL,
  `exemplar_caption` mediumtext COLLATE utf8mb4_unicode_ci,
  `exemplar_caption` mediumtext COLLATE utf8mb4_unicode_ci,
  `published_on` int unsigned DEFAULT NULL,
  `featured` tinyint unsigned DEFAULT NULL,
  `exemplar_media_id` int unsigned DEFAULT NULL,
  `partition_published_on` int unsigned DEFAULT NULL,
  `partitioned_from_project_id` int unsigned DEFAULT NULL,
  `ancestor_project_id` int unsigned DEFAULT NULL,
  `publish_matrix_media_only` tinyint unsigned NOT NULL DEFAULT '0',
  `publish_cc0` tinyint unsigned NOT NULL DEFAULT '0',
  `article_doi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `project_doi` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `article_doi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `project_doi` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nsf_funded` tinyint unsigned DEFAULT NULL,
  `disk_usage` bigint unsigned NOT NULL DEFAULT '0',
  `disk_usage_limit` bigint unsigned NOT NULL DEFAULT '0',
  `journal_in_press` int unsigned NOT NULL DEFAULT '0',
  `extinct_taxa_identified` tinyint unsigned DEFAULT NULL,
  `eol_taxon_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idigbio_taxon_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `eol_taxon_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idigbio_taxon_ids` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_personal_identifiable_info` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`project_id`),
  KEY `i_user_id` (`user_id`),
  KEY `i_created_on` (`created_on`),
  KEY `i_deleted` (`deleted`),
  KEY `fk_projects_group_id` (`group_id`),
  CONSTRAINT `fk_projects_group_id` FOREIGN KEY (`group_id`) REFERENCES `project_groups` (`group_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4091 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=4091 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects_x_users`
--

DROP TABLE IF EXISTS `projects_x_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects_x_users` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `membership_type` tinyint unsigned NOT NULL DEFAULT '0',
  `last_accessed_on` int unsigned DEFAULT NULL,
  `color` varchar(6) NOT NULL DEFAULT '',
  `vars` json DEFAULT NULL,
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `u_project_user_id` (`project_id`,`user_id`),
  KEY `i_user_id` (`user_id`),
  KEY `i_created_on` (`created_on`),
  KEY `fk_projects_x_users_project_id` (`project_id`),
  CONSTRAINT `fk_projects_x_users_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=28940 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=28940 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recent_change_stats`
--

DROP TABLE IF EXISTS `recent_change_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recent_change_stats` (
  `project_id` int NOT NULL,
  `rank` int NOT NULL,
  `category` varchar(30) NOT NULL,
  `taxa` int NOT NULL,
  `specimens` int NOT NULL,
  `media` int NOT NULL,
  `media_notes` int NOT NULL,
  `characters` int NOT NULL,
  `character_comments` int NOT NULL,
  `character_notes` int NOT NULL,
  `character_media` int NOT NULL,
  `character_media_labels` int NOT NULL,
  `cell_scorings` int NOT NULL,
  `cell_comments` int NOT NULL,
  `cell_notes` int NOT NULL,
  `rules` int NOT NULL,
  `docs` int NOT NULL,
  `refs` int NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`,`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resolved_taxonomy`
--

DROP TABLE IF EXISTS `resolved_taxonomy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `resolved_taxonomy` (
  `taxon_id` int unsigned NOT NULL AUTO_INCREMENT,
  `parent_id` int unsigned DEFAULT NULL,
  `taxonomic_rank` varchar(100) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `published_specimen_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`taxon_id`),
  KEY `i_parent_id` (`parent_id`),
  KEY `i_rank` (`taxonomic_rank`),
  KEY `i_name` (`name`),
  CONSTRAINT `fk_resolved_taxonomy_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `resolved_taxonomy` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30588 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=30588 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `specimens`
--

DROP TABLE IF EXISTS `specimens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `specimens` (
  `specimen_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL DEFAULT '0',
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `institution_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `collection_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `catalog_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `institution_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `collection_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `catalog_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `access` tinyint unsigned NOT NULL DEFAULT '0',
  `last_modified_on` int unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `reference_source` tinyint unsigned NOT NULL,
  `uuid` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `occurrence_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uuid` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `occurrence_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`specimen_id`),
  KEY `i_cat_no` (`catalog_number`),
  KEY `i_codes` (`institution_code`,`collection_code`),
  KEY `i_user_id` (`user_id`),
  KEY `i_project_id` (`project_id`),
  CONSTRAINT `fk_specimens_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=158126 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=158126 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `specimens_x_bibliographic_references`
--

DROP TABLE IF EXISTS `specimens_x_bibliographic_references`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `specimens_x_bibliographic_references` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `reference_id` int unsigned NOT NULL,
  `specimen_id` int unsigned NOT NULL,
  `pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `u_all` (`reference_id`,`specimen_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_specimens_x_bibliographic_references_specimen_id` (`specimen_id`),
  CONSTRAINT `fk_specimens_x_bibliographic_references_reference_id` FOREIGN KEY (`reference_id`) REFERENCES `bibliographic_references` (`reference_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_specimens_x_bibliographic_references_specimen_id` FOREIGN KEY (`specimen_id`) REFERENCES `specimens` (`specimen_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2467 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=2467 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_api`
--

DROP TABLE IF EXISTS `stats_api`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_api` (
  `stat_id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned DEFAULT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `api_type` varchar(100) NOT NULL,
  `created_on` int unsigned NOT NULL,
  PRIMARY KEY (`stat_id`),
  KEY `fk_stats_api_user_by_id` (`user_id`),
  KEY `i_project_id` (`project_id`),
  KEY `i_created_on` (`created_on`),
  KEY `i_api_type` (`api_type`),
  CONSTRAINT `fk_stats_api_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_stats_api_user_by_id` FOREIGN KEY (`user_id`) REFERENCES `ca_users` (`user_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=1333 DEFAULT CHARSET=utf8mb3;
) ENGINE=InnoDB AUTO_INCREMENT=1333 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_download_log`
--

DROP TABLE IF EXISTS `stats_download_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_download_log` (
  `session_key` char(32) NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `download_datetime` int unsigned NOT NULL,
  `download_type` char(1) NOT NULL,
  `project_id` int unsigned NOT NULL,
  `row_id` int unsigned DEFAULT NULL,
  KEY `i_stats_download_log_download_datetime` (`download_datetime`),
  KEY `i_session_key` (`session_key`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_login_log`
--

DROP TABLE IF EXISTS `stats_login_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_login_log` (
  `session_key` char(32) NOT NULL,
  `user_id` int unsigned NOT NULL,
  `datetime_started` int unsigned NOT NULL,
  `datetime_ended` int unsigned DEFAULT NULL,
  `ip_addr` char(15) NOT NULL,
  `user_agent` varchar(255) NOT NULL,
  KEY `i_stats_login_log_datetime_started` (`datetime_started`),
  KEY `i_stats_login_log_datetime_ended` (`datetime_ended`),
  KEY `i_session_key` (`session_key`),
  KEY `i_datetime` (`datetime_started`,`datetime_ended`),
  KEY `i_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_members_overview`
--

DROP TABLE IF EXISTS `stats_members_overview`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_members_overview` (
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `fname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `administrator` tinyint NOT NULL,
  `membership_status` tinyint NOT NULL,
  `member_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `member_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `member_role` tinyint NOT NULL,
  `last_access` int unsigned DEFAULT NULL,
  `last_access` int unsigned DEFAULT NULL,
  `taxa` int NOT NULL,
  `specimens` int NOT NULL,
  `media` int NOT NULL,
  `media_notes` int NOT NULL,
  `characters` int NOT NULL,
  `character_comments` int NOT NULL,
  `character_notes` int NOT NULL,
  `character_media` int NOT NULL,
  `character_media_labels` int NOT NULL,
  `cell_scorings` int NOT NULL,
  `cell_scorings_scored` int NOT NULL,
  `cell_scorings_npa` int NOT NULL,
  `cell_scorings_not` int NOT NULL,
  `cell_comments` int NOT NULL,
  `cell_notes` int NOT NULL,
  `cell_media` int NOT NULL,
  `cell_media_labels` int NOT NULL,
  `rules` int NOT NULL,
  `warnings` int NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`,`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_project_access`
--

DROP TABLE IF EXISTS `stats_project_access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_project_access` (
  `session_key` char(32) NOT NULL,
  `user_id` int unsigned NOT NULL,
  `project_id` int unsigned NOT NULL,
  `datetime_started` int unsigned NOT NULL,
  KEY `i_session_key` (`session_key`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_projects_overview`
--

DROP TABLE IF EXISTS `stats_projects_overview`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_projects_overview` (
  `project_id` int unsigned NOT NULL,
  `media` int unsigned DEFAULT NULL,
  `matrices` int unsigned DEFAULT NULL,
  `docs` int unsigned DEFAULT NULL,
  `folios` int unsigned DEFAULT NULL,
  `taxa` int unsigned DEFAULT NULL,
  `specimens` int unsigned DEFAULT NULL,
  `characters` int unsigned DEFAULT NULL,
  `media_size` bigint unsigned DEFAULT NULL,
  `matrix_cells_scored` int unsigned DEFAULT NULL,
  `matrix_cell_media` int unsigned DEFAULT NULL,
  `matrix_cell_media_labels` int unsigned DEFAULT NULL,
  `character_characters` int unsigned DEFAULT NULL,
  `character_media_characters` int unsigned DEFAULT NULL,
  `character_states` int unsigned DEFAULT NULL,
  `character_state_media` int unsigned DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `character_state_media_labels` int unsigned NOT NULL,
  `character_media_characters_labels` int unsigned NOT NULL,
  `media_audio` int unsigned DEFAULT NULL,
  `media_video` int unsigned DEFAULT NULL,
  `media_image` int unsigned DEFAULT NULL,
  `media_3d` int unsigned DEFAULT NULL,
  `character_unordered` int unsigned NOT NULL,
  PRIMARY KEY (`project_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_pub_download_log`
--

DROP TABLE IF EXISTS `stats_pub_download_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_pub_download_log` (
  `session_key` char(32) NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `download_datetime` int unsigned NOT NULL,
  `download_type` char(1) NOT NULL,
  `project_id` int unsigned NOT NULL,
  `row_id` int unsigned DEFAULT NULL,
  KEY `i_session_key` (`session_key`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_pub_hit_log`
--

DROP TABLE IF EXISTS `stats_pub_hit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_pub_hit_log` (
  `session_key` char(32) NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `hit_datetime` int unsigned NOT NULL,
  `hit_type` char(1) NOT NULL,
  `project_id` int unsigned NOT NULL,
  `row_id` int unsigned DEFAULT NULL,
  KEY `i_user_id` (`user_id`),
  KEY `i_hit_datetime` (`hit_datetime`),
  KEY `i_hit_type` (`hit_type`),
  KEY `i_project_id` (`project_id`),
  KEY `i_row_id` (`row_id`),
  KEY `i_session_key` (`session_key`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_session_log`
--

DROP TABLE IF EXISTS `stats_session_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_session_log` (
  `session_key` char(32) NOT NULL,
  `datetime_started` int unsigned NOT NULL,
  `datetime_ended` int unsigned DEFAULT NULL,
  `ip_addr` char(15) NOT NULL,
  `user_agent` varchar(255) NOT NULL,
  PRIMARY KEY (`session_key`),
  KEY `i_stats_session_log_datetime_started` (`datetime_started`),
  KEY `i_stats_session_log_datetime_ended` (`datetime_ended`),
  KEY `i_time` (`datetime_started`,`datetime_ended`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_taxa_overview`
--

DROP TABLE IF EXISTS `stats_taxa_overview`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_taxa_overview` (
  `project_id` int NOT NULL,
  `matrix_id` int NOT NULL,
  `taxon_id` int NOT NULL,
  `taxon_number` int NOT NULL,
  `taxon_name` varchar(100) NOT NULL,
  `unscored_cells` int NOT NULL,
  `scored_cells` int NOT NULL,
  `npa_cells` int NOT NULL,
  `not_cells` int NOT NULL,
  `cell_warnings` int NOT NULL,
  `cell_images` int NOT NULL,
  `cell_image_labels` int NOT NULL,
  `last_modified_on` int unsigned NOT NULL DEFAULT '0',
  `generated_on` int unsigned NOT NULL DEFAULT '0',
  `cells_scored_no_npa_cnotes_cmedia_ccitations` int unsigned NOT NULL,
  PRIMARY KEY (`project_id`,`matrix_id`,`taxon_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_upload_log`
--

DROP TABLE IF EXISTS `stats_upload_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_upload_log` (
  `session_key` char(32) NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `upload_datetime` int unsigned NOT NULL,
  `upload_type` char(1) NOT NULL,
  `project_id` int unsigned NOT NULL,
  `row_id` int unsigned NOT NULL,
  KEY `i_stats_upload_log_upload_datetime` (`upload_datetime`),
  KEY `i_session_key` (`session_key`),
  KEY `i_upload_type` (`upload_type`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stats_user_overview`
--

DROP TABLE IF EXISTS `stats_user_overview`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats_user_overview` (
  `project_id` int unsigned NOT NULL,
  `user_id` int unsigned NOT NULL,
  `temporal_type` tinyint unsigned NOT NULL,
  `taxa` int unsigned NOT NULL,
  `specimens` int unsigned NOT NULL,
  `media` int unsigned NOT NULL,
  `characters` int unsigned NOT NULL,
  `character_comments` int unsigned NOT NULL,
  `character_notes` int unsigned NOT NULL,
  `character_media` int unsigned NOT NULL,
  `character_media_labels` int unsigned NOT NULL,
  `cell_scorings` int unsigned NOT NULL,
  `cell_comments` int unsigned NOT NULL,
  `cell_notes` int unsigned NOT NULL,
  `rules` int unsigned NOT NULL,
  `documents` int unsigned NOT NULL,
  `citations` int unsigned NOT NULL,
  `last_accessed_on` int unsigned NOT NULL DEFAULT '0',
  `generated_on` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`project_id`,`user_id`,`temporal_type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `taxa`
--

DROP TABLE IF EXISTS `taxa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxa` (
  `taxon_id` int unsigned NOT NULL AUTO_INCREMENT,
  `genus` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `color` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `genus` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `color` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `user_id` int unsigned NOT NULL DEFAULT '0',
  `project_id` int unsigned NOT NULL DEFAULT '0',
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `specific_epithet` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `subspecific_epithet` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `scientific_name_author` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `specific_epithet` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `subspecific_epithet` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `scientific_name_author` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `scientific_name_year` smallint unsigned DEFAULT NULL,
  `supraspecific_clade` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_kingdom` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_phylum` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_class` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_order` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_family` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_superfamily` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_subfamily` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `supraspecific_clade` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_kingdom` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_phylum` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_class` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_order` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_family` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_superfamily` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_subfamily` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `is_extinct` tinyint unsigned NOT NULL DEFAULT '0',
  `use_parens_for_author` tinyint unsigned NOT NULL DEFAULT '0',
  `higher_taxon_subclass` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_subclass` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `access` tinyint unsigned NOT NULL DEFAULT '0',
  `last_modified_on` int unsigned NOT NULL DEFAULT '0',
  `created_on` int unsigned NOT NULL DEFAULT '0',
  `otu` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `higher_taxon_suborder` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_info` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `tmp_media_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otu` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `higher_taxon_suborder` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_info` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `tmp_media_url` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tmp_media_copyright_license` tinyint unsigned NOT NULL,
  `tmp_media_copyright_permission` tinyint unsigned NOT NULL,
  `tmp_media_copyright_info` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tmp_media_copyright_info` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `eol_pulled_on` int unsigned DEFAULT NULL,
  `eol_set_on` int unsigned DEFAULT NULL,
  `tmp_more_info_link` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `higher_taxon_subtribe` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_tribe` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_infraorder` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_superorder` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_cohort` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_infraclass` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `subgenus` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `taxon_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `tmp_more_info_link` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `higher_taxon_subtribe` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_tribe` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_infraorder` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_superorder` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_cohort` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `higher_taxon_infraclass` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `subgenus` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `taxon_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `tmp_eol_data` json DEFAULT NULL,
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `eol_no_results_on` int unsigned DEFAULT NULL,
  `lookup_failed_on` int unsigned DEFAULT NULL,
  `pbdb_taxon_id` int unsigned DEFAULT NULL,
  `pbdb_pulled_on` int unsigned DEFAULT NULL,
  `idigbio_pulled_on` int unsigned DEFAULT NULL,
  `idigbio_set_on` int unsigned DEFAULT NULL,
  `idigbio_no_results_on` int unsigned DEFAULT NULL,
  `tmp_idigbio_data` json DEFAULT NULL,
  PRIMARY KEY (`taxon_id`),
  UNIQUE KEY `u_all` (`project_id`,`taxon_hash`(16)),
  KEY `i_user_id` (`user_id`),
  KEY `i_higher_taxon_family` (`higher_taxon_family`),
  KEY `i_higher_taxon_superfamily` (`higher_taxon_superfamily`),
  KEY `i_subclass` (`higher_taxon_subclass`),
  KEY `i_created_on` (`created_on`),
  CONSTRAINT `fk_taxa_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=995044 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=995044 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `taxa_x_bibliographic_references`
--

DROP TABLE IF EXISTS `taxa_x_bibliographic_references`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxa_x_bibliographic_references` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `reference_id` int unsigned NOT NULL,
  `taxon_id` int unsigned NOT NULL,
  `pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `pp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`link_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_taxa_x_bibliographic_references_reference_id` (`reference_id`),
  KEY `fk_taxa_x_bibliographic_references_taxon_id` (`taxon_id`),
  CONSTRAINT `fk_taxa_x_bibliographic_references_reference_id` FOREIGN KEY (`reference_id`) REFERENCES `bibliographic_references` (`reference_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_taxa_x_bibliographic_references_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=907 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
) ENGINE=InnoDB AUTO_INCREMENT=907 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `taxa_x_media`
--

DROP TABLE IF EXISTS `taxa_x_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxa_x_media` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `taxon_id` int unsigned NOT NULL DEFAULT '0',
  `media_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned DEFAULT NULL,
  `created_on` int unsigned NOT NULL,
  PRIMARY KEY (`link_id`),
  KEY `u_all` (`taxon_id`,`media_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_taxa_x_media_media_id` (`media_id`),
  CONSTRAINT `fk_taxa_x_media_media_id` FOREIGN KEY (`media_id`) REFERENCES `media_files` (`media_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_taxa_x_media_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30179 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=30179 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `taxa_x_partitions`
--

DROP TABLE IF EXISTS `taxa_x_partitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxa_x_partitions` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `partition_id` int unsigned NOT NULL DEFAULT '0',
  `taxon_id` int unsigned NOT NULL DEFAULT '0',
  `user_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`link_id`),
  UNIQUE KEY `u_all` (`partition_id`,`taxon_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_taxa_x_partitions_taxon_id` (`taxon_id`),
  CONSTRAINT `fk_taxa_x_partitions_project_id` FOREIGN KEY (`partition_id`) REFERENCES `partitions` (`partition_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_taxa_x_partitions_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=68255 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=68255 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `taxa_x_resolved_taxonomy`
--

DROP TABLE IF EXISTS `taxa_x_resolved_taxonomy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxa_x_resolved_taxonomy` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `taxon_id` int unsigned NOT NULL,
  `resolved_taxon_id` int unsigned NOT NULL,
  PRIMARY KEY (`link_id`),
  KEY `fk_taxa_x_resolved_taxonomy_taxon_id` (`taxon_id`),
  KEY `fk_taxa_x_resolved_taxonomy_resolved_taxon_id` (`resolved_taxon_id`),
  CONSTRAINT `fk_taxa_x_resolved_taxonomy_resolved_taxon_id` FOREIGN KEY (`resolved_taxon_id`) REFERENCES `resolved_taxonomy` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  KEY `fk_taxa_x_resolved_taxonomy_resolved_taxon_id` (`resolved_taxon_id`),
  CONSTRAINT `fk_taxa_x_resolved_taxonomy_resolved_taxon_id` FOREIGN KEY (`resolved_taxon_id`) REFERENCES `resolved_taxonomy` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_taxa_x_resolved_taxonomy_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31548 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=31548 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `taxa_x_specimens`
--

DROP TABLE IF EXISTS `taxa_x_specimens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxa_x_specimens` (
  `link_id` int unsigned NOT NULL AUTO_INCREMENT,
  `taxon_id` int unsigned NOT NULL DEFAULT '0',
  `specimen_id` int unsigned NOT NULL DEFAULT '0',
  `notes` text NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`link_id`),
  KEY `u_all` (`taxon_id`,`specimen_id`),
  KEY `i_user_id` (`user_id`),
  KEY `fk_taxa_x_specimens_specimen_id` (`specimen_id`),
  CONSTRAINT `fk_taxa_x_specimens_specimen_id` FOREIGN KEY (`specimen_id`) REFERENCES `specimens` (`specimen_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_taxa_x_specimens_taxon_id` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=152529 DEFAULT CHARSET=latin1;
) ENGINE=InnoDB AUTO_INCREMENT=152529 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `taxon_overview_stats`
--

DROP TABLE IF EXISTS `taxon_overview_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxon_overview_stats` (
  `project_id` int NOT NULL,
  `matrix_id` int NOT NULL,
  `taxon_id` int NOT NULL,
  `taxon_number` int NOT NULL,
  `taxon_name` varchar(100) NOT NULL,
  `unscored_cells` int NOT NULL,
  `scored_cells` int NOT NULL,
  `npa_cells` int NOT NULL,
  `not_cells` int NOT NULL,
  `cell_warnings` int NOT NULL,
  `cell_images` int NOT NULL,
  `cell_image_labels` int NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`,`matrix_id`,`taxon_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `taxon_ranks`
--

DROP TABLE IF EXISTS `taxon_ranks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `taxon_ranks` (
  `rank_id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `rankname` varchar(255) NOT NULL DEFAULT '',
  `rank` smallint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`rank_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2024-03-11 23:05:49