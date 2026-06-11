## Plan: Reorder Creator Dashboard Tabs + Add Materials Tab

### Problem
The creator dashboard currently has 6 tabs in this order:
1. Объявления
2. Продукты
3. Пользователи
4. Расписание
5. Уведомления
6. Аккаунт

User wants 7 tabs in this order:
1. **Продукты** (leftmost)
2. **Объявления**
3. **Материалы** (new)
4. **Расписание**
5. **Пользователи**
6. **Уведомления**
7. **Аккаунт**

### Changes

#### 1. New Component: `CreatorMaterialsTab.tsx`
- Works exactly like `CreatorAnnouncementsTab.tsx` but opens `ProductMaterialsManager` instead of `ProductAnnouncementsManager`.
- Shows list of creator's products. Clicking a product opens its materials management view.
- Uses `Library` icon from lucide-react.

#### 2. Update `CreatorDashboard.tsx`
- Reorder all tab declarations (desktop + mobile) to: products → announcements → materials → schedule → users → notifications → account.
- Change default `activeTab` from `"announcements"` to `"products"`.
- Change desktop `TabsList` grid from `grid-cols-6` to `grid-cols-7`.
- Change mobile bottom nav `grid-cols-6` to `grid-cols-7`.
- Add import and `TabsContent` for `CreatorMaterialsTab`.

#### 3. Icons per tab (lucide-react)
- Продукты → `Package`
- Объявления → `Megaphone`
- Материалы → `Library`
- Расписание → `Calendar`
- Пользователи → `Users`
- Уведомления → `Bell`
- Аккаунт → `User`

### Files to Change
- `src/components/creator/CreatorMaterialsTab.tsx` (new)
- `src/pages/CreatorDashboard.tsx` (edit)

### Notes
- Translations already have `materials` key in both RU/KK.
- No database or edge function changes needed.
- `ProductMaterialsManager` already exists and accepts `productId`, `productTitle`, `isOpen`, `onClose`. We will embed it inline (not as a dialog) similar to how `ProductAnnouncementsManager` is used in `CreatorAnnouncementsTab`.