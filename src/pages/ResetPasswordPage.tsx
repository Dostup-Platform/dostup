import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Пароль минимум 8 символов"); return; }
    if (password !== confirm) { toast.error("Пароли не совпадают"); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message);
    else { toast.success("Пароль обновлён"); navigate("/dashboard"); }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Новый пароль</CardTitle>
          <CardDescription>Придумайте новый пароль для вашего аккаунта.</CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-muted-foreground">Открываем ссылку из письма...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">Новый пароль</Label>
                <Input id="pw" type="password" required minLength={8} value={password}
                  onChange={(e) => setPassword(e.target.value)} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">Повторите пароль</Label>
                <Input id="pw2" type="password" required minLength={8} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} className="h-12" />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Сохранение..." : "Сохранить"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;