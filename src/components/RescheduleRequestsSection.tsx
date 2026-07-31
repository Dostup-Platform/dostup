import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  usePendingRescheduleRequests,
  useRespondRescheduleRequest,
  type RescheduleRequest,
} from "@/hooks/useReschedule";

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};
const fmtTime = (t: string) => t.slice(0, 5);

function RequestRow({
  request,
  studentLabel,
  respondedBy,
}: {
  request: RescheduleRequest;
  studentLabel: string;
  respondedBy: "creator" | "teacher";
}) {
  const respond = useRespondRescheduleRequest();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const handleApprove = async () => {
    try {
      await respond.mutateAsync({ request, approve: true, respondedBy });
      toast.success("Перенос подтверждён");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleReject = async () => {
    try {
      await respond.mutateAsync({
        request,
        approve: false,
        responseComment: rejectComment,
        respondedBy,
      });
      toast.success("Запрос отклонён");
      setRejectOpen(false);
      setRejectComment("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <div className="p-3 border rounded-lg space-y-2">
        <div className="font-medium truncate">{request.product_title}</div>
        <div className="text-sm text-muted-foreground">{studentLabel}</div>
        <div className="text-sm">
          <span className="text-muted-foreground">Было: </span>
          {fmtDate(request.old_date)} {fmtTime(request.old_time)}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Новое: </span>
          {fmtDate(request.new_date)} {fmtTime(request.new_time)}
        </div>
        {request.reasons && request.reasons.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Причины: {request.reasons.join(", ")}
          </div>
        )}
        {request.comment && (
          <div className="text-xs text-muted-foreground italic">«{request.comment}»</div>
        )}
        <div className="flex gap-2 pt-1">
          <Button size="sm" disabled={respond.isPending} onClick={handleApprove}>
            {respond.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Подтвердить
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={respond.isPending}
            onClick={() => setRejectOpen(true)}
          >
            Отклонить
          </Button>
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить запрос на перенос?</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Комментарий для ученика (опционально)"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={respond.isPending} onClick={handleReject}>
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RescheduleRequestsSection({
  mode,
  userId,
}: {
  mode: "creator" | "teacher";
  userId: string;
}) {
  const { data: requests = [], isLoading } = usePendingRescheduleRequests(mode, userId);

  const studentIds = Array.from(
    new Set(requests.map((r) => r.user_id).filter(Boolean) as string[]),
  );
  const { data: profiles = [] } = useQuery({
    queryKey: ["reschedule-student-profiles", studentIds.sort().join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,name,display_name,email")
        .in("user_id", studentIds);
      return data ?? [];
    },
  });
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Запросы на перенос ({requests.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-muted-foreground">Новых запросов на перенос нет.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const profile = req.user_id ? profileMap.get(req.user_id) : null;
              const studentLabel =
                profile?.name ||
                profile?.display_name ||
                profile?.email ||
                (req.user_id ? req.user_id.slice(0, 8) : "Ученик");
              return (
                <RequestRow
                  key={req.id}
                  request={req}
                  studentLabel={studentLabel}
                  respondedBy={mode === "teacher" ? "teacher" : "creator"}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
