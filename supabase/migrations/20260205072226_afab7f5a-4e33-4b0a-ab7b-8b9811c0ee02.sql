-- Allow anyone to upload files to materials bucket (creator uploads)
CREATE POLICY "Allow authenticated uploads to materials"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'materials');

-- Allow anyone to read files from materials bucket
CREATE POLICY "Allow public read from materials"
ON storage.objects
FOR SELECT
USING (bucket_id = 'materials');

-- Allow delete for materials bucket
CREATE POLICY "Allow delete from materials"
ON storage.objects
FOR DELETE
USING (bucket_id = 'materials');