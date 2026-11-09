import { useQuery } from "@tanstack/react-query";
import { creatorCreds, invokeApi } from "@/lib/sessionApi";
export interface ModerationStatus {
  restricted: boolean;
  reports: {
    id: string;
    reason: string;
    status: string;
    correction_text: string | null;
    correction_deadline: string | null;
  }[];
  notifications: {
    id: string;
    body: string;
    event: string;
    created_at: string;
  }[];
}
export function useModerationStatus() {
  return useQuery({
    queryKey: ["seller-moderation", localStorage.getItem("profile_id")],
    enabled: !!localStorage.getItem("creator_token") &&
      ["creator", "school"].includes(
        localStorage.getItem("profile_type") || "",
      ),
    queryFn: () =>
      invokeApi<ModerationStatus>("manage-products", {
        action: "moderation_status",
        ...creatorCreds(),
      }, 0),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}
