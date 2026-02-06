

# Fix: Creator Materials Dialog on Mobile

## Problem
On mobile, the materials dialog is clipped -- action buttons (especially delete) are cut off because the dialog uses a centered overlay with limited width/height, and the row of 4 action buttons overflows on narrow screens.

## Solution
Two changes to `src/components/creator/ProductMaterialsManager.tsx`:

### 1. Full-screen dialog on mobile
Change the `DialogContent` to be full-screen on mobile (no rounded corners, no margins, fills the viewport), while keeping the current desktop behavior:

```
className="max-w-3xl w-full sm:w-[95vw] max-h-full sm:max-h-[90vh] h-full sm:h-auto
           overflow-y-auto overflow-x-hidden p-3 sm:p-6 
           sm:rounded-lg rounded-none inset-0 sm:inset-auto
           sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
           left-0 top-0 translate-x-0 translate-y-0"
```

### 2. Action buttons layout on mobile
For each material row, change the layout so on mobile the action buttons sit on a second line below the title instead of being squeezed into the same row:

- Wrap the entire row in a vertical flex on mobile (`flex-col sm:flex-row`)
- Action buttons get their own row aligned to the right on small screens
- This guarantees download, view, edit, and delete buttons are always visible and tappable

### Files to edit
- `src/components/creator/ProductMaterialsManager.tsx` -- dialog sizing and material row layout

