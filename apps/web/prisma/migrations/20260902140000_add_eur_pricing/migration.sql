-- Tarification internationale : un second prix, en euros, pour les visiteurs
-- situés hors de Madagascar.
--
-- Colonnes NULLABLES et laissées vides à la migration : un tarif en euros est une
-- décision commerciale, pas une conversion. Tant qu'il n'est pas saisi depuis la
-- console d'administration, l'article n'est simplement pas proposé à l'achat hors
-- de Madagascar — préférable à une conversion inventée par le code.
--
-- Les montants sont des EUROS ENTIERS : Vanilla Pay reçoit le nombre tel quel avec
-- `devise: EUR`, et le Wallet API applique son taux EUR→MGA dessus. Des centimes y
-- seraient lus comme des euros. La colonne reste en DECIMAL(10,2) par symétrie avec
-- `price`, la contrainte étant appliquée à l'écriture (API d'administration) et
-- avant tout paiement.

ALTER TABLE `courses` ADD COLUMN `priceEur` DECIMAL(10, 2) NULL;

ALTER TABLE `products` ADD COLUMN `priceEur` DECIMAL(10, 2) NULL;

ALTER TABLE `premium_plan` ADD COLUMN `priceEur` DECIMAL(10, 2) NULL;
