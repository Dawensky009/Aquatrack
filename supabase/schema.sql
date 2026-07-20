-- ===========================================================================
-- Aqua Track — schéma Supabase
-- ---------------------------------------------------------------------------
-- À exécuter une fois dans l'éditeur SQL de votre projet Supabase.
--
-- Rappel d'architecture : cette base n'est PAS la source de vérité. Elle est
-- une sauvegarde distante d'IndexedDB, qui vit sur le téléphone. L'app
-- fonctionne intégralement sans elle.
--
-- Les colonnes reprennent exactement la forme des objets stockés en local,
-- pour que la synchronisation soit un simple upsert sans transformation.
-- ===========================================================================

-- --- Journées (revenus) ----------------------------------------------------
-- Une ligne par jour d'activité. `date` est unique : c'est la contrainte qui
-- garantit qu'une journée ne peut pas être clôturée deux fois, y compris si
-- deux appareils synchronisent la même journée.
create table if not exists public.journees (
  id              uuid primary key,
  date            date        not null unique,
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

-- --- Dépenses --------------------------------------------------------------
create table if not exists public.depenses (
  id              uuid primary key,

  -- `occurred_at` est la date de l'opération (éditable), `recorded_at` celle
  -- de la saisie. Tous les agrégats utilisent la première : un camion reçu
  -- hier et saisi ce matin doit compter pour hier.
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
-- Métadonnées seulement. Les images elles-mêmes vivent dans Supabase Storage
-- (voir la section « STOCKAGE DES IMAGES » plus bas) : une base Postgres n'est
-- pas faite pour héberger des photos, et le plan gratuit plafonne à 500 Mo.
create table if not exists public.recus (
  id              uuid primary key,
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

-- --- Index -----------------------------------------------------------------
-- La synchronisation ne redemande que ce qui a changé : ces index rendent le
-- « select ... where updated_at > dernier_pull » instantané.
create index if not exists journees_updated_at_idx   on public.journees (updated_at);
create index if not exists depenses_updated_at_idx   on public.depenses (updated_at);
create index if not exists categories_updated_at_idx on public.categories (updated_at);
create index if not exists recus_updated_at_idx      on public.recus (updated_at);
create index if not exists depenses_occurred_at_idx  on public.depenses (occurred_at);
create index if not exists recus_depense_id_idx      on public.recus (depense_id);

-- ===========================================================================
-- STOCKAGE DES IMAGES — à faire dans l'interface Supabase
-- ---------------------------------------------------------------------------
-- 1. Storage > New bucket > nom : « recus »
-- 2. Laissez-le PRIVÉ. Un seau public rendrait vos reçus — donc vos montants,
--    vos fournisseurs et parfois votre nom — accessibles à quiconque devine
--    une URL.
-- 3. Ajoutez la policy ci-dessous pour autoriser l'app à y écrire.
--
-- Comme pour les tables, cette policy est permissive : à durcir en même temps
-- que le reste (voir « VARIANTE SÉCURISÉE »).
--
--   create policy "acces anon - seau recus"
--     on storage.objects for all
--     to anon, authenticated
--     using (bucket_id = 'recus') with check (bucket_id = 'recus');
--
-- L'application redimensionne chaque photo à 1 600 px et la réencode en JPEG
-- avant l'envoi : comptez ~200 Ko par reçu, soit environ 5 000 reçus dans le
-- gigaoctet du plan gratuit.
-- ===========================================================================

-- ===========================================================================
-- SÉCURITÉ — À LIRE AVANT DE METTRE EN LIGNE
-- ---------------------------------------------------------------------------
-- Les policies ci-dessous autorisent la clé anonyme à tout lire et tout
-- écrire. C'est suffisant pour un usage mono-utilisateur en test, MAIS :
--
--   toute personne qui obtient l'URL du projet et la clé anon peut lire
--   l'intégralité de votre comptabilité, et la modifier.
--
-- Ces deux valeurs sont embarquées dans le JavaScript envoyé au navigateur :
-- elles ne sont pas secrètes. Avant tout usage réel, activez l'authentification
-- Supabase (email + mot de passe) et remplacez ces policies par celles de la
-- section « VARIANTE SÉCURISÉE » plus bas.
-- ===========================================================================

alter table public.journees   enable row level security;
alter table public.depenses   enable row level security;
alter table public.categories enable row level security;
alter table public.recus      enable row level security;

create policy "acces anon complet - recus"
  on public.recus for all
  to anon, authenticated
  using (true) with check (true);

create policy "acces anon complet - journees"
  on public.journees for all
  to anon, authenticated
  using (true) with check (true);

create policy "acces anon complet - depenses"
  on public.depenses for all
  to anon, authenticated
  using (true) with check (true);

create policy "acces anon complet - categories"
  on public.categories for all
  to anon, authenticated
  using (true) with check (true);

-- ===========================================================================
-- VARIANTE SÉCURISÉE (recommandée dès que l'app contient de vraies données)
-- ---------------------------------------------------------------------------
-- 1. Activez « Email » dans Authentication > Providers, puis créez votre
--    compte.
-- 2. Ajoutez une colonne propriétaire à chaque table :
--
--      alter table public.journees   add column user_id uuid default auth.uid();
--      alter table public.depenses   add column user_id uuid default auth.uid();
--      alter table public.categories add column user_id uuid default auth.uid();
--
-- 3. Supprimez les trois policies ci-dessus :
--
--      drop policy "acces anon complet - journees"   on public.journees;
--      drop policy "acces anon complet - depenses"   on public.depenses;
--      drop policy "acces anon complet - categories" on public.categories;
--
-- 4. Créez celles-ci à la place, pour chaque table :
--
--      create policy "proprietaire seul" on public.journees for all
--        to authenticated
--        using (user_id = auth.uid()) with check (user_id = auth.uid());
--
-- 5. Ajoutez un écran de connexion dans l'app (supabase.auth.signInWithPassword).
--    Le reste du code n'a pas à changer : la synchro utilise déjà le client
--    authentifié.
-- ===========================================================================
