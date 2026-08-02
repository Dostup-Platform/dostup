import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupportThread {
  id: string;
  user_id: string;
  display_name: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_for_moderator: number;
  unread_for_user: number;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  thread_id: string;
  sender: "user" | "moderator";
  text: string;
  read_at: string | null;
  created_at: string;
}

export const useMyThread = (userId: string | undefined) =>
  useQuery({
    queryKey: ["support-my-thread", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_threads")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as SupportThread | null;
    },
  });

export const useAllThreads = (enabled: boolean) =>
  useQuery({
    queryKey: ["support-all-threads"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_threads")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupportThread[];
    },
  });

export const useThreadMessages = (threadId: string | undefined) => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["support-messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SupportMessage[];
    },
  });

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`support-messages-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ["support-messages", threadId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, qc]);

  return query;
};

export const useSendSupportMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      threadId,
      userId,
      displayName,
      sender,
      text,
    }: {
      threadId?: string;
      userId: string;
      displayName: string;
      sender: "user" | "moderator";
      text: string;
    }) => {
      let id = threadId;
      if (!id) {
        const { data: thread, error: threadErr } = await supabase
          .from("support_threads")
          .insert({ user_id: userId, display_name: displayName })
          .select("id")
          .single();
        if (threadErr) throw threadErr;
        id = thread.id;
      }

      const { error: msgErr } = await supabase
        .from("support_messages")
        .insert({ thread_id: id, sender, text });
      if (msgErr) throw msgErr;

      const { data: current } = await supabase
        .from("support_threads")
        .select("unread_for_moderator, unread_for_user")
        .eq("id", id)
        .maybeSingle();
      await supabase
        .from("support_threads")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: text.slice(0, 200),
          ...(sender === "user"
            ? { unread_for_moderator: (current?.unread_for_moderator ?? 0) + 1 }
            : { unread_for_user: (current?.unread_for_user ?? 0) + 1 }),
        })
        .eq("id", id);

      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["support-messages", id] });
      qc.invalidateQueries({ queryKey: ["support-my-thread"] });
      qc.invalidateQueries({ queryKey: ["support-all-threads"] });
    },
  });
};

export const useMarkThreadRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, asModerator }: { threadId: string; asModerator: boolean }) => {
      const { error } = await supabase
        .from("support_threads")
        .update(asModerator ? { unread_for_moderator: 0 } : { unread_for_user: 0 })
        .eq("id", threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-my-thread"] });
      qc.invalidateQueries({ queryKey: ["support-all-threads"] });
    },
  });
};
