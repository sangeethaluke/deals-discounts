-- Supabase Storage migration; run after merchant roles are installed.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy public_product_photos on storage.objects for select using(bucket_id='product-images');
create policy upload_own_product_photos on storage.objects for insert to authenticated with check(
 bucket_id='product-images' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.profiles where id=auth.uid() and active and role in ('merchant','admin'))
);
