import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/useNotificationPreferences";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, activeRole } = useAuth();
  const push = usePushNotifications(user?.id, activeRole);
  const { data: prefs } = useNotificationPreferences(user?.id);
  const updatePrefs = useUpdateNotificationPreferences();

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!user) { navigate("/auth"); return null; }

  const togglePush = async () => {
    try {
      if (push.enabled) {
        await push.disable();
        toast.success("Уведомления выключены");
      } else {
        await push.enable();
        toast.success("Уведомления включены");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const updateReminder = async (key: "reminder_24h" | "reminder_2h", value: boolean) => {
    try {
      await updatePrefs.mutateAsync({ userId: user.id, patch: { [key]: value } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" />Назад</Link></Button>
          <h1 className="text-lg font-semibold">Настройки уведомлений</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader><CardTitle>Push-уведомления</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!push.isPushConfigured ? (
              <p className="text-sm text-muted-foreground">
                Push-уведомления пока не настроены для этого приложения.
              </p>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {push.enabled ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                  <span>Уведомления на этом устройстве</span>
                </div>
                <Switch checked={push.enabled} disabled={push.loading} onCheckedChange={togglePush} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Напоминания о занятиях</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="reminder-24h">За 24 часа до занятия</Label>
              <Switch
                id="reminder-24h"
                checked={prefs?.reminder_24h ?? true}
                onCheckedChange={(v) => updateReminder("reminder_24h", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="reminder-2h">За 2 часа до занятия</Label>
              <Switch
                id="reminder-2h"
                checked={prefs?.reminder_2h ?? true}
                onCheckedChange={(v) => updateReminder("reminder_2h", v)}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SettingsPage;
