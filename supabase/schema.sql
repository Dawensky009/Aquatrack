-- ===========================================================================
-- Aqua Track — schéma Supabase
-- ---------------------------------------------------------------------------
-- ⚠️ INSTALLATION NEUVE UNIQUEMENT.
--
--    Si vous avez déjà exécuté une version antérieure de ce fichier, lancez
--    `migration-partage.sql` À LA PLACE : il adapte les tables existantes sans
--    rien perdre. Exécuter les deux n'est pas nécessaire.
--
-- ⚠️ Ce fichier NE CONTIENT PAS le partage entre plusieurs comptes.
--    Il isole les données par compte — un employé qui crée son compte ouvrirait
--    une application vide. Pour partager un kiosque à plusieurs, exécutez
--    ensuite `migration-partage.sql`.
--
-- ---------------------------------------------------------------------------
-- À exécuter UNE FOIS dans l'éditeur SQL de votre projet Supabase.
-- Le script est réexécutable sans risque : rien n'est détruit.
--
-- Rappel d'architecture : cette base n'est PAS la source de vérité. Elle est
-- une sauvegarde distante d'IndexedDB, qui vit sur le téléphone. L'app
-- fonctionne intégralement sans elle, et sans connexion.
--
-- Les colonnes reprennent exactement la forme des objets stockés en local,
-- pour que la synchronisation soit un simple upsert sans transformation.
-- ===========================================================================


-- ===========================================================================
-- 1. TABLES
-- ===========================================================================

-- --- Journées (revenus) ----------------------------------------------------
-- Une ligne par jour d'activité.
create table if not exists public.journees (
  id              uuid primary key,
  user_id         uuid        not null default auth.uid()
                              references auth.users(id) on delete cascade,
  date            date        not null,
  montant         numeric     not null default 0,
  moncash         numeric     not null default 0,

  -- Figés à la saisie, jamais recalculés. Modifier le prix de vente courant
  -- ne doit pas réécrire l'historique.
  gallons         numeric     not null default 0,
  prix_reference  numeric     not null,

  -- 'estime'   : gallons déduits du montant (montant / prix)
  -- 'compteur' : gallons relevés sur le compteur physique
  gallons_source  text        not null default 'estime'
                  check (gallons_source in ('estime', 'compteur')),
  releve_compteur numeric,

  note            text        not null default '',
  updated_at      timestamptz not null default now(),
  deleted         boolean     not null default false
);

-- L'unicité porte sur le COUPLE (compte, date), pas sur la date seule.
-- Avec une contrainte globale, un second utilisateur ne pourrait pas clôturer
-- une journée déjà clôturée par le premier.
alter table public.journees drop constraint if exists journees_date_key;
alter table public.journees drop constraint if exists journees_user_date_unique;
alter table public.journees add  constraint journees_user_date_unique unique (user_id, date);


-- --- Dépenses --------------------------------------------------------------
create table if not exists public.depenses (
  id              uuid primary key,
  user_id         uuid        not null default auth.uid()
                              references auth.users(id) on delete cascade,

  -- `occurred_at` est la date de l'opération (éditable), `recorded_at` celle
  -- de la première saisie. Tous les agrégats utilisent la première : un camion
  -- reçu hier et saisi ce matin doit compter pour hier.
  occurred_at     timestamptz not null,
  recorded_at     timestamptz not null default now(),

  category_id     uuid        not null,

  -- Ce qui a été acheté : « Bouchons », « Pompe »… Vide pour un
  -- réapprovisionnement, dont le libellé est la catégorie elle-même.
  designation     text        not null default '',

  -- Pour un réapprovisionnement : gallons reçus.
  -- Pour du matériel : nombre d'articles.
  quantity        numeric,
  unit_price      numeric,
  total           numeric     not null,

  entry_mode      text check (entry_mode in ('forfait', 'unitaire')),
  payment_method  text        not null default 'cash'
                  check (payment_method in ('cash', 'moncash')),

  note            text        not null default '',
  updated_at      timestamptz not null default now(),
  deleted         boolean     not null default false
);


-- --- Catégories de dépenses ------------------------------------------------
create table if not exists public.categories (
  id            uuid primary key,
  user_id       uuid        not null default auth.uid()
                            references auth.users(id) on delete cascade,
  nom           text        not null,
  color         text        not null,
  unit          text        not null default 'montant',
  -- Marque les catégories d'approvisionnement : ce sont elles qui portent les
  -- gallons reçus et donc le coût de revient.
  suit_gallons  boolean     not null default false,
  position      integer     not null default 0,
  updated_at    timestamptz not null default now(),
  deleted       boolean     not null default false
);


