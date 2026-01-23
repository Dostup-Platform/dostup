-- Create a function to send push notification on new purchase
CREATE OR REPLACE FUNCTION public.notify_creator_on_purchase()
RETURNS TRIGGER AS $$
DECLARE
  creator_phone TEXT;
  product_title TEXT;
  user_name TEXT;
BEGIN
  -- Get product creator phone (creator name is stored as the phone for creators)
  SELECT p.creator_id INTO creator_phone
  FROM products p
  WHERE p.id = NEW.product_id;
  
  -- Get product title
  SELECT p.title INTO product_title
  FROM products p
  WHERE p.id = NEW.product_id;
  
  -- Get user name
  SELECT su.name INTO user_name
  FROM simple_users su
  WHERE su.id = NEW.simple_user_id;
  
  -- Insert a record to trigger the edge function via pg_net extension
  -- We'll use the http extension to call the edge function
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'userPhone', creator_phone,
      'title', CASE 
        WHEN current_setting('app.settings.language', true) = 'kk' 
        THEN user_name || ' жаңа сатып алу жасады'
        ELSE 'Новая покупка от ' || COALESCE(user_name, 'Клиент')
      END,
      'body', COALESCE(product_title, ''),
      'data', jsonb_build_object(
        'type', 'payment',
        'purchaseId', NEW.id,
        'amount', NEW.amount::text
      ),
      'targetRole', 'creator'
    )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the insert if notification fails
    RAISE WARNING 'Failed to send purchase notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new purchases
DROP TRIGGER IF EXISTS on_new_purchase_notify_creator ON public.simple_purchases;
CREATE TRIGGER on_new_purchase_notify_creator
  AFTER INSERT ON public.simple_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_creator_on_purchase();