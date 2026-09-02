-- Pack Premium : achat unique qui ouvre l'intégralité du catalogue.

-- AlterTable: date d'acquisition du pack (affichage uniquement ; `plan` porte l'accès)
ALTER TABLE `users` ADD COLUMN `premiumSince` DATETIME(3) NULL;

-- AlterTable: marque la ligne de commande « Pack Premium », qui n'est ni un cours
-- ni un produit. Explicite, pour que l'octroi des accès n'ait pas à déduire la
-- nature d'un article de l'absence de ses deux identifiants.
ALTER TABLE `order_items` ADD COLUMN `isPremiumPack` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: tarif du Pack Premium, piloté depuis la console d'administration.
-- Ligne unique d'identifiant `default` ; la valeur initiale reste modifiable ensuite.
CREATE TABLE `premium_plan` (
    `id` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `premium_plan` (`id`, `price`, `active`, `updatedAt`)
VALUES ('default', 199000.00, true, CURRENT_TIMESTAMP(3));