-- --- Reçus -----------------------------------------------------------------
-- Métadonnées seulement. Les images vivent dans Supabase Storage (section 4) :
-- une base Postgres n'est pas faite pour héberger des photos, et le plan
-- gratuit plafonne à 500 Mo.
create table if not exists public.recus (
  id              uuid primary key,
  user_id         uuid        not null default auth.uid()
                              references auth.users(id) on delete cascade,
  depense_id      uuid        not null,
  nom             text        not null default '',
  mime            text        not null default 'image/jpeg',
  taille          integer,
  largeur         integer,
  hauteur         integer,
  -- Chemin dans le seau de stockage. Reste NULL tant que l'image n'est pas
  -- montée : c'est ce champ qui pilote la file de téléversement.
  chemin_distant  text,
  updated_at      timestamptz not null default now(),
  deleted         boolean     not null default false
);


-- ===========================================================================
-- 2. INDEX
-- ---------------------------------------------------------------------------
-- La synchronisation ne redemande que ce qui a changé : ces index rendent le
-- « select … where updated_at > dernier_pull » instantané.
-- ===========================================================================

create index if not exists journees_user_updated_idx   on public.journees   (user_id, updated_at);
create index if not exists depenses_user_updated_idx   on public.depenses   (user_id, updated_at);
create index if not exists categories_user_updated_idx on public.categories (user_id, updated_at);
create index if not exists recus_user_updated_idx      on public.recus      (user_id, updated_at);
create index if not exists depenses_occurred_at_idx    on public.depenses   (occurred_at);
create index if not exists recus_depense_id_idx        on public.recus      (depense_id);


-- ===========================================================================
-- 3. SÉCURITÉ — chaque compte ne voit que ses propres données
-- ---------------------------------------------------------------------------
-- `to authenticated` et non `anon` : sans session, les tables sont invisibles.
--
-- La clé anonyme reste publique — elle est embarquée dans le JavaScript envoyé
-- au navigateur, c'est normal et sans danger. Elle ne fait qu'identifier le
-- projet ; ce sont ces policies qui gardent la porte.
--
-- `default auth.uid()` sur user_id est ce qui permet au client de n'envoyer
-- que ses colonnes métier : Postgres remplit le propriétaire à l'insertion, et
-- une mise à jour ne touchant pas la colonne conserve sa valeur.
-- ===========================================================================

alter table public.journees   enable row level security;
alter table public.depenses   enable row level security;
alter table public.categories enable row level security;
alter table public.recus      enable row level security;

drop policy if exists "proprietaire seul - journees"   on public.journees;
drop policy if exists "proprietaire seul - depenses"   on public.depenses;
drop policy if exists "proprietaire seul - categories" on public.categories;
drop policy if exists "proprietaire seul - recus"      on public.recus;

create policy "proprietaire seul - journees" on public.journees for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "proprietaire seul - depenses" on public.depenses for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "proprietaire seul - categories" on public.categories for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "proprietaire seul - recus" on public.recus for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ===========================================================================
-- 4. STOCKAGE DES REÇUS
-- ---------------------------------------------------------------------------
-- Le seau est créé PRIVÉ. Un seau public rendrait vos reçus — donc vos
-- montants, vos fournisseurs et parfois votre nom — accessibles à quiconque
-- devine une URL.
--
-- Le chemin des fichiers commence par l'identifiant du compte
-- (`<user_id>/<depense_id>/<recu_id>.jpg`) : c'est ce qui permet à la policy
-- de trancher à qui appartient une image.
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('recus', 'recus', false)
on conflict (id) do nothing;

drop policy if exists "recus du proprietaire" on storage.objects;

create policy "recus du proprietaire" on storage.objects for all
  to authenticated
  using      (bucket_id = 'recus' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recus' and (storage.foldername(name))[1] = auth.uid()::text);


-- ===========================================================================
-- 5. VÉRIFICATION
-- ---------------------------------------------------------------------------
-- À exécuter après coup pour confirmer que tout est en place.
-- Les quatre tables doivent afficher rowsecurity = true et une policy chacune.
-- ===========================================================================

-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' order by tablename;

-- select tablename, policyname, roles from pg_policies
--   where schemaname = 'public' order by tablename;

-- select id, public from storage.buckets where id = 'recus';
