import type { ModeratorCall, PreviewMaterial } from "@/lib/moderationTypes";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { parseMarkdownToHtml } from "@/components/ui/RichTextEditor";

function safeContent(value: string) {
  return DOMPurify.sanitize(
    /<[a-z][\s\S]*>/i.test(value) ? value : parseMarkdownToHtml(value),
  );
}
export default function ModeratorProductPreview(
  { reportId, initialProductId, call, onClose }: {
    reportId: string;
    initialProductId?: string | null;
    call: ModeratorCall;
    onClose: () => void;
  },
) {
  const [productId, setProductId] = useState(initialProductId || "");
  const [tab, setTab] = useState("public");
  const [folder, setFolder] = useState<string | null>(null);
  const [thread, setThread] = useState("");
  const products = useQuery({
    queryKey: ["moderator-preview-seller", reportId],
    queryFn: async () => {
      const r = await call({ action: "preview_seller", report_id: reportId });
      if (!r.success) throw new Error(r.error);
      return r.products || [];
    },
  });
  useEffect(() => {
    if (!productId && products.data?.length) setProductId(products.data[0].id);
  }, [products.data, productId]);
  const content = useQuery({
    queryKey: ["moderator-preview-contents", productId],
    enabled: !!productId,
    queryFn: async () => {
      const r = await call({
        action: "preview_contents",
        product_id: productId,
      });
      if (!r.success) throw new Error(r.error);
      return r;
    },
  });
  const materials: PreviewMaterial[] = content.data?.materials || [];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Предпросмотр продавца</DialogTitle>
          <DialogDescription>
            Проверка всех продуктов и содержимого. Для возврата закройте
            предпросмотр.
          </DialogDescription>
        </DialogHeader>
        {products.error && (
          <p role="alert" className="text-destructive">
            {products.error.message}
          </p>
        )}
        <label className="flex items-center gap-3 text-sm">
          Продукты автора:
          <select
            className="min-w-0 flex-1 rounded-lg border bg-background p-2"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setFolder(null);
              setThread("");
            }}
          >
            {(products.data || []).map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </label>
        {products.data?.length === 0 && (
          <p>
            У продавца не осталось продуктов.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {[
            ["public", "Как на маркетплейсе"],
            ["materials", "Материалы"],
            ["announcements", "Сообщения продукта"],
            ["schedule", "Расписание"],
            ["messages", "Личные сообщения автора"],
          ].map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        {productId && tab === "public"
          ? (
            <iframe
              title="Продукт на маркетплейсе — предпросмотр модератора"
              className="min-h-0 w-full flex-1 rounded-lg border"
              src={`/p/${productId}?moderatorPreview=1`}
            />
          )
          : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              {content.isLoading && <Loader2 className="animate-spin" />}
              {content.error && (
                <p role="alert" className="text-destructive">
                  {content.error.message}
                </p>
              )}
              {tab === "materials" && (
                <>
                  {folder && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setFolder(
                          materials.find((m) => m.id === folder)?.parent_id ||
                            null,
                        )}
                    >
                      Назад к папке
                    </Button>
                  )}
                  {!materials.length && (
                    <p className="text-muted-foreground">Материалов нет</p>
                  )}
                  {materials.filter((m) => (m.parent_id || null) === folder)
                    .map((m) => (
                      <article
                        key={m.id}
                        className="space-y-3 rounded-lg border p-4"
                      >
                        <h3 className="font-semibold">
                          {m.title}{" "}
                          {m.teacher_id && (
                            <span className="text-xs text-muted-foreground">
                              Материал преподавателя
                            </span>
                          )}
                        </h3>
                        {m.type === "folder"
                          ? (
                            <Button
                              variant="outline"
                              onClick={() => setFolder(m.id)}
                            >
                              Открыть папку
                            </Button>
                          )
                          : (
                            <>
                              {m.content && (
                                <div
                                  className="prose max-w-none dark:prose-invert"
                                  dangerouslySetInnerHTML={{
                                    __html: safeContent(m.content),
                                  }}
                                />
                              )}
                              {m.preview_url && (/video/i.test(m.type)
                                ? (
                                  <video
                                    controls
                                    src={m.preview_url}
                                    className="max-h-96 w-full"
                                  />
                                )
                                : /audio/i.test(m.type)
                                ? <audio controls src={m.preview_url} />
                                : (
                                  <a
                                    className="text-primary underline"
                                    href={m.preview_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Открыть файл
                                  </a>
                                ))}
                              {m.file_url && !m.preview_url && (
                                <p>Не удалось получить ссылку на файл.</p>
                              )}
                            </>
                          )}
                      </article>
                    ))}
                </>
              )}
              {tab === "announcements" && (
                <>
                  {!content.data?.announcements?.length && <p>Сообщений нет</p>}
                  {content.data?.announcements?.map((
                    a: { id: string; content_html: string },
                  ) => (
                    <div
                      key={a.id}
                      className="prose rounded-lg border p-4 dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(a.content_html),
                      }}
                    />
                  ))}
                </>
              )}
              {tab === "schedule" && (
                <>
                  {!content.data?.schedules?.length && <p>Расписания нет</p>}
                  {content.data?.schedules?.map((
                    s: {
                      id: string;
                      title: string;
                      time_slots: {
                        id: string;
                        date: string;
                        start_time: string;
                        end_time: string;
                      }[];
                    },
                  ) => (
                    <article key={s.id} className="rounded-lg border p-4">
                      <h3>{s.title}</h3>
                      {s.time_slots.map((slot) => (
                        <p key={slot.id}>
                          {slot.date} {slot.start_time} — {slot.end_time}
                        </p>
                      ))}
                    </article>
                  ))}
                </>
              )}
              {tab === "messages" && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Последние 500 сообщений автора. Только для проверки жалобы.
                  </p>
                  <select
                    className="w-full rounded-lg border bg-background p-2"
                    value={thread}
                    onChange={(e) => setThread(e.target.value)}
                  >
                    <option value="">Все диалоги</option>
                    {content.data?.threads?.map((
                      t: { id: string; buyer_profile_id: string },
                    ) => (
                      <option key={t.id} value={t.id}>
                        Покупатель {t.buyer_profile_id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  {!content.data?.messages?.length && (
                    <p>Личных сообщений нет</p>
                  )}
                  {content.data?.messages?.filter((m: { thread_id: string }) =>
                    !thread || m.thread_id === thread
                  ).map((
                    m: {
                      id: string;
                      sender: string;
                      text: string;
                      created_at: string;
                      attachments: { name: string; url?: string }[];
                    },
                  ) => (
                    <article
                      key={m.id}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <p className="text-xs text-muted-foreground">
                        {m.sender === "creator" ? "Продавец" : "Покупатель"} ·
                        {" "}
                        {new Date(m.created_at).toLocaleString("ru-RU")}
                      </p>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      {m.attachments.map((a, i) =>
                        a.url && (
                          <a
                            key={i}
                            className="mr-3 text-primary underline"
                            target="_blank"
                            rel="noreferrer"
                            href={a.url}
                          >
                            {a.name}
                          </a>
                        )
                      )}
                    </article>
                  ))}
                </>
              )}
            </div>
          )}
        <Button className="self-end" variant="outline" onClick={onClose}>
          Закрыть предпросмотр
        </Button>
      </DialogContent>
    </Dialog>
  );
}
