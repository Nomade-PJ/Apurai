-- Bucket de banners dos anúncios.
-- Leitura pública dos arquivos (os banners são exibidos a todos os visitantes) por URL pública;
-- NENHUMA policy de INSERT/UPDATE/DELETE/SELECT em storage.objects => só o servidor (chave de serviço) envia/remove,
-- e ninguém consegue listar o bucket pela API. Upload público irrestrito NÃO é permitido.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-banners', 'ad-banners', true, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
