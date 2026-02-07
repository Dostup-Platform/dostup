import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Check, Clock, Loader2, UserX, Users, ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
  }).format(price);
};

interface PurchaseWithUser {
  id: string;
  status: string;
  amount: number;
  created_at: string;
  product_id: string;
  assigned_teacher_id: string | null;
  can_choose_teacher: boolean | null;
  simple_user: {
    id: string;
    name: string;
    phone: string;
  };
  product: {
    title: string;
  };
}

interface Teacher {
  id: string;
  name: string;
}

interface CreatorUsersTabProps {
  creatorName: string;
}

const CreatorUsersTab = ({ creatorName }: CreatorUsersTabProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [revokeDialog, setRevokeDialog] = useState<{ id: string; name: string } | null>(null);
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  // Получить ID автора (simple_users)
  const { data: creatorId } = useQuery({
    queryKey: ["creator-user-id", creatorName],
    queryFn: async () => {
      if (!creatorName) return null;
      const { data } = await supabase
        .from("simple_users")
        .select("id")
        .eq("name", creatorName)
        .eq("role", "creator")
        .single();
      return data?.id || null;
    },
    enabled: !!creatorName,
  });

  // Получить все покупки продуктов этого создателя
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["creator-purchases", creatorName],
    queryFn: async () => {
      if (!creatorName) return [];

      // Сначала получить продукты создателя по имени (creator_id = имя креатора)
      const { data: products } = await supabase
        .from("products")
        .select("id, title")
        .eq("creator_id", creatorName);

      if (!products?.length) return [];

      const productIds = products.map(p => p.id);

      // Получить покупки для этих продуктов
      const { data: purchasesData } = await supabase
        .from("simple_purchases")
        .select(`
          id,
          status,
          amount,
          created_at,
          product_id,
          simple_user_id,
          assigned_teacher_id,
          can_choose_teacher
        `)
        .in("product_id", productIds)
        .order("created_at", { ascending: false });

      if (!purchasesData?.length) return [];

      // Получить информацию о пользователях
      const userIds = [...new Set(purchasesData.map(p => p.simple_user_id))];
      const { data: usersData } = await supabase
        .from("simple_users")
        .select("id, name, phone")
        .in("id", userIds);

      // Собрать данные вместе
      return purchasesData.map(purchase => ({
        ...purchase,
        simple_user: usersData?.find(u => u.id === purchase.simple_user_id) || { id: "", name: "Unknown", phone: "" },
        product: products.find(p => p.id === purchase.product_id) || { title: "Unknown" }
      })) as PurchaseWithUser[];
    },
    enabled: !!creatorName,
  });

  // Получить учителей для продуктов автора
  const { data: teachersMap = {} } = useQuery({
    queryKey: ["creator-product-teachers", creatorName],
    queryFn: async () => {
      if (!creatorName) return {};

      const { data: products } = await supabase
        .from("products")
        .select("id")
        .eq("creator_id", creatorName);

      if (!products?.length) return {};

      const productIds = products.map(p => p.id);

      // Получить назначенных учителей
      const { data: productTeachers } = await supabase
        .from("product_teachers")
        .select("product_id, teacher_name")
        .in("product_id", productIds);

      if (!productTeachers?.length) return {};

      // Получить ID учителей
      const teacherNames = [...new Set(productTeachers.map(pt => pt.teacher_name))];
      const { data: teacherUsers } = await supabase
        .from("simple_users")
        .select("id, name")
        .in("name", teacherNames)
        .eq("role", "teacher");

      // Создать карту product_id -> teachers[]
      const map: Record<string, Teacher[]> = {};
      productTeachers.forEach(pt => {
        if (!map[pt.product_id]) map[pt.product_id] = [];
        const teacher = teacherUsers?.find(t => t.name === pt.teacher_name);
        if (teacher && !map[pt.product_id].some(t => t.id === teacher.id)) {
          map[pt.product_id].push(teacher);
        }
      });

      return map;
    },
    enabled: !!creatorName,
  });

  // Мутация для подтверждения оплаты
  const confirmPayment = useMutation({
    mutationFn: async (purchaseId: string) => {
      const creatorToken = localStorage.getItem("creator_token");
      const { data, error } = await supabase.functions.invoke('approve-purchase', {
        body: { 
          purchaseId, 
          creatorToken, 
          creatorName 
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to approve');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-purchases"] });
      toast.success(t("paymentConfirmed") || "Оплата подтверждена!");
    },
    onError: () => {
      toast.error("Ошибка при подтверждении");
    },
  });

  // Мутация для отзыва доступа
  const revokeAccess = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase
        .from("simple_purchases")
        .update({ status: "revoked" })
        .eq("id", purchaseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-purchases"] });
      toast.success(t("accessRevoked") || "Доступ закрыт");
      setRevokeDialog(null);
    },
    onError: () => {
      toast.error("Ошибка при закрытии доступа");
    },
  });

  // Мутация для изменения назначенного учителя
  const updateTeacherAssignment = useMutation({
    mutationFn: async ({ purchaseId, teacherId, canChoose }: { purchaseId: string; teacherId: string | null; canChoose: boolean }) => {
      const { error } = await supabase
        .from("simple_purchases")
        .update({ 
          assigned_teacher_id: teacherId,
          can_choose_teacher: canChoose
        })
        .eq("id", purchaseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-purchases"] });
      toast.success(language === "ru" ? "Расписание изменено" : "Кесте өзгертілді");
    },
    onError: () => {
      toast.error(language === "ru" ? "Ошибка при изменении" : "Өзгерту қатесі");
    },
  });

  // Получить текст для текущего назначения
  const getAssignmentLabel = (purchase: PurchaseWithUser) => {
    if (purchase.can_choose_teacher) {
      return language === "ru" ? "Выбирает сам" : "Өзі таңдайды";
    }
    if (!purchase.assigned_teacher_id || purchase.assigned_teacher_id === creatorId) {
      return language === "ru" ? "Автор" : "Автор";
    }
    // Найти имя учителя
    const teachers = teachersMap[purchase.product_id] || [];
    const teacher = teachers.find(t => t.id === purchase.assigned_teacher_id);
    return teacher?.name || (language === "ru" ? "Учитель" : "Мұғалім");
  };

  // Обработчик выбора учителя
  const handleTeacherChange = (purchaseId: string, value: string) => {
    if (value === "author") {
      updateTeacherAssignment.mutate({ purchaseId, teacherId: creatorId, canChoose: false });
    } else if (value === "choose") {
      updateTeacherAssignment.mutate({ purchaseId, teacherId: null, canChoose: true });
    } else {
      updateTeacherAssignment.mutate({ purchaseId, teacherId: value, canChoose: false });
    }
  };

  // Получить текущее значение для Select
  const getCurrentValue = (purchase: PurchaseWithUser) => {
    if (purchase.can_choose_teacher) return "choose";
    if (!purchase.assigned_teacher_id || purchase.assigned_teacher_id === creatorId) return "author";
    return purchase.assigned_teacher_id;
  };

  const pendingPurchases = purchases.filter(p => p.status === "pending");
  const completedPurchases = purchases.filter(p => p.status === "completed");

  const filteredPending = pendingPurchases.filter(
    (p) =>
      p.simple_user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.simple_user.phone.includes(searchQuery)
  );

  const filteredCompleted = completedPurchases.filter(
    (p) =>
      p.simple_user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.simple_user.phone.includes(searchQuery)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder={t("searchUsers") || "Поиск пользователей..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      {/* Pending Payments Section */}
      {filteredPending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("pendingPayments")} ({filteredPending.length})
            </h2>
          </div>

          {filteredPending.map((purchase, index) => (
            <Card 
              key={purchase.id} 
              className="border-warning/30 bg-warning/5 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-warning">
                      {purchase.simple_user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">{purchase.simple_user.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {purchase.product.title} · {formatPrice(Number(purchase.amount))}
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    className="h-7 text-xs flex-shrink-0"
                    onClick={() => confirmPayment.mutate(purchase.id)}
                    disabled={confirmPayment.isPending}
                  >
                    {confirmPayment.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmed Users Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("paidUsers")}</h2>
          <span className="text-sm text-muted-foreground">{filteredCompleted.length} {t("total") || "всего"}</span>
        </div>

        {filteredCompleted.length === 0 && filteredPending.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("noPaidUsers")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("usersWillAppear")}</p>
          </div>
        )}

        {filteredCompleted.map((purchase, index) => {
          const productTeachers = teachersMap[purchase.product_id] || [];
          const hasTeachers = productTeachers.length > 0;

          return (
            <Card 
              key={purchase.id} 
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-success">
                      {purchase.simple_user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-medium text-foreground truncate">{purchase.simple_user.name}</h3>
                      <Check className="w-3 h-3 text-success flex-shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {purchase.product.title} · <span className="text-success">{formatPrice(Number(purchase.amount))}</span>
                    </p>
                    
                    {/* Выбор учителя */}
                    {hasTeachers && (
                      <div className="mt-2 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <Select
                          value={getCurrentValue(purchase)}
                          onValueChange={(value) => handleTeacherChange(purchase.id, value)}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1 max-w-[180px]">
                            <SelectValue placeholder={language === "ru" ? "Расписание" : "Кесте"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="author">
                              {language === "ru" ? "Автор" : "Автор"}
                            </SelectItem>
                            {productTeachers.map((teacher) => (
                              <SelectItem key={teacher.id} value={teacher.id}>
                                {teacher.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="choose">
                              {language === "ru" ? "Выбирает сам" : "Өзі таңдайды"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={() => setRevokeDialog({ id: purchase.id, name: purchase.simple_user.name })}
                    title={t("revokeAccess") || "Закрыть доступ"}
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revoke Access Confirmation Dialog */}
      <AlertDialog open={!!revokeDialog} onOpenChange={() => setRevokeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeAccessTitle") || "Закрыть доступ?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("revokeAccessDescription") || "Вы уверены, что хотите закрыть доступ пользователю"} <strong>{revokeDialog?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeDialog && revokeAccess.mutate(revokeDialog.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeAccess.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {t("revokeAccess") || "Закрыть доступ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CreatorUsersTab;
