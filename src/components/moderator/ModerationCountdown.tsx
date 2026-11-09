import { useEffect, useState } from "react";
export default function ModerationCountdown(
  { deadline }: { deadline: string },
) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const minutes = Math.max(
    0,
    Math.ceil((new Date(deadline).getTime() - now) / 60_000),
  );
  return (
    <span
      className={minutes
        ? "text-amber-700 dark:text-amber-300"
        : "text-destructive"}
    >
      {minutes
        ? `Осталось: ${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
        : "Срок истёк. Ожидается повторная проверка"}
      <span className="block text-xs text-muted-foreground">
        До {new Date(deadline).toLocaleString("ru-RU")}
      </span>
    </span>
  );
}
