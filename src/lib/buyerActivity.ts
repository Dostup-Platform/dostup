export type LastOpenedMaterial = {
  materialId: string;
  materialTitle: string;
  productId: string;
  productTitle: string;
  openedAt: string;
  progressPercent?: number;
};

export function lastMaterialKey(userId: string) {
  return `buyer_last_material_${userId}`;
}

export function readLastOpenedMaterial(userId: string): LastOpenedMaterial | null {
  try {
    const raw = localStorage.getItem(lastMaterialKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as LastOpenedMaterial;
  } catch {
    return null;
  }
}

export function rememberLastOpenedMaterial(userId: string, material: LastOpenedMaterial) {
  localStorage.setItem(lastMaterialKey(userId), JSON.stringify(material));
}

export function recentProductsKey(userId: string) {
  return `buyer_recent_products_${userId}`;
}

export function touchRecentProduct(userId: string, productId: string) {
  try {
    const key = recentProductsKey(userId);
    const raw = localStorage.getItem(key);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [productId, ...list.filter((id) => id !== productId)].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // private mode
  }
}

export function readRecentProductIds(userId: string): string[] {
  try {
    const raw = localStorage.getItem(recentProductsKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}
