-- ===========================================================================
-- Aqua Track — MIGRATION : partage entre plusieurs comptes
-- ---------------------------------------------------------------------------
-- À exécuter UNE FOIS si vous avez déjà lancé la première version de
-- schema.sql. Pour une installation neuve, `schema.sql` suffit — il contient
-- déjà tout ceci.
--
-- Ce que ça change : les données n'appartiennent plus à un COMPTE mais à un
-- KIOSQUE. Plusieurs comptes rejoignent le même kiosque et voient les mêmes
-- données. `user_id` reste, mais change de rôle : il ne garde plus la porte,
-- il dit seulement QUI a saisi la ligne.
--
-- Le script est réexécutable et ne détruit aucune donnée.
-- ===========================================================================


-- ===========================================================================
-- 1. KIOSQUES ET MEMBRES
-- ===========================================================================

create table if not exists public.kiosques (
  id               uuid primary key default gen_random_uuid(),
  nom              text        not null default 'Mon kiosque',
  -- Code court partagé de vive voix ou par message pour faire entrer
  -- quelqu'un. Six caractères suffisent : il n'est utilisé qu'une fois, et
  -- rejoindre exige d'être déjà authentifié.
  code_invitation  text        not null unique
                   default upper(substring(md5(random()::text) from 1 for 6)),
  created_at       timestamptz not null default now()
);

create table if not exists public.membres (
  kiosque_id  uuid        not null references public.kiosques(id) on delete cascade,
  user_id     uuid        not null references auth.users(id)      on delete cascade,
  role        text        not null default 'employe'
              check (role in ('proprietaire', 'employe')),
  nom         text        not null default '',
  created_at  timestamptz not null default now(),
  primary key (kiosque_id, user_id)
);


-- ===========================================================================
-- 2. FONCTIONS D'ACCÈS
-- ---------------------------------------------------------------------------
-- `security definer` est indispensable ici : une policy sur `membres` qui
-- interrogerait `membres` provoquerait une récursion infinie. La fonction
-- s'exécute avec les droits de son propriétaire et coupe la boucle.
--
-- `set search_path = public` empêche qu'un schéma malveillant placé en tête
-- de chemin détourne l'appel — précaution standard sur toute fonction
-- `security definer`.
-- ===========================================================================

create or replace function public.mes_kiosques()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select kiosque_id from public.membres where user_id = auth.uid()
$$;

-- Kiosque par défaut d'un compte : celui qu'il a rejoint en premier.
-- Sert de valeur par défaut aux colonnes `kiosque_id`, ce qui évite au client
-- d'avoir à l'envoyer dans chaque ligne.
create or replace function public.mon_kiosque()
returns uuid
language sql stable security definer set search_path = public as $$
  select kiosque_id from public.membres
   where user_id = auth.uid()
   order by created_at
   limit 1
$$;


-- ===========================================================================
-- 3. COLONNE kiosque_id SUR LES TABLES DE DONNÉES
-- ===========================================================================

alter table public.journees   add column if not exists kiosque_id uuid;
alter table public.depenses   add column if not exists kiosque_id uuid;
alter table public.categories add column if not exists kiosque_id uuid;
alter table public.recus      add column if not exists kiosque_id uuid;


-- ===========================================================================
-- 4. REPRISE DES DONNÉES EXISTANTES
-- ---------------------------------------------------------------------------
-- Chaque compte ayant déjà des données reçoit son kiosque, dont il devient
-- propriétaire, et ses lignes y sont rattachées. Rien n'est perdu.
-- ===========================================================================

do $$
declare
  compte uuid;
  k uuid;
begin
  for compte in
    select distinct user_id from (
      select user_id from public.journees
      union select user_id from public.depenses
      union select user_id from public.categories
      union select user_id from public.recus
    ) t where user_id is not null
  loop
    -- Un compte déjà membre d'un kiosque n'en crée pas un second.
    select kiosque_id into k from public.membres
      where user_id = compte order by created_at limit 1;

    if k is null then
      insert into public.kiosques (nom) values ('Mon kiosque') returning id into k;
      insert into public.membres (kiosque_id, user_id, role)
        values (k, compte, 'proprietaire');
    end if;

    update public.journees   set kiosque_id = k where user_id = compte and kiosque_id is null;
    update public.depenses   set kiosque_id = k where user_id = compte and kiosque_id is null;
    update public.categories set kiosque_id = k where user_id = compte and kiosque_id is null;
    update public.recus      set kiosque_id = k where user_id = compte and kiosque_id is null;
  end loop;
