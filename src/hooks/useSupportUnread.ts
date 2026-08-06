import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSupportUnread(userType: "creator" | "teacher" | "student", userRef: string | null | undefined) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userRef) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("support_threads")
        .select("unread_for_user")
        .eq("user_type", userType)
        .eq("user_ref", userRef)
        .maybeSingle();
      if (!cancelled) setUnread((data as any)?.unread_for_user ?? 0);
    };
    load();
    const channel = supabase
      .channel(`support-unread-${userType}-${userRef}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "support_threads", filter: `user_ref=eq.${userRef}` },
        () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userType, userRef]);

  return unread;
}