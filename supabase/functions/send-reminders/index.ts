import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Reminder {
  id: string;
  booking_id: string | null;
  user_phone: string;
  simple_user_id: string | null;
  reminder_type: string;
  scheduled_at: string;
  product_title: string | null;
  slot_date: string | null;
  slot_time: string | null;
  sent_at: string | null;
}

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
      .limit(200);

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

    console.log(`Found ${reminders.length} reminders to process`);

    // Separate morning reminders from regular reminders
    const morningReminders = (reminders as Reminder[]).filter(r => r.reminder_type === "morning");
    const regularReminders = (reminders as Reminder[]).filter(r => r.reminder_type !== "morning");

    let successCount = 0;
    let failCount = 0;

    // Process regular reminders (24h and 2h) - one notification per reminder
    for (const reminder of regularReminders) {
      try {
        const isRussian = true; // Default to Russian
        
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

        // Call send-push-notification function - prefer userId over userPhone
        const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
          body: {
            userId: reminder.simple_user_id || undefined,
            userPhone: !reminder.simple_user_id ? reminder.user_phone : undefined,
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
        await supabase
          .from("booking_reminders")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", reminder.id);

        successCount++;
        console.log(`Sent regular reminder ${reminder.id} to ${reminder.user_phone}`);
      } catch (error) {
        console.error(`Exception processing reminder ${reminder.id}:`, error);
        failCount++;
      }
    }

    // Process morning reminders - group by user (prefer simple_user_id, fallback user_phone)
    const morningByUser = new Map<string, Reminder[]>();
    for (const reminder of morningReminders) {
      const key = reminder.simple_user_id || reminder.user_phone;
      const existing = morningByUser.get(key) || [];
      existing.push(reminder);
      morningByUser.set(key, existing);
    }

    for (const [userKey, userReminders] of morningByUser) {
      try {
        const isRussian = true;

        // Sort by time
        const sortedReminders = userReminders.sort((a, b) => {
          const timeA = a.slot_time || "00:00";
          const timeB = b.slot_time || "00:00";
          return timeA.localeCompare(timeB);
        });

        // Build consolidated message
        let title: string;
        let body: string;

        if (sortedReminders.length === 1) {
          // Single lesson
          const r = sortedReminders[0];
          title = isRussian ? "Сегодня занятие!" : "Бүгін сабақ!";
          body = isRussian
            ? `"${r.product_title}" в ${formatTime(r.slot_time)}`
            : `"${r.product_title}" ${formatTime(r.slot_time)} кезінде`;
        } else {
          // Multiple lessons - consolidated
          title = isRussian 
            ? `Сегодня ${sortedReminders.length} занятия!` 
            : `Бүгін ${sortedReminders.length} сабақ!`;
          
          const times = sortedReminders.map(r => formatTime(r.slot_time)).join(", ");
          body = isRussian
            ? `У вас уроки сегодня в ${times}`
            : `Бүгінгі сабақтарыңыз: ${times}`;
        }

        // Send single consolidated notification - prefer userId
        const firstReminder = userReminders[0];
        const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
          body: {
            userId: firstReminder.simple_user_id || undefined,
            userPhone: !firstReminder.simple_user_id ? firstReminder.user_phone : undefined,
            title,
            body,
            data: {
              type: "reminder",
              reminderType: "morning",
              lessonCount: sortedReminders.length
            }
          }
        });

        if (pushError) {
          console.error(`Error sending morning digest to ${userKey}:`, pushError);
          failCount += userReminders.length;
          continue;
        }

        // Mark all morning reminders for this user as sent
        const reminderIds = userReminders.map(r => r.id);
        await supabase
          .from("booking_reminders")
          .update({ sent_at: new Date().toISOString() })
          .in("id", reminderIds);

        successCount += userReminders.length;
        console.log(`Sent morning digest to ${userKey} with ${userReminders.length} lessons`);
      } catch (error) {
        console.error(`Exception processing morning digest for ${userKey}:`, error);
        failCount += userReminders.length;
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
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  // Handle both "HH:MM:SS" and "HH:MM" formats
  return timeStr.substring(0, 5);
}