end $$;


-- ===========================================================================
-- 5. CONTRAINTES ET DÉFAUTS
-- ===========================================================================

alter table public.journees   alter column kiosque_id set default public.mon_kiosque();
alter table public.depenses   alter column kiosque_id set default public.mon_kiosque();
alter table public.categories alter column kiosque_id set default public.mon_kiosque();
alter table public.recus      alter column kiosque_id set default public.mon_kiosque();

alter table public.journees   alter column kiosque_id set not null;
alter table public.depenses   alter column kiosque_id set not null;
alter table public.categories alter column kiosque_id set not null;
alter table public.recus      alter column kiosque_id set not null;

-- `user_id` change de sens : il ne garde plus la porte, il dit qui a saisi.
-- Il reste rempli automatiquement et sert à afficher « saisi par… ».
alter table public.journees   alter column user_id drop not null;
alter table public.depenses   alter column user_id drop not null;
alter table public.categories alter column user_id drop not null;
alter table public.recus      alter column user_id drop not null;

-- L'unicité d'une journée porte désormais sur le KIOSQUE, pas sur le compte :
-- deux employés du même kiosque ne doivent pas pouvoir clôturer deux fois la
-- même journée, chacun de son côté.
alter table public.journees drop constraint if exists journees_date_key;
alter table public.journees drop constraint if exists journees_user_date_unique;
alter table public.journees drop constraint if exists journees_kiosque_date_unique;
alter table public.journees add  constraint journees_kiosque_date_unique unique (kiosque_id, date);

create index if not exists journees_kiosque_updated_idx   on public.journees   (kiosque_id, updated_at);
create index if not exists depenses_kiosque_updated_idx   on public.depenses   (kiosque_id, updated_at);
create index if not exists categories_kiosque_updated_idx on public.categories (kiosque_id, updated_at);
create index if not exists recus_kiosque_updated_idx      on public.recus      (kiosque_id, updated_at);


-- ===========================================================================
-- 6. SÉCURITÉ — on filtre désormais sur le kiosque
-- ===========================================================================

alter table public.kiosques enable row level security;
alter table public.membres  enable row level security;

drop policy if exists "mes kiosques"        on public.kiosques;
drop policy if exists "membres de mes kiosques" on public.membres;

create policy "mes kiosques" on public.kiosques for select
  to authenticated using (id in (select public.mes_kiosques()));

create policy "membres de mes kiosques" on public.membres for select
  to authenticated using (kiosque_id in (select public.mes_kiosques()));

-- Les anciennes policies filtraient sur user_id : elles cacheraient à chacun
-- les lignes saisies par l'autre.
drop policy if exists "proprietaire seul - journees"   on public.journees;
drop policy if exists "proprietaire seul - depenses"   on public.depenses;
drop policy if exists "proprietaire seul - categories" on public.categories;
drop policy if exists "proprietaire seul - recus"      on public.recus;
drop policy if exists "acces anon complet - journees"   on public.journees;
drop policy if exists "acces anon complet - depenses"   on public.depenses;
drop policy if exists "acces anon complet - categories" on public.categories;
drop policy if exists "acces anon complet - recus"      on public.recus;

drop policy if exists "membres du kiosque - journees"   on public.journees;
drop policy if exists "membres du kiosque - depenses"   on public.depenses;
drop policy if exists "membres du kiosque - categories" on public.categories;
drop policy if exists "membres du kiosque - recus"      on public.recus;

create policy "membres du kiosque - journees" on public.journees for all
  to authenticated
  using      (kiosque_id in (select public.mes_kiosques()))
  with check (kiosque_id in (select public.mes_kiosques()));

create policy "membres du kiosque - depenses" on public.depenses for all
  to authenticated
  using      (kiosque_id in (select public.mes_kiosques()))
  with check (kiosque_id in (select public.mes_kiosques()));

