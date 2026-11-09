export interface ModeratorThread {
  id: string;
  user_type: string;
  user_ref: string;
  display_name: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_for_moderator: number;
}
export interface PreviewMaterial {
  id: string;
  title: string;
  type: string;
  content?: string;
  parent_id?: string;
  preview_url?: string;
  file_url?: string;
  teacher_id?: string;
}
export interface ModeratorResponse {
  success?: boolean;
  error?: string;
  thread?: ModeratorThread;
  products?: { id: string; title: string }[];
  materials?: PreviewMaterial[];
  announcements?: { id: string; content_html: string }[];
  schedules?: {
    id: string;
    title: string;
    time_slots: {
      id: string;
      date: string;
      start_time: string;
      end_time: string;
    }[];
  }[];
  threads?: { id: string; buyer_profile_id: string }[];
  messages?: {
    id: string;
    thread_id: string;
    sender: string;
    text: string;
    created_at: string;
    attachments: { name: string; url?: string }[];
  }[];
}
export type ModeratorCall = (
  body: Record<string, unknown>,
) => Promise<ModeratorResponse>;

export interface ProductReport {
  id: string;
  product_id: string | null;
  creator_account_id: string | null;
  product_title: string | null;
  seller_name: string | null;
  target_type: "product" | "account";
  reporter_name: string | null;
  reporter_user_ref: string | null;
  reason: string;
  description: string | null;
  status:
    | "pending"
    | "correction_requested"
    | "dismissed"
    | "blocked"
    | "resolved";
  created_at: string;
  report_number: number;
  product_report_number?: number;
  correction_text: string | null;
  correction_deadline: string | null;
}
export const incomingReport = (r: ProductReport) =>
  r.status === "pending" || r.status === "correction_requested";
