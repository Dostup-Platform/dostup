-- Add kaspi_link field to products table for Kaspi payment integration
ALTER TABLE public.products 
ADD COLUMN kaspi_link TEXT;