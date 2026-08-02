import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useAllThreads,
  useMarkThreadRead,
  useMyThread,
  useSendSupportMessage,
  useThreadMessages,
  type SupportThread,
} from "@/hooks/useSupport";

const fmtTime = (iso: string) => new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

function ChatPanel({
  threadId,
  userId,
  displayName,
  viewerSender,
  onSent,
}: {
  threadId: string | undefined;
  userId: string;
  displayName: string;
  viewerSender: "user" | "moderator";
  onSent?: (threadId: string) => void;
}) {
  const { data: messages = [], isLoading } = useThreadMessages(threadId);
  const send = useSendSupportMessage();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const t = text.trim();
    if (!t) return;
    try {
      const id = await send.mutateAsync({
        threadId,
        userId,
        displayName,
        sender: viewerSender,
        text: t,
      });
      setText("");
      if (id && onSent) onSent(id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col h-[60vh]">
      <div className="flex-1 overflow-y-auto space-y-2 p-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Пока нет сообщений. Напишите первым.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                m.sender === viewerSender
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{m.text}</div>
              <div className="text-[10px] opacity-70 mt-1">{fmtTime(m.created_at)}</div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 p-3 border-t">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Написать сообщение…"
          rows={2}
          className="flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button size="icon" disabled={send.isPending || !text.trim()} onClick={handleSend}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const UserSupportView = ({ userId }: { userId: string }) => {
  const { data: thread, isLoading } = useMyThread(userId);
  const { data: profile } = useQuery({
    queryKey: ["support-profile-name", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name,display_name,email")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });
  const displayName = profile?.name || profile?.display_name || profile?.email || "Пользователь";
  const markRead = useMarkThreadRead();

  useEffect(() => {
    if (thread && thread.unread_for_user > 0) {
      markRead.mutate({ threadId: thread.id, asModerator: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, thread?.unread_for_user]);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Чат с поддержкой</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ChatPanel
          threadId={thread?.id}
          userId={userId}
          displayName={displayName}
          viewerSender="user"
        />
      </CardContent>
    </Card>
  );
};

const ModeratorSupportView = ({ userId }: { userId: string }) => {
  const { data: threads = [], isLoading } = useAllThreads(true);
  const [selected, setSelected] = useState<SupportThread | null>(null);
  const markRead = useMarkThreadRead();

  const openThread = (t: SupportThread) => {
    setSelected(t);
    if (t.unread_for_moderator > 0) markRead.mutate({ threadId: t.id, asModerator: true });
  };

  if (selected) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => setSelected(null)}><ArrowLeft className="w-4 h-4" /></Button>
          <CardTitle className="text-base">{selected.display_name}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ChatPanel
            threadId={selected.id}
            userId={userId}
            displayName="Поддержка"
            viewerSender="moderator"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Обращения ({threads.length})</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : threads.length === 0 ? (
          <p className="text-muted-foreground">Обращений пока нет.</p>
        ) : (
          <div className="space-y-2">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t)}
                className="w-full flex items-center gap-3 p-3 border rounded-lg text-left hover:bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.display_name}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {t.last_message_preview ?? "Нет сообщений"}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{fmtTime(t.last_message_at)}</div>
                {t.unread_for_moderator > 0 && <Badge>{t.unread_for_moderator}</Badge>}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const SupportPage = () => {
  const navigate = useNavigate();
  const { user, loading, roles } = useAuth();
  const isModerator = roles.includes("moderator");

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!user) { navigate("/auth"); return null; }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" />Назад</Link></Button>
          <h1 className="text-lg font-semibold">Поддержка</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {isModerator ? <ModeratorSupportView userId={user.id} /> : <UserSupportView userId={user.id} />}
      </main>
    </div>
  );
};

export default SupportPage;
