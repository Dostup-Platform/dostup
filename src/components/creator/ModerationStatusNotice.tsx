import { useModerationStatus } from "@/hooks/useModerationStatus";
import ModerationCountdown from "@/components/moderator/ModerationCountdown";
export default function ModerationStatusNotice(
  { notifications = false }: { notifications?: boolean },
) {
  const { data } = useModerationStatus();
  if (!data) return null;
  if (notifications) {
    return (
      <>
        {data.notifications.map((n) => (
          <article
            key={n.id}
            className="space-y-2 rounded-xl border border-amber-300 bg-amber-500/5 p-4"
          >
            <p className="text-xs font-semibold text-muted-foreground">
              Техподдержка · {new Date(n.created_at).toLocaleString("ru-RU")}
            </p>
            <p className="whitespace-pre-wrap text-sm">{n.body}</p>
          </article>
        ))}
      </>
    );
  }
  if (!data.restricted) return null;
  return (
    <div
      className="space-y-3 rounded-xl border border-amber-300 bg-amber-500/10 p-4 text-sm"
      role="status"
    >
      <p className="font-semibold">
        На профиль поступила жалоба. Идёт проверка.
      </p>
      <p>
        Продажи, создание и публикация продуктов приостановлены. Все продукты
        приватные. Вы можете редактировать и удалять существующие продукты.
      </p>
      {data.reports.map((r) => (
        <div key={r.id}>
          <p>Причина: {r.reason}</p>
          {r.correction_text && (
            <p className="mt-2 whitespace-pre-wrap font-medium">
              Необходимо исправить: {r.correction_text}
            </p>
          )}
          {r.correction_deadline && (
            <ModerationCountdown deadline={r.correction_deadline} />
          )}
        </div>
      ))}
    </div>
  );
}
