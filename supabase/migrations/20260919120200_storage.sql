-- =============================================================================
-- CARGA CERTA | 03 - Storage
--
-- Dois buckets privados. O caminho SEMPRE comeca com o id do usuario, porque a
-- policy valida o primeiro segmento da pasta:
--     comprovantes/{piloto_id}/{despesa_id}.jpg
--     documentos/{piloto_id}/{documento_id}.pdf
--
-- O banco guarda o path, nunca a URL. A URL assinada e gerada na exibicao com
-- createSignedUrl() e expira; URL publica tornaria o bucket enumeravel.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('comprovantes', 'comprovantes', false, 5242880,
     array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('documentos', 'documentos', false, 10485760,
     array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Policies: o usuario so alcanca arquivos dentro da pasta com o proprio id
-- -----------------------------------------------------------------------------

do $$
declare
    b text;
begin
    foreach b in array array['comprovantes', 'documentos']
    loop
        execute format(
            'create policy "%1$s_select" on storage.objects
             for select to authenticated
             using (
                 bucket_id = %1$L
                 and (storage.foldername(name))[1] = (select auth.uid())::text
             )', b
        );

        execute format(
            'create policy "%1$s_insert" on storage.objects
             for insert to authenticated
             with check (
                 bucket_id = %1$L
                 and (storage.foldername(name))[1] = (select auth.uid())::text
             )', b
        );

        execute format(
            'create policy "%1$s_update" on storage.objects
             for update to authenticated
             using (
                 bucket_id = %1$L
                 and (storage.foldername(name))[1] = (select auth.uid())::text
             )', b
        );

        execute format(
            'create policy "%1$s_delete" on storage.objects
             for delete to authenticated
             using (
                 bucket_id = %1$L
                 and (storage.foldername(name))[1] = (select auth.uid())::text
             )', b
        );
    end loop;
end;
$$;
