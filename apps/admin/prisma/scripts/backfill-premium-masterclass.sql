-- ─────────────────────────────────────────────────────────────────────────────
-- Rattrapage : inscrit tous les membres du Pack Premium à toutes les Masterclass
-- PUBLIÉES à venir.
--
-- À QUOI ÇA SERT
-- Le pack ouvre toutes les Masterclass, et la console le fait désormais d'office dans
-- les deux sens (séance publiée après l'octroi du pack, pack accordé après la
-- publication d'une séance — voir `apps/admin/lib/masterclass.ts`). Ce script ne sert
-- qu'aux comptes passés en Premium AVANT que cet automatisme n'existe.
--
-- Le bouton « Inscrire les membres Premium » de la console Masterclass fait
-- exactement la même chose, en affichant le décompte. Ce fichier existe pour pouvoir
-- le faire SANS REDÉPLOYER, directement sur la base.
--
-- CE QU'IL NE FAIT PAS
--  - il ne touche AUCUNE inscription existante : une place déjà payée garde son
--    montant, une place annulée par le membre reste annulée ;
--  - il n'envoie AUCUN e-mail (les confirmations se renvoient ligne par ligne depuis
--    la console) ;
--  - il ignore les brouillons, les séances archivées et les séances déjà tenues.
--
-- Idempotent : le relancer n'insère rien de plus (contrainte d'unicité
-- (masterclassId, userId), doublée du NOT EXISTS ci-dessous).
--
-- USAGE
--   docker exec -i <conteneur-mysql> mysql -u<user> -p<mot-de-passe> <base> \
--     < apps/admin/prisma/scripts/backfill-premium-masterclass.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Ce qui VA être créé. À lire avant, pour ne pas découvrir le volume après coup.
SELECT
    m.monthKey                       AS mois,
    m.title                          AS seance,
    COUNT(*)                         AS inscriptions_a_creer
FROM masterclasses m
JOIN users u ON u.plan = 'PREMIUM'
WHERE m.status = 'PUBLISHED'
  AND m.scheduledAt >= NOW()
  AND NOT EXISTS (
      SELECT 1 FROM masterclass_registrations r
      WHERE r.masterclassId = m.id AND r.userId = u.id
  )
GROUP BY m.id, m.monthKey, m.title
ORDER BY m.scheduledAt;

-- L'inscription elle-même. `amount = 0` : la place a été payée avec le pack, elle ne
-- crée aucune recette propre. Le préfixe `bkf` de l'identifiant rend ces lignes
-- reconnaissables en cas de vérification.
INSERT INTO masterclass_registrations
    (id, masterclassId, userId, status, amount, currency, registeredAt, confirmedAt, createdAt, updatedAt)
SELECT
    LOWER(CONCAT('bkf', HEX(RANDOM_BYTES(11)))),
    m.id,
    u.id,
    'CONFIRMED',
    0,
    'MGA',
    NOW(3),
    NOW(3),
    NOW(3),
    NOW(3)
FROM masterclasses m
JOIN users u ON u.plan = 'PREMIUM'
WHERE m.status = 'PUBLISHED'
  AND m.scheduledAt >= NOW()
  AND NOT EXISTS (
      SELECT 1 FROM masterclass_registrations r
      WHERE r.masterclassId = m.id AND r.userId = u.id
  );

-- Quittance : plus aucune ligne attendue ici après le passage.
SELECT COUNT(*) AS restant_a_inscrire
FROM masterclasses m
JOIN users u ON u.plan = 'PREMIUM'
WHERE m.status = 'PUBLISHED'
  AND m.scheduledAt >= NOW()
  AND NOT EXISTS (
      SELECT 1 FROM masterclass_registrations r
      WHERE r.masterclassId = m.id AND r.userId = u.id
  );
