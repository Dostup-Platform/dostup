type SidebarProfile = {
  id: string;
  type: string;
  createdAt?: string | null;
};

/** Newest seller profiles first; buyer/student always last. */
export function profilesInSidebarOrder<T extends SidebarProfile>(profiles: T[]): T[] {
  return [...profiles].sort((a, b) => {
    const aBuyer = a.type === "buyer" ? 1 : 0;
    const bBuyer = b.type === "buyer" ? 1 : 0;
    if (aBuyer !== bBuyer) return aBuyer - bBuyer;
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (aTime !== bTime) return bTime - aTime;
    return b.id.localeCompare(a.id);
  });
}

/** @deprecated Use profilesInSidebarOrder */
export const profilesInCreationOrder = profilesInSidebarOrder;
