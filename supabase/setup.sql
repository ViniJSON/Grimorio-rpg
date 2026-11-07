-- Grimório: tabelas, segurança (RLS) e bucket de imagens para o Supabase.
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez sem problema.
-- Cada pessoa só enxerga e altera as próprias linhas (user_id = auth.uid()).

do $$
declare t text;
begin
  foreach t in array array['personagens', 'campanhas', 'salvos'] loop
    execute format($f$
      create table if not exists public.%I (
        user_id    uuid    not null default auth.uid() references auth.users(id) on delete cascade,
        id         text    not null,
        dados      jsonb   not null default '{}'::jsonb,
        atualizado bigint  not null,
        excluido   boolean not null default false,
        primary key (user_id, id)
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format($f$
      create policy "dono" on public.%I for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))$f$, t);
  end loop;
end $$;

-- Imagens enviadas pelos usuários (fichas, campanhas, salvos). Público para leitura (as URLs não são listáveis),
-- mas só dá para enviar/apagar dentro da própria pasta <user_id>/. Limite de 1 MB por arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 1048576, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png'];

drop policy if exists "imagens: ver as proprias" on storage.objects;
drop policy if exists "imagens: enviar na propria pasta" on storage.objects;
drop policy if exists "imagens: apagar as proprias" on storage.objects;

create policy "imagens: ver as proprias" on storage.objects for select to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imagens: enviar na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imagens: apagar as proprias" on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = (select auth.uid())::text);
