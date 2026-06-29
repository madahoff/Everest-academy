-- AlterTable
ALTER TABLE `users` ADD COLUMN `passwordChangedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `verification_links` MODIFY `purpose` ENUM('SIGNUP', 'LOGIN', 'RESET_PASSWORD') NOT NULL;

-- AlterTable
ALTER TABLE `auth_audit_logs` MODIFY `purpose` ENUM('SIGNUP', 'LOGIN', 'RESET_PASSWORD') NOT NULL;
