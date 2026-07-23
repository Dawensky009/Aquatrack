-- ===========================================================================
-- Aqua Track — horodatage côté serveur
-- ---------------------------------------------------------------------------
-- À lancer UNE FOIS dans le SQL Editor de Supabase, après migration-partage.sql.
--
-- POURQUOI. Jusqu'ici, `updated_at` était posé par le téléphone qui écrit. Or
-- cette colonne gouverne DEUX choses : le curseur de synchronisation (« qu'a-
-- t-il changé depuis mon dernier passage ? ») et la résolution de conflit
-- (« quelle version est la plus récente ? »). Tout reposait donc sur l'horloge
-- des appareils — et deux téléphones désaccordés suffisaient à ce que les
-- saisies de l'un ne redescendent jamais sur l'autre, sans le moindre message.
--
-- Après cette migration, c'est Postgres — une seule horloge — qui pose
-- `updated_at` à chaque écriture. La valeur envoyée par le client est ignorée.
-- La synchronisation cesse de dépendre des horloges des appareils.
-- ===========================================================================

create or replace function public.poser_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['journees', 'depenses', 'categories', 'recus'] loop
    execute format('drop trigger if exists trg_updated_at on public.%I', t);
    execute format(
      'create trigger trg_updated_at before insert or update on public.%I
         for each row execute function public.poser_updated_at()',
      t);
  end loop;
end $$;

-- Recalage unique des lignes existantes sur l'horloge serveur. Sans lui, une
-- ligne écrite autrefois avec une horloge EN AVANCE porterait un horodatage
-- dans le futur : le curseur resterait bloqué dessus et les nouvelles écritures
-- ne redescendraient qu'une fois l'heure réelle rattrapée. Cette passe remet
-- tout le monde à `now()`. Chaque appareil re-télécharge alors ses lignes une
-- fois — sans conséquence, ce sont les mêmes données.
update public.journees   set updated_at = now();
update public.depenses   set updated_at = now();
update public.categories set updated_at = now();
update public.recus      set updated_at = now();

-- Vérification (facultatif) : les quatre déclencheurs doivent apparaître.
-- select tgrelid::regclass as table, tgname
--   from pg_trigger where tgname = 'trg_updated_at' order by 1;
