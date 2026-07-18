import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Eye, Plus, Pause, Play, ImageIcon } from "lucide-react";

interface Product {
  id: string;
  title: string;
  headline: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  has_schedule: boolean;
  is_active: boolean;
  is_paused: boolean;
  paused_message: string | null;
  kaspi_link: string | null;
  kaspi_phone: string | null;
  telegram_link: string | null;
  access_duration_days: number | null;
  group_link_label: string | null;
  creator_id: string;
  owner_id: string | null;
}

const formatKZT = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KZT", minimumFractionDigits: 0 }).format(n);

const emptyForm = {
  title: "", headline: "", description: "", price: 0,
  has_schedule: false, kaspi_link: "", kaspi_phone: "", telegram_link: "",
  access_duration_days: null as number | null, group_link_label: "",
  image_url: null as string | null,
};

const CreatorProductsTab = ({ userId, creatorName }: { userId: string; creatorName: string }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [uploading, setUploading] = useState(false);
  const [pausing, setPausing] = useState<Product | null>(null);
  const [pauseMsg, setPauseMsg] = useState("");
  const [deleting, setDeleting] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["creator-products", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("*").eq("owner_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      title: p.title, headline: p.headline ?? "", description: p.description ?? "",
      price: Number(p.price), has_schedule: p.has_schedule, kaspi_link: p.kaspi_link ?? "",
      kaspi_phone: p.kaspi_phone ?? "", telegram_link: p.telegram_link ?? "",
      access_duration_days: p.access_duration_days, group_link_label: p.group_link_label ?? "",
      image_url: p.image_url,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Введите название");
      const payload = {
        title: form.title.trim(),
        headline: form.headline.trim() || null,
        description: form.description.trim() || null,
        price: Number(form.price) || 0,
        has_schedule: form.has_schedule,
        kaspi_link: form.kaspi_link.trim() || null,
        kaspi_phone: form.kaspi_phone.trim() || null,
        telegram_link: form.telegram_link.trim() || null,
        access_duration_days: form.access_duration_days ?? null,
        group_link_label: form.group_link_label.trim() || null,
        image_url: form.image_url,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({
          ...payload, owner_id: userId, creator_id: creatorName, is_active: true, is_paused: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Продукт обновлён" : "Продукт создан");
      qc.invalidateQueries({ queryKey: ["creator-products", userId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Только изображения"); return; }
    // Editing product: upload to that id. New product: create draft product first.
    let targetId = editing?.id;
    if (!targetId) {
      const { data, error } = await supabase.from("products").insert({
        title: form.title.trim() || "Без названия", price: Number(form.price) || 0,
        owner_id: userId, creator_id: creatorName, is_active: false, is_paused: false,
      }).select("*").single();
      if (error) { toast.error(error.message); return; }
      const draft = data as unknown as Product;
      setEditing(draft);
      targetId = draft.id;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("productId", targetId); fd.append("kind", "image");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-product-media`,
        { method: "POST", body: fd, headers: { Authorization: `Bearer ${token}` } },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Ошибка загрузки");
      setForm((f) => ({ ...f, image_url: body.url }));
      toast.success("Изображение загружено");
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  };

  const togglePause = useMutation({
    mutationFn: async ({ p, paused, message }: { p: Product; paused: boolean; message: string | null }) => {
      const { error } = await supabase.from("products").update({
        is_paused: paused, paused_message: paused ? message : null,
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creator-products", userId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setPausing(null); setPauseMsg("");
    },
  });

  const remove = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Продукт удалён");
      qc.invalidateQueries({ queryKey: ["creator-products", userId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Мои продукты ({products.length})</CardTitle>
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Создать</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground">Пока нет продуктов. Создайте первый.</p>
        ) : (
          <div className="space-y-2">
            {products.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-14 h-14 rounded object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded bg-muted flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.title}</div>
                  <div className="text-sm text-muted-foreground">{formatKZT(Number(p.price))}</div>
                </div>
                {p.is_paused && <Badge variant="secondary">На паузе</Badge>}
                {!p.is_active && <Badge variant="destructive">Скрыт</Badge>}
                <div className="flex gap-1">
                  <Button asChild size="sm" variant="ghost" title="Открыть">
                    <Link to={`/product/${p.id}`}><Eye className="w-4 h-4" /></Link>
                  </Button>
                  <Button size="sm" variant="ghost" title="Редактировать" onClick={() => openEdit(p)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" title={p.is_paused ? "Возобновить" : "Приостановить"}
                    onClick={() => {
                      if (p.is_paused) togglePause.mutate({ p, paused: false, message: null });
                      else { setPausing(p); setPauseMsg(p.paused_message ?? ""); }
                    }}>
                    {p.is_paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" title="Удалить" onClick={() => setDeleting(p)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать продукт" : "Новый продукт"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Обложка</Label>
              <div className="flex items-center gap-3 mt-1">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="w-20 h-20 rounded object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded bg-muted flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); }} />
                  <Button asChild variant="outline" size="sm" disabled={uploading}>
                    <span>{uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Загрузка</> : "Загрузить"}</span>
                  </Button>
                </label>
                {form.image_url && (
                  <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, image_url: null }))}>
                    Удалить
                  </Button>
                )}
              </div>
            </div>
            <div><Label>Название *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Подзаголовок</Label>
              <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></div>
            <div><Label>Описание</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Цена, ₸</Label>
                <Input type="number" min={0} value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
              <div><Label>Доступ, дней</Label>
                <Input type="number" min={0} value={form.access_duration_days ?? ""}
                  onChange={(e) => setForm({ ...form, access_duration_days: e.target.value ? Number(e.target.value) : null })} /></div>
            </div>
            <div><Label>Kaspi ссылка</Label>
              <Input value={form.kaspi_link} onChange={(e) => setForm({ ...form, kaspi_link: e.target.value })} /></div>
            <div><Label>Kaspi телефон</Label>
              <Input value={form.kaspi_phone} placeholder="+7..."
                onChange={(e) => setForm({ ...form, kaspi_phone: e.target.value })} /></div>
            <div><Label>Telegram / ссылка группы</Label>
              <Input value={form.telegram_link} onChange={(e) => setForm({ ...form, telegram_link: e.target.value })} /></div>
            <div><Label>Подпись ссылки группы</Label>
              <Input value={form.group_link_label} placeholder="Присоединиться к чату"
                onChange={(e) => setForm({ ...form, group_link_label: e.target.value })} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="cursor-pointer">Расписание занятий</Label>
                <p className="text-xs text-muted-foreground">Разрешить ученикам записываться на слоты</p>
              </div>
              <Switch checked={form.has_schedule}
                onCheckedChange={(v) => setForm({ ...form, has_schedule: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pausing} onOpenChange={(o) => { if (!o) { setPausing(null); setPauseMsg(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Приостановить продукт</DialogTitle>
            <DialogDescription>
              По ссылке на продукт можно будет перейти, но покупка будет недоступна. Ученики увидят ваше сообщение.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={pauseMsg} placeholder="Например: Набор временно закрыт, следующий поток в сентябре."
            onChange={(e) => setPauseMsg(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Никто не сможет совершить оплату, пока продукт на паузе.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPausing(null)}>Отмена</Button>
            <Button onClick={() => pausing && togglePause.mutate({ p: pausing, paused: true, message: pauseMsg.trim() || null })}>
              Приостановить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить продукт?</AlertDialogTitle>
            <AlertDialogDescription>
              Действие необратимо. Все связанные материалы, расписания и записи учеников будут утеряны.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default CreatorProductsTab;