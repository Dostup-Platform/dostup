import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, ArrowLeft, RefreshCw, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const generatePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
};

const AuthPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, resetPassword, loading } = useAuth();

  const initialTab = params.get("mode") === "signup" ? "signup" : "signin";
  const [tab, setTab] = useState<string>(initialTab);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signupPassword, setSignupPassword] = useState(generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signInWithEmail(email, password);
    if (error) toast.error(error.message || "Не удалось войти");
    else { toast.success("Вход выполнен"); navigate("/dashboard"); }
    setSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("Введите имя"); return; }
    setSubmitting(true);
    const { error } = await signUpWithEmail(email.trim(), signupPassword, name.trim());
    if (error) toast.error(error.message || "Не удалось зарегистрироваться");
    else toast.success("Проверьте почту для подтверждения аккаунта");
    setSubmitting(false);
  };

  const handleGoogle = async () => {
    const { error } = await signInWithGoogle();
    if (error) toast.error(error.message);
  };

  const handleApple = async () => {
    const { error } = await signInWithApple();
    if (error) toast.error(error.message);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await resetPassword(forgotEmail);
    if (error) toast.error(error.message);
    else { toast.success("Письмо для сброса пароля отправлено"); setShowForgot(false); }
    setSubmitting(false);
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(signupPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span>На главную</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {showForgot ? "Восстановление пароля" : "Добро пожаловать"}
            </CardTitle>
            <CardDescription>
              {showForgot ? "Введите email — отправим ссылку для сброса пароля."
                : "Войдите или создайте аккаунт, чтобы получить доступ к вашим продуктам."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showForgot ? (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input id="forgot-email" type="email" required value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)} className="h-12" />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? "Отправка..." : "Отправить ссылку"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgot(false)}>
                  Отмена
                </Button>
              </form>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  <Button type="button" variant="outline" className="w-full h-12" onClick={handleGoogle}>
                    Продолжить с Google
                  </Button>
                  <Button type="button" variant="outline" className="w-full h-12" onClick={handleApple}>
                    Продолжить с Apple
                  </Button>
                </div>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">или email</span>
                  </div>
                </div>

                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="signin">Вход</TabsTrigger>
                    <TabsTrigger value="signup">Регистрация</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin">
                    <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" required value={email}
                          onChange={(e) => setEmail(e.target.value)} className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Пароль</Label>
                        <div className="relative">
                          <Input id="password" type={showPassword ? "text" : "password"} required value={password}
                            onChange={(e) => setPassword(e.target.value)} className="h-12 pr-12" />
                          <button type="button" onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                        {submitting ? "Вход..." : "Войти"}
                      </Button>
                      <button type="button" onClick={() => { setForgotEmail(email); setShowForgot(true); }}
                        className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
                        Забыли пароль?
                      </button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Имя</Label>
                        <Input id="signup-name" required value={name}
                          onChange={(e) => setName(e.target.value)} className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input id="signup-email" type="email" required value={email}
                          onChange={(e) => setEmail(e.target.value)} className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Пароль</Label>
                        <div className="relative">
                          <Input id="signup-password" type={showSignupPassword ? "text" : "password"}
                            required value={signupPassword} minLength={8}
                            onChange={(e) => setSignupPassword(e.target.value)} className="h-12 pr-24" />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                            <button type="button" onClick={copyPassword}
                              title="Скопировать" className="p-2 text-muted-foreground hover:text-foreground">
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button type="button" onClick={() => setSignupPassword(generatePassword())}
                              title="Сгенерировать" className="p-2 text-muted-foreground hover:text-foreground">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)}
                              className="p-2 text-muted-foreground hover:text-foreground">
                              {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Пароль сгенерирован автоматически. Сохраните его или введите свой.</p>
                      </div>
                      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                        {submitting ? "Создание..." : "Создать аккаунт"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;