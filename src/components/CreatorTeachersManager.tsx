import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props { userId: string }

const CreatorTeachersManager = ({ userId }: Props) => {
  const qc = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [email, setEmail] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["creator-products-min", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("products")
        .select("id,title")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["product-teachers", selectedProduct],
    enabled: !!selectedProduct,
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("product_teachers")
        .select("id, teacher_user_id, product_id, created_at")
        .eq("product_id", selectedProduct);
      if (error) throw error;
      const ids = (rows ?? []).map((r) => r.teacher_user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles")
        .select("user_id,name,display_name,email")
        .in("user_id", ids);
      const pmap = new Map((profs ?? []).map((p) => [p.user_id, p]));
      return (rows ?? []).map((r) => ({ ...r, profile: pmap.get(r.teacher_user_id) }));
    },
  });

  const addTeacher = useMutation({
    mutationFn: async ({ productId, teacherEmail }: { productId: string; teacherEmail: string }) => {
      const clean = teacherEmail.trim().toLowerCase();
      if (!clean) throw new Error("Укажите email");
      const { data: prof } = await supabase.from("profiles")
        .select("user_id,email").ilike("email", clean).maybeSingle();
      if (!prof) throw new Error("Пользователь с таким email не найден. Попросите его зарегистрироваться.");
      const { error: e1 } = await supabase.from("product_teachers")
        .insert({ product_id: productId, teacher_user_id: prof.user_id });
      if (e1 && !e1.message.includes("duplicate")) throw e1;
      await supabase.from("user_roles")
        .insert({ user_id: prof.user_id, role: "teacher" as never });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-teachers", selectedProduct] });
      toast.success("Преподаватель добавлен");
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTeacher = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_teachers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-teachers", selectedProduct] });
      toast.success("Удалено");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (products.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle>Преподаватели</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Продукт</Label>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger><SelectValue placeholder="Выберите продукт" /></SelectTrigger>
            <SelectContent>
              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedProduct && (
          <>
            <div className="flex gap-2">
              <Input type="email" placeholder="email преподавателя" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button disabled={!email.trim() || addTeacher.isPending} onClick={() => addTeacher.mutate({ productId: selectedProduct, teacherEmail: email })}>
                {addTeacher.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4 mr-1" />Добавить</>}
              </Button>
            </div>
            <div className="space-y-2">
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Преподавателей нет.</p>
              ) : assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 p-2 border rounded-lg text-sm">
                  <div className="flex-1 min-w-0 truncate">
                    <span className="font-medium">{a.profile?.name || a.profile?.display_name || "—"}</span>
                    {a.profile?.email && <span className="text-muted-foreground"> · {a.profile.email}</span>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Убрать преподавателя?")) removeTeacher.mutate(a.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CreatorTeachersManager;