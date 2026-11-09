import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { checkSignals, supportIdentity } from "./moderation.ts";
import { moderatorReports } from "./moderatorReports.ts";
import { handleTokenizedDownload } from "./tokenized-download.ts";

function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
function fakeDb(
  rows: Record<string, unknown>,
  onRequest?: (url: URL, body: Record<string, unknown>) => void,
): SupabaseClient {
  return createClient("https://moderation.test", "test-service-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
            ? input.href
            : input.url,
        );
        const body = typeof init?.body === "string"
          ? JSON.parse(init.body)
          : {};
        onRequest?.(url, body);
        const table = url.pathname.split("/").pop()!;
        const value = rows[table] ?? null;
        return new Response(JSON.stringify(value), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
}
Deno.test("support identity requires a live session; supplied reporter IDs are ignored", async () => {
  const identity = await supportIdentity(fakeDb({}), {
    user_id: "victim",
    user_ref: "victim",
    reporter_name: "Forged",
  });
  assert(identity === null, "Unauthenticated reporter accepted");
});
Deno.test("buyer chat is derived from session profile, never user_ref or user_type", async () => {
  const db = fakeDb({
    creator_sessions: { profile_id: "real-buyer" },
    profiles: { id: "real-buyer", type: "buyer", display_name: "Real buyer" },
    product_teachers: [],
  });
  const identity = await supportIdentity(db, {
    token: "session",
    user_ref: "victim",
    user_type: "creator",
    reporter_name: "Forged",
  });
  assert(
    identity?.profileId === "real-buyer" && identity.userRef === "real-buyer" &&
      identity.userType === "student" && identity.displayName === "Real buyer",
    "Spoofed support identity",
  );
});
Deno.test("seller profile resolves its own support thread when only token is supplied", async () => {
  const db = fakeDb({
    creator_sessions: { profile_id: "seller-profile" },
    profiles: { id: "seller-profile", type: "creator", display_name: "Seller" },
    creator_accounts: {
      login: "real-seller",
      display_name: "Real seller",
      is_blocked: false,
    },
    product_teachers: [],
  });
  const identity = await supportIdentity(db, {
    token: "session",
    user_ref: "another-seller",
  });
  assert(
    identity?.userType === "creator" && identity.userRef === "real-seller",
    "Wrong seller support thread",
  );
});
Deno.test("blocked seller cannot access support through a surviving stale profile", async () => {
  const db = fakeDb({
    creator_sessions: { profile_id: "seller-profile" },
    profiles: { id: "seller-profile", type: "creator", display_name: "Seller" },
    creator_accounts: { login: "seller", is_blocked: true },
    product_teachers: [],
  });
  assert(
    await supportIdentity(db, { token: "stale" }) === null,
    "Blocked seller accepted",
  );
});
Deno.test("IP is taken only from configured trusted gateway, signals are hashed", async () => {
  Deno.env.set("MODERATION_TRUSTED_IP_HEADER", "x-trusted-ip");
  let checked = false;
  const db = fakeDb({ check_moderation_signals: true }, (url, body) => {
    assert(url.pathname.endsWith("/rpc/check_moderation_signals"), "Wrong RPC");
    assert(
      typeof body.p_device_hash === "string" &&
        /^[a-f0-9]{64}$/.test(body.p_device_hash),
      "Device was not hashed",
    );
    assert(
      typeof body.p_ip_hash === "string" &&
        /^[a-f0-9]{64}$/.test(body.p_ip_hash),
      "IP was not hashed",
    );
    assert(body.p_token === "session", "Session signal not recorded");
    checked = true;
  });
  const request = new Request("https://app.test", {
    headers: { "x-trusted-ip": "192.0.2.12" },
  });
  assert(
    await checkSignals(db, request, {
      token: "session",
      deviceId: "12345678-1234-1234-1234-123456789012",
      ip: "forged",
    }),
    "Allowed signal denied",
  );
  assert(checked, "No signal check");
  Deno.env.delete("MODERATION_TRUSTED_IP_HEADER");
});
Deno.test("unconfigured client IP is never used as a ban signal", async () => {
  Deno.env.delete("MODERATION_TRUSTED_IP_HEADER");
  const db = fakeDb(
    { check_moderation_signals: true },
    (_url, body) => assert(body.p_ip_hash === null, "Untrusted IP used"),
  );
  await checkSignals(
    db,
    new Request("https://app.test", {
      headers: { "x-forwarded-for": "192.0.2.1" },
    }),
    { ip: "192.0.2.2" },
  );
});
Deno.test("denied device/IP fails closed", async () => {
  assert(
    !await checkSignals(
      fakeDb({ check_moderation_signals: false }),
      new Request("https://app.test"),
      {},
    ),
    "Banned signals accepted",
  );
});
Deno.test("report list retains all decisions and assigns repeated product and seller counts", async () => {
  const reports = [
    {
      id: "new",
      creator_account_id: "seller",
      target_type: "product",
      product_id: "product",
      status: "pending",
    },
    {
      id: "old",
      creator_account_id: "seller",
      target_type: "product",
      product_id: "product",
      status: "dismissed",
    },
  ];
  const response = await moderatorReports(
    fakeDb({ product_reports: reports }),
    { action: "list_reports" },
  );
  const data = await response!.json();
  assert(
    data.reports.length === 2 && data.reports[0].report_number === 2 &&
      data.reports[0].product_report_number === 2,
    "Historical report lost or repeated count wrong",
  );
});
Deno.test("moderation rejects arbitrary report status", async () => {
  const response = await moderatorReports(fakeDb({}), {
    action: "update_report_status",
    status: "made-up",
    report_id: "report",
  });
  assert(response?.status === 400, "Invalid decision accepted");
});
Deno.test("preview methods cannot mutate seller data", async () => {
  assert(
    await moderatorReports(fakeDb({}), {
      action: "preview_update",
      product_id: "product",
    }) === null,
    "Preview exposed a mutation",
  );
});
Deno.test("legacy download endpoints require a session even when caller claims creator or buyer role", async () => {
  Deno.env.set("SUPABASE_URL", "https://moderation.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  for (const role of ["creator", "teacher", "student"]) {
    const get = await handleTokenizedDownload(
      new Request(
        `https://app.test/download?path=s3://bucket/product/private.pdf&role=${role}&userId=victim`,
      ),
    );
    assert(get.status === 403, `GET trusted forged role: ${role}`);
    const post = await handleTokenizedDownload(
      new Request("https://app.test/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: "s3://bucket/product/private.pdf",
          role,
          userId: "victim",
        }),
      }),
    );
    assert(post.status === 403, `POST trusted forged role: ${role}`);
  }
});

Deno.test("report history is not truncated at the API row cap", async () => {
  const rows = Array.from(
    { length: 1002 },
    (_, i) => ({
      id: String(i),
      created_at: "2026-11-09T00:00:00Z",
      creator_account_id: "seller",
      product_id: "product",
      target_type: "product",
      status: i === 0 ? "pending" : "dismissed",
    }),
  );
  const db = createClient("https://moderation.test", "test-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        const offset = Number(url.searchParams.get("offset") || 0);
        return new Response(JSON.stringify(rows.slice(offset, offset + 500)), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
  const response = await moderatorReports(db, { action: "list_reports" });
  const result = await response!.json();
  assert(
    result.reports.length === 1002 && result.reports[0].report_number === 1002,
    "Older decisions disappeared beyond row limit",
  );
});
