import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Material, useProductMaterials, fetchMaterialUrl } from "@/hooks/useMaterials";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ChevronRight, Folder, FileText, Link as LinkIcon,
  FileIcon, Download, ExternalLink, Loader2, Home,
} from "lucide-react";
import { toast } from "sonner";
import AnnouncementsSection from "@/components/AnnouncementsSection";

type AccessStatus = "loading" | "granted" | "denied";

const iconFor = (t: Material["type"]) => {
  if (t === "folder") return <Folder className="w-5 h-5 text-primary" />;
  if (t === "link") return <LinkIcon className="w-5 h-5 text-muted-foreground" />;
  if (t === "text") return <FileText className="w-5 h-5 text-muted-foreground" />;
  return <FileIcon className="w-5 h-5 text-muted-foreground" />;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return "";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

const MaterialsPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<AccessStatus>("loading");
  const [productTitle, setProductTitle] = useState<string>("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [textView, setTextView] = useState<Material | null>(null);

  const { data: materials = [], isLoading } = useProductMaterials(productId);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!productId) { navigate("/dashboard"); return; }
    (async () => {
      const { data: prod } = await supabase.from("products")
        .select("id,title,owner_id").eq("id", productId).maybeSingle();
      setProductTitle(prod?.title ?? "");
      if (prod?.owner_id === user.id) { setAccess("granted"); return; }

      const { data: teacher } = await supabase.from("product_teachers")
        .select("teacher_user_id").eq("product_id", productId).eq("teacher_user_id", user.id).maybeSingle();
      if (teacher) { setAccess("granted"); return; }

      const { data: purchase } = await supabase.from("purchases")
        .select("id").eq("user_id", user.id).eq("product_id", productId)
        .eq("status", "completed").maybeSingle();
      setAccess(purchase ? "granted" : "denied");
    })();
  }, [authLoading, user, productId, navigate]);

  const byParent = useMemo(() => {
    const map = new Map<string | null, Material[]>();
    for (const m of materials) {
      const arr = map.get(m.parent_id) ?? [];
      arr.push(m);
      map.set(m.parent_id, arr);
    }
    return map;
  }, [materials]);

  const path = useMemo(() => {
    const chain: Material[] = [];
    let cur = folderId;
    const byId = new Map(materials.map((m) => [m.id, m]));
    while (cur) {
      const m = byId.get(cur);
      if (!m) break;
      chain.unshift(m);
      cur = m.parent_id;
    }
    return chain;
  }, [folderId, materials]);

  const items = byParent.get(folderId) ?? [];

  const openMaterial = async (m: Material) => {
    if (m.type === "folder") { setFolderId(m.id); return; }
    if (m.type === "text") { setTextView(m); return; }
    if (m.type === "link") {
      if (m.content) window.open(m.content, "_blank", "noopener");
      return;
    }
    // file
    try {
      setBusyId(m.id);
      const url = await fetchMaterialUrl(m.id, false);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const downloadMaterial = async (m: Material) => {
    try {
      setBusyId(m.id);
      const url = await fetchMaterialUrl(m.id, true);
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || access === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (access === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Нет доступа</h1>
          <p className="text-muted-foreground">У вас нет подтверждённой покупки этого продукта.</p>
          <Button asChild><Link to="/dashboard">В кабинет</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild size="sm" variant="ghost">
            <Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" />Кабинет</Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">Материалы</div>
            <div className="font-semibold truncate">{productTitle}</div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex items-center gap-1 text-sm overflow-x-auto">
          <button onClick={() => setFolderId(null)}
            className="flex items-center gap-1 hover:text-primary text-muted-foreground shrink-0">
            <Home className="w-3.5 h-3.5" /> Дом
          </button>
          {path.map((f) => (
            <span key={f.id} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <button onClick={() => setFolderId(f.id)}
                className={`hover:text-primary ${f.id === folderId ? "font-medium" : "text-muted-foreground"}`}>
                {f.title}
              </button>
            </span>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        {productId && folderId === null && (
          <div className="mb-4">
            <AnnouncementsSection productId={productId} canEdit={false} />
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <p className="text-center py-16 text-muted-foreground">Здесь пока пусто.</p>
        ) : (
          <div className="space-y-2">
            {items.map((m) => {
              const canDownload = m.type === "file" && (m.allow_download || m.teacher_allow_download);
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/40 transition-colors">
                  <button onClick={() => openMaterial(m)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    {iconFor(m.type)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{m.title}</div>
                      {m.type === "file" && m.file_size ? (
                        <div className="text-xs text-muted-foreground">{formatSize(m.file_size)}</div>
                      ) : null}
                    </div>
                  </button>
                  {busyId === m.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : m.type === "file" ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openMaterial(m)} title="Открыть">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      {canDownload && (
                        <Button size="icon" variant="ghost" onClick={() => downloadMaterial(m)} title="Скачать">
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ) : m.type === "link" ? (
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  ) : m.type === "folder" ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {textView && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col" onClick={() => setTextView(null)}>
          <div className="max-w-3xl mx-auto w-full p-4 flex-1 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <Button size="sm" variant="ghost" onClick={() => setTextView(null)}>
                <ArrowLeft className="w-4 h-4 mr-1" />Назад
              </Button>
              <h2 className="font-semibold truncate">{textView.title}</h2>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{textView.content ?? ""}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialsPage;