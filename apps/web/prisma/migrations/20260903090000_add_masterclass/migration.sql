-- Masterclass mensuelle : la session du mois, ses inscriptions, et l'historique.
--
-- Aucune remise à zéro n'est stockée : la « prochaine Masterclass » se déduit de
-- `scheduled_at`, et le 1er du mois n'a donc rien à déclencher pour que le site
-- bascule sur la session suivante.

-- CreateTable
CREATE TABLE `masterclasses` (
    `id` VARCHAR(191) NOT NULL,
    `monthKey` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `instructor` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `duration` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `coverImage` VARCHAR(191) NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `priceEur` DECIMAL(10, 2) NULL,
    `capacity` INTEGER NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `masterclasses_monthKey_key`(`monthKey`),
    INDEX `masterclasses_status_scheduledAt_idx`(`status`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `masterclass_registrations` (
    `id` VARCHAR(191) NOT NULL,
    `masterclassId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW') NOT NULL DEFAULT 'PENDING',
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MGA',
    `registeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `confirmationEmailSentAt` DATETIME(3) NULL,
    `confirmationEmailError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `masterclass_registrations_orderId_key`(`orderId`),
    UNIQUE INDEX `masterclass_registrations_masterclassId_userId_key`(`masterclassId`, `userId`),
    INDEX `masterclass_registrations_masterclassId_status_idx`(`masterclassId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable : la ligne de commande qui porte une place de Masterclass.
ALTER TABLE `order_items` ADD COLUMN `masterclassId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_masterclassId_fkey` FOREIGN KEY (`masterclassId`) REFERENCES `masterclasses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `masterclass_registrations` ADD CONSTRAINT `masterclass_registrations_masterclassId_fkey` FOREIGN KEY (`masterclassId`) REFERENCES `masterclasses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `masterclass_registrations` ADD CONSTRAINT `masterclass_registrations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey : effacer une commande ne doit pas emporter l'inscription — c'est
-- l'historique de participation, pas une écriture comptable.
ALTER TABLE `masterclass_registrations` ADD CONSTRAINT `masterclass_registrations_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
