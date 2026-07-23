-- ===========================================================================
-- Aqua Track — une seule catégorie par nom et par kiosque
-- ---------------------------------------------------------------------------
-- À lancer UNE FOIS dans le SQL Editor, après les migrations précédentes.
--
-- POURQUOI. Chaque appareil sème ses catégories par défaut avec des
-- identifiants tirés au hasard. Deux appareils sur le même kiosque créaient
-- donc deux « Camion d'eau » DISTINCTS, tous deux valides. Le code applicatif
-- s'efforce déjà de l'éviter, mais rien ne l'INTERDISAIT au niveau de la base.
--
-- Ce fichier fait deux choses :
--   1. il fusionne les doublons vivants déjà présents (survivant = plus petit
--      identifiant, comme le fait le client), en repointant les dépenses ;
--   2. il pose un index unique : désormais la base REFUSE une seconde
--      catégorie vivante de même nom dans un même kiosque.
-- ===========================================================================

-- 1. Repointer les dépenses des doublons vers la catégorie survivante.
with survivants as (
  select kiosque_id, lower(nom) as nom_bas, min(id::text)::uuid as garde
  from public.categories
  where deleted = false
  group by kiosque_id, lower(nom)
),
doublons as (
  select c.id as ancien, s.garde
  from public.categories c
  join survivants s
    on s.kiosque_id = c.kiosque_id
   and s.nom_bas = lower(c.nom)
  where c.deleted = false
    and c.id <> s.garde
)
update public.depenses d
set category_id = doublons.garde,
    updated_at  = now()
from doublons
where d.category_id = doublons.ancien;

-- 2. Marquer les doublons comme supprimés (suppression logique : elle se
--    propage aux appareils, qui retireront la ligne en trop).
with survivants as (
  select kiosque_id, lower(nom) as nom_bas, min(id::text)::uuid as garde
  from public.categories
  where deleted = false
  group by kiosque_id, lower(nom)
)
update public.categories c
set deleted    = true,
    updated_at = now()
from survivants s
where c.deleted = false
  and s.kiosque_id = c.kiosque_id
  and s.nom_bas = lower(c.nom)
  and c.id <> s.garde;

-- 3. Le verrou. Partiel (`where deleted = false`) : deux catégories SUPPRIMÉES
--    de même nom peuvent coexister — ce sont des tombes — mais une seule
--    vivante par nom et par kiosque. `lower(nom)` : « Bouchon » et « bouchon »
--    comptent pour le même.
create unique index if not exists categories_kiosque_nom_unique
  on public.categories (kiosque_id, lower(nom))
  where deleted = false;

-- Vérification (facultatif) : doit renvoyer 0 ligne.
-- select kiosque_id, lower(nom), count(*)
--   from public.categories where deleted = false
--   group by kiosque_id, lower(nom) having count(*) > 1;
