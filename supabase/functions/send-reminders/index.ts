import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting reminder check...");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending reminders that are due
    const now = new Date().toISOString();
    const { data: reminders, error: remindersError } = await supabase
      .from("booking_reminders")
      .select("*")
      .lte("scheduled_at", now)
      .is("sent_at", null)
      .limit(100);

    if (remindersError) {
      console.error("Error fetching reminders:", remindersError);
      throw remindersError;
    }

    if (!reminders || reminders.length === 0) {
      console.log("No pending reminders found");
      return new Response(
        JSON.stringify({ message: "No pending reminders", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${reminders.length} reminders to send`);

    let successCount = 0;
    let failCount = 0;

    for (const reminder of reminders) {
      try {
        // Format the notification message based on reminder type
        const isRussian = true; // Default to Russian, could be extended with user preferences
        
        let title: string;
        let body: string;

        if (reminder.reminder_type === "24h") {
          title = isRussian ? "Завтра занятие!" : "Ертең сабақ!";
          body = isRussian
            ? `"${reminder.product_title}" состоится ${formatDate(reminder.slot_date)} в ${formatTime(reminder.slot_time)}`
            : `"${reminder.product_title}" ${formatDate(reminder.slot_date)} күні ${formatTime(reminder.slot_time)} болады`;
        } else {
          title = isRussian ? "Скоро занятие!" : "Жуырда сабақ!";
          body = isRussian
            ? `"${reminder.product_title}" начнётся через 2 часа`
            : `"${reminder.product_title}" 2 сағаттан кейін басталады`;
        }

        // Call send-push-notification function
        const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
          body: {
            userPhone: reminder.user_phone,
            title,
            body,
            data: {
              type: "reminder",
              reminderType: reminder.reminder_type,
              bookingId: reminder.booking_id
            }
          }
        });

        if (pushError) {
          console.error(`Error sending reminder ${reminder.id}:`, pushError);
          failCount++;
          continue;
        }

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from("booking_reminders")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", reminder.id);

        if (updateError) {
          console.error(`Error updating reminder ${reminder.id}:`, updateError);
        }

        successCount++;
        console.log(`Sent reminder ${reminder.id} to ${reminder.user_phone}`);
      } catch (error) {
        console.error(`Exception processing reminder ${reminder.id}:`, error);
        failCount++;
      }
    }

    console.log(`Reminders processed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        message: "Reminders processed",
        sent: successCount,
        failed: failCount,
        total: reminders.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-reminders:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper functions
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  // Handle both "HH:MM:SS" and "HH:MM" formats
  return timeStr.substring(0, 5);
}
