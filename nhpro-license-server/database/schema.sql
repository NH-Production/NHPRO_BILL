-- ============================================================
-- NH Production License Server - Database Schema
-- Database: nhpro_license_server
-- Created: 2024
-- Author: NH Production <support@nhpro.id>
-- ============================================================

CREATE DATABASE IF NOT EXISTS `nhpro_license_server`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `nhpro_license_server`;

-- ============================================================
-- TABLE: licenses
-- Menyimpan data lisensi yang diterbitkan
-- ============================================================
CREATE TABLE IF NOT EXISTS `licenses` (
  `id`                INT(11) NOT NULL AUTO_INCREMENT,
  `license_key`       VARCHAR(34) NOT NULL COMMENT 'Format: NHPRO-XXXX-XXXX-XXXX-XXXX',
  `customer_name`     VARCHAR(150) NOT NULL,
  `customer_email`    VARCHAR(150) NOT NULL,
  `customer_phone`    VARCHAR(25) DEFAULT NULL,
  `plan`              ENUM('starter','professional','enterprise') NOT NULL DEFAULT 'starter',
  `max_pelanggan`     INT(11) NOT NULL DEFAULT 100 COMMENT 'Batas jumlah pelanggan di SimBill',
  `features`          JSON DEFAULT NULL COMMENT 'Fitur yang diaktifkan untuk plan ini',
  `status`            ENUM('active','suspended','expired','revoked') NOT NULL DEFAULT 'active',
  `issued_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expired_at`        DATETIME DEFAULT NULL COMMENT 'NULL = lifetime license',
  `grace_period_days` INT(11) NOT NULL DEFAULT 3 COMMENT 'Hari toleransi setelah expired sebelum benar-benar diblokir',
  `notes`             TEXT DEFAULT NULL COMMENT 'Catatan internal admin',
  `created_by`        VARCHAR(50) DEFAULT NULL COMMENT 'Username admin yang membuat',
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_license_key` (`license_key`),
  KEY `idx_status` (`status`),
  KEY `idx_plan` (`plan`),
  KEY `idx_customer_email` (`customer_email`),
  KEY `idx_expired_at` (`expired_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabel utama lisensi NH Production';

-- ============================================================
-- TABLE: license_activations
-- Menyimpan data aktivasi per perangkat (HWID)
-- ============================================================
CREATE TABLE IF NOT EXISTS `license_activations` (
  `id`               INT(11) NOT NULL AUTO_INCREMENT,
  `license_id`       INT(11) NOT NULL,
  `hwid`             VARCHAR(100) NOT NULL COMMENT 'Hardware ID unik dari perangkat klien',
  `app_name`         VARCHAR(50) DEFAULT NULL COMMENT 'Nama aplikasi (e.g. SimBill)',
  `app_url`          VARCHAR(255) DEFAULT NULL COMMENT 'URL aplikasi yang diinstall',
  `app_version`      VARCHAR(20) DEFAULT NULL COMMENT 'Versi aplikasi saat aktivasi',
  `ip_address`       VARCHAR(45) DEFAULT NULL COMMENT 'IP saat pertama aktivasi',
  `hostname`         VARCHAR(100) DEFAULT NULL COMMENT 'Hostname server klien',
  `activated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen`        DATETIME DEFAULT NULL COMMENT 'Terakhir kali validasi berhasil',
  `last_ip`          VARCHAR(45) DEFAULT NULL COMMENT 'IP terakhir saat validasi',
  `status`           ENUM('active','deactivated') NOT NULL DEFAULT 'active',
  `deactivated_at`   DATETIME DEFAULT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_license_hwid` (`license_id`, `hwid`),
  KEY `idx_license_id` (`license_id`),
  KEY `idx_hwid` (`hwid`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_activation_license`
    FOREIGN KEY (`license_id`) REFERENCES `licenses` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Aktivasi lisensi per perangkat HWID';

-- ============================================================
-- TABLE: license_events
-- Audit log semua event lisensi
-- ============================================================
CREATE TABLE IF NOT EXISTS `license_events` (
  `id`          BIGINT(20) NOT NULL AUTO_INCREMENT,
  `license_id`  INT(11) NOT NULL,
  `hwid`        VARCHAR(100) DEFAULT NULL,
  `event`       ENUM('activate','validate','validate_fail','deactivate','extend','revoke','suspend','reactivate') NOT NULL,
  `ip_address`  VARCHAR(45) DEFAULT NULL,
  `detail`      TEXT DEFAULT NULL COMMENT 'Detail tambahan / alasan event',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_license_id` (`license_id`),
  KEY `idx_event` (`event`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_hwid` (`hwid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit log semua event pada lisensi';

-- ============================================================
-- TABLE: admin_users
-- Akun administrator dashboard
-- ============================================================
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `username`    VARCHAR(50) NOT NULL,
  `password`    VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
  `email`       VARCHAR(150) DEFAULT NULL,
  `role`        ENUM('superadmin','operator') NOT NULL DEFAULT 'operator',
  `last_login`  DATETIME DEFAULT NULL,
  `active`      TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_username` (`username`),
  KEY `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Akun admin dashboard license server';

-- ============================================================
-- TABLE: api_keys
-- API Key untuk integrasi sistem eksternal
-- ============================================================
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id`           INT(11) NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(100) NOT NULL COMMENT 'Nama / deskripsi penggunaan API key',
  `api_key`      VARCHAR(64) NOT NULL COMMENT 'Random hex 64 karakter',
  `permissions`  JSON DEFAULT NULL COMMENT 'Array permission: ["validate","read_license","write_license"]',
  `active`       TINYINT(1) NOT NULL DEFAULT 1,
  `last_used`    DATETIME DEFAULT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_api_key` (`api_key`),
  KEY `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='API Keys untuk integrasi sistem lain';

-- ============================================================
-- TABLE: settings
-- Konfigurasi sistem license server
-- ============================================================
CREATE TABLE IF NOT EXISTS `settings` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `key`         VARCHAR(100) NOT NULL,
  `value`       TEXT DEFAULT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Pengaturan sistem';

-- ============================================================
-- DEFAULT DATA: Admin Users
-- Password: NHpro2024!  (bcrypt hash generated)
-- PENTING: Ganti password setelah deploy pertama!
-- ============================================================
INSERT INTO `admin_users` (`username`, `password`, `email`, `role`, `active`) VALUES
(
  'nhadmin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HSauFYi',
  'admin@nhpro.id',
  'superadmin',
  1
);

-- ============================================================
-- DEFAULT DATA: Settings
-- ============================================================
INSERT INTO `settings` (`key`, `value`, `description`) VALUES
('app_name',          'NH Production License Server', 'Nama aplikasi license server'),
('app_version',       '1.0.0',                        'Versi license server'),
('validate_interval', '86400',                        'Interval validasi dalam detik (default 24 jam)'),
('max_activations',   '1',                            'Maksimum aktivasi per license key'),
('grace_period_days', '3',                            'Hari grace period global default'),
('plan_starter_max',  '100',                          'Batas pelanggan plan Starter'),
('plan_pro_max',      '500',                          'Batas pelanggan plan Professional'),
('plan_ent_max',      '99999',                        'Batas pelanggan plan Enterprise'),
('maintenance_mode',  '0',                            '1 = Maintenance mode aktif (semua validate return error)'),
('contact_email',     'support@nhpro.id',             'Email support NH Production');

-- ============================================================
-- DEFAULT DATA: Plans features reference
-- ============================================================
-- Starter Features
-- { "multi_user": false, "laporan_advanced": false, "backup_cloud": false, "api_access": false, "whatsapp_notif": false }
-- Professional Features
-- { "multi_user": true, "laporan_advanced": true, "backup_cloud": false, "api_access": true, "whatsapp_notif": true }
-- Enterprise Features
-- { "multi_user": true, "laporan_advanced": true, "backup_cloud": true, "api_access": true, "whatsapp_notif": true, "custom_domain": true, "priority_support": true }

-- ============================================================
-- VIEWS: Useful views for reporting
-- ============================================================

-- View: license dengan info aktivasi
CREATE OR REPLACE VIEW `v_licenses_with_activation` AS
SELECT
  l.id,
  l.license_key,
  l.customer_name,
  l.customer_email,
  l.customer_phone,
  l.plan,
  l.max_pelanggan,
  l.status,
  l.issued_at,
  l.expired_at,
  l.grace_period_days,
  l.notes,
  l.created_by,
  l.created_at,
  COUNT(la.id) AS activation_count,
  MAX(la.last_seen) AS last_seen,
  GROUP_CONCAT(la.hwid SEPARATOR ', ') AS active_hwids
FROM `licenses` l
LEFT JOIN `license_activations` la ON la.license_id = l.id AND la.status = 'active'
GROUP BY l.id;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
