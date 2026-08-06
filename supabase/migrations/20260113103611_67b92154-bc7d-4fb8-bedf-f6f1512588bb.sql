-- Разрешить всем загружать файлы в bucket materials
CREATE POLICY "Allow public uploads to materials"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'materials');

-- Разрешить всем обновлять файлы в bucket materials  
CREATE POLICY "Allow public updates to materials"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'materials');

-- Разрешить всем удалять файлы в bucket materials
CREATE POLICY "Allow public deletes to materials"
ON storage.objects
FOR DELETE
USING (bucket_id = 'materials');