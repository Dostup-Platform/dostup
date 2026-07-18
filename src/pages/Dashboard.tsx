import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const roleLabels: Record<AppRole, string> = {
  admin: "Администратор",
  creator: "Автор курса",
  school_admin: "Школа",
  teacher: "Преподаватель",
  moderator: "Модератор",
  student: "Ученик",
  user: "Пользователь",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, roles, activeRole, switchRole, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Доступ</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="outline" onClick={() => signOut()}>Выйти</Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Ваш аккаунт</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Роли</p>
              {roles.length === 0 ? (
                <p className="text-muted-foreground">Роли ещё не назначены.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => (
                    <Button key={r} size="sm" variant={r === activeRole ? "default" : "outline"}
                      onClick={() => switchRole(r)}>
                      {roleLabels[r] ?? r}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Идёт миграция на новую систему аутентификации</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Мы переходим на безопасный вход по email с поддержкой Google и Apple. Функциональные разделы
              (Материалы, Расписание, Уведомления, Управление продуктами) будут восстановлены на следующих этапах.
            </p>
            <p>
              Активная роль: <b className="text-foreground">{activeRole ? (roleLabels[activeRole] ?? activeRole) : "—"}</b>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;