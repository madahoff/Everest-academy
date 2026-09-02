-- Nombre de modules annoncés par le Pack Premium sur la durée de l'offre (l'année).
--
-- Le catalogue sait compter les cours PUBLIÉS ; il ne peut pas deviner le programme
-- annoncé, dont une partie n'est pas encore parue au moment de l'achat. C'est un
-- argument commercial, réglé depuis la console d'administration.
--
-- NULL = on annonce ce qui est publié, comportement d'avant cette colonne.

ALTER TABLE `premium_plan` ADD COLUMN `announcedCourseCount` INT NULL;