create policy "membres du kiosque - categories" on public.categories for all
  to authenticated
  using      (kiosque_id in (select public.mes_kiosques()))
  with check (kiosque_id in (select public.mes_kiosques()));

create policy "membres du kiosque - recus" on public.recus for all
  to authenticated
  using      (kiosque_id in (select public.mes_kiosques()))
  with check (kiosque_id in (select public.mes_kiosques()));


-- ===========================================================================
-- 7. CRÉER ET REJOINDRE UN KIOSQUE
-- ---------------------------------------------------------------------------
-- Passer par des fonctions plutôt que par des policies d'insertion : rejoindre
-- exige de lire une ligne de `kiosques` qu'on n'a pas encore le droit de voir.
-- ===========================================================================

create or replace function public.creer_kiosque(nom_kiosque text default 'Mon kiosque',
                                                mon_nom text default '')
returns table (id uuid, nom text, code_invitation text)
language plpgsql security definer set search_path = public as $$
declare k uuid;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  -- Un compte déjà membre récupère son kiosque plutôt que d'en créer un autre.
  select kiosque_id into k from public.membres
    where user_id = auth.uid() order by created_at limit 1;

  if k is null then
    insert into public.kiosques (nom) values (coalesce(nullif(trim(nom_kiosque), ''), 'Mon kiosque'))
      returning kiosques.id into k;
    insert into public.membres (kiosque_id, user_id, role, nom)
      values (k, auth.uid(), 'proprietaire', mon_nom);
  end if;

  return query
    select ki.id, ki.nom, ki.code_invitation from public.kiosques ki where ki.id = k;
end $$;


create or replace function public.rejoindre_kiosque(code text, mon_nom text default '')
returns table (id uuid, nom text, code_invitation text)
language plpgsql security definer set search_path = public as $$
declare k uuid;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;

  select ki.id into k from public.kiosques ki
    where ki.code_invitation = upper(trim(code));

  if k is null then
    raise exception 'Code invalide';
  end if;

  insert into public.membres (kiosque_id, user_id, role, nom)
    values (k, auth.uid(), 'employe', mon_nom)
    on conflict (kiosque_id, user_id) do nothing;

  return query
    select ki.id, ki.nom, ki.code_invitation from public.kiosques ki where ki.id = k;
end $$;


-- Retirer quelqu'un : réservé au propriétaire du kiosque.
create or replace function public.retirer_membre(cible uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare k uuid;
begin
  select kiosque_id into k from public.membres
    where user_id = auth.uid() and role = 'proprietaire' limit 1;
  if k is null then raise exception 'Seul le propriétaire peut retirer un membre'; end if;
  if cible = auth.uid() then raise exception 'Le propriétaire ne peut pas se retirer'; end if;

  delete from public.membres where kiosque_id = k and user_id = cible;
end $$;


-- ===========================================================================
-- 8. STOCKAGE — les reçus appartiennent au kiosque
-- ---------------------------------------------------------------------------
-- Le chemin devient `<kiosque_id>/<depense_id>/<recu_id>.jpg`, sans quoi
-- l'employé ne pourrait pas ouvrir un reçu photographié par le propriétaire.
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('recus', 'recus', false)
on conflict (id) do nothing;

drop policy if exists "recus du proprietaire" on storage.objects;
drop policy if exists "recus du kiosque"      on storage.objects;

create policy "recus du kiosque" on storage.objects for all
  to authenticated
  using      (bucket_id = 'recus'
              and ((storage.foldername(name))[1])::uuid in (select public.mes_kiosques()))
  with check (bucket_id = 'recus'
              and ((storage.foldername(name))[1])::uuid in (select public.mes_kiosques()));


-- ===========================================================================
-- 9. VÉRIFICATION
-- ===========================================================================

-- select tablename, policyname from pg_policies
--   where schemaname = 'public' order by tablename;

-- select k.nom, k.code_invitation, m.role, u.email
--   from public.kiosques k
--   join public.membres m on m.kiosque_id = k.id
--   join auth.users u     on u.id = m.user_id;

-- select count(*) filter (where kiosque_id is null) as sans_kiosque from public.journees;
