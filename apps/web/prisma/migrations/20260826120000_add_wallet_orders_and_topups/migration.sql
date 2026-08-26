-- AlterTable: identifiant du portefeuille Wallet API (support / diagnostic uniquement)
ALTER TABLE `users` ADD COLUMN `walletId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MGA',
    `method` ENUM('WALLET', 'MOBILE_MONEY', 'CARD') NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paymentReference` VARCHAR(191) NULL,
    `paymentUrl` TEXT NULL,
    `ledgerEntryId` VARCHAR(191) NULL,
    `failureReason` TEXT NULL,
    `paidAt` DATETIME(3) NULL,
    `grantedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_paymentReference_key`(`paymentReference`),
    INDEX `orders_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,

    INDEX `order_items_orderId_idx`(`orderId`),
    INDEX `order_items_courseId_idx`(`courseId`),
    INDEX `order_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_topups` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MGA',
    `method` ENUM('WALLET', 'MOBILE_MONEY', 'CARD') NOT NULL,
    `status` ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'INITIATED',
    `settled` BOOLEAN NOT NULL DEFAULT false,
    `settlementError` TEXT NULL,
    `paymentUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wallet_topups_reference_key`(`reference`),
    INDEX `wallet_topups_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_topups` ADD CONSTRAINT `wallet_topups_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
