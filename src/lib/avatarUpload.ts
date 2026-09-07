import { invokeApi } from "@/lib/sessionApi";

export async function uploadProfileAvatar(file: File, profileId?: string | null): Promise<string> {
  const token = localStorage.getItem("creator_token") || "";
  const targetProfileId = profileId || localStorage.getItem("profile_id") || "";
  const signed = await invokeApi<{ uploadUrl?: string; publicUrl?: string }>("presigned-upload", {
    purpose: "avatar",
    fileName: file.name,
    fileType: file.type,
    creatorToken: token,
    sessionToken: token,
    profileId: targetProfileId,
  });
  if (!signed.uploadUrl || !signed.publicUrl) throw new Error("sign");
  const put = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!put.ok) throw new Error("upload");
  await invokeApi("manage-profile", {
    action: "set_avatar",
    token,
    profileId: targetProfileId,
    avatarUrl: signed.publicUrl,
  });
  return signed.publicUrl;
}

export function invalidateAvatarQueries(queryClient: {
  invalidateQueries: (opts: { queryKey: string[] }) => unknown;
}) {
  void queryClient.invalidateQueries({ queryKey: ["catalog-search"] });
  void queryClient.invalidateQueries({ queryKey: ["catalog-preview"] });
  void queryClient.invalidateQueries({ queryKey: ["catalog-by-ids"] });
  void queryClient.invalidateQueries({ queryKey: ["seller-storefront"] });
  void queryClient.invalidateQueries({ queryKey: ["catalog-taxonomy"] });
  void queryClient.invalidateQueries({ queryKey: ["catalog-products"] });
  void queryClient.invalidateQueries({ queryKey: ["product"] });
}
