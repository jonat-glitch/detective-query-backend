-- ======================================================
-- DETECTIVE QUERY DATABASE BACKUP
-- Database: detective_query_playground
-- Date: 2026-11-06T08:35:17.186Z
-- ======================================================

CREATE DATABASE IF NOT EXISTS `detective_query_playground`;
USE `detective_query_playground`;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `evidence`;
CREATE TABLE `evidence` (
  `evidence_id` int NOT NULL AUTO_INCREMENT,
  `item_name` varchar(100) NOT NULL,
  `severity` int DEFAULT '1',
  `location_id` int DEFAULT NULL,
  `collected_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`evidence_id`) ,
  KEY `fk_1` (`location_id`),
  FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

INSERT INTO `evidence` (`evidence_id`, `item_name`, `severity`, `location_id`, `collected_at`) VALUES 
(1, 'Broken Knife', 4, 2, '2026-09-01 02:00:00'),
(2, 'Surveillance Tape', 3, 4, '2026-09-02 06:00:00'),
(3, 'Bloody Glove', 5, 1, '2026-09-03 00:30:00'),
(4, 'Receipt Paper', 1, 3, '2026-09-04 04:00:00'),
(5, 'Crowbar', 3, 5, '2026-09-05 01:15:00'),
(6, 'Security Footprint', 4, 2, '2026-09-06 03:00:00');
DROP TABLE IF EXISTS `locations`;
CREATE TABLE `locations` (
  `location_id` int NOT NULL AUTO_INCREMENT,
  `place_name` varchar(100) NOT NULL,
  `district` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`location_id`) 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

INSERT INTO `locations` (`location_id`, `place_name`, `district`, `is_active`) VALUES 
(1, 'City Hall', 'Downtown', 1),
(2, 'Central Warehouse', 'Industrial Zone', 1),
(3, 'Riverside Park', 'Northside', 1),
(4, 'Police HQ', 'Central', 1),
(5, 'Abandoned Factory', 'Southside', 0),
(6, 'Harbor Pier', 'Waterfront', 1);
DROP TABLE IF EXISTS `officers`;
CREATE TABLE `officers` (
  `officer_id` int NOT NULL AUTO_INCREMENT,
  `badge_number` varchar(20) NOT NULL,
  `name` varchar(100) NOT NULL,
  `rank_level` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`officer_id`) ,
  UNIQUE KEY `badge_number` (`badge_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

INSERT INTO `officers` (`officer_id`, `badge_number`, `name`, `rank_level`) VALUES 
(1, 'B-001', 'Officer Santos', 'Detective'),
(2, 'B-002', 'Officer Reyes', 'Sergeant'),
(3, 'B-003', 'Officer Lim', 'Junior Officer');
DROP TABLE IF EXISTS `suspects`;
CREATE TABLE `suspects` (
  `suspect_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `age` int DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Under Investigation',
  PRIMARY KEY (`suspect_id`) 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

INSERT INTO `suspects` (`suspect_id`, `name`, `age`, `status`) VALUES 
(1, 'Marcus Webb', 32, 'Under Investigation'),
(2, 'Lena Torres', 28, 'Under Investigation'),
(3, 'Victor Hale', 45, 'Cleared'),
(4, 'Diana Cruz', 39, 'Arrested'),
(5, 'Ethan Ford', 23, 'Under Investigation');
DROP TABLE IF EXISTS `witnesses`;
CREATE TABLE `witnesses` (
  `witness_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`witness_id`) 
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30002;

INSERT INTO `witnesses` (`witness_id`, `full_name`, `contact_number`) VALUES 
(1, 'Carmen Sia', '09171234567'),
(2, 'Roberto Ngo', '09281234567'),
(3, 'Felicia Park', '09391234567');

SET FOREIGN_KEY_CHECKS = 1;