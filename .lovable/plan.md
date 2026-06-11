Add drag-and-drop + paste (Ctrl/Cmd+V) support to the cover image and video upload zones in the product create/edit form, matching the materials section behavior.

## File
`src/components/creator/CreatorProductsTab.tsx` (inside `ProductForm`)

## Changes

1. **Extract shared logic** from `handleImageChange` and `handleVideoChange` into two helpers that take a raw `File`:
   - `processImageFile(file: File)` — validate it's an image, then either set `pendingImageFile` (create mode) or upload via `uploadProductMedia` (edit mode).
   - `processVideoFile(file: File)` — run `getVideoDuration` + 3-min limit check, then set pending or upload (same branching as today).
   - Keep `handleImageChange`/`handleVideoChange` as thin wrappers that pull `e.target.files[0]` and call the helpers.

2. **Drag & drop** on each dropzone `<label>` (image and video):
   - Add `onDragOver` (preventDefault + visual highlight via state `isImageDragging` / `isVideoDragging`), `onDragLeave`, and `onDrop` (preventDefault, take first matching file from `e.dataTransfer.files`).
   - Dropzone keeps `cursor-pointer` and `border-dashed`; when dragging, swap border color to `border-primary` and background to `bg-primary/5`.

3. **Paste** support:
   - Add a `useEffect` that attaches a `paste` listener to `window` while the form is mounted (the dialog is the only thing on screen) and either zone is empty.
   - On paste, look at `e.clipboardData?.files`. If there's an image file and image slot is empty → `processImageFile`. If there's a video file and video slot is empty → `processVideoFile`. If both empty and both present, prefer image.
   - Cleanup on unmount.

4. **No changes** to upload endpoint, FAQ, payment section, schema, or any other file. The "replace existing media" flow still goes through the existing AlertDialog `XIcon` button — drop/paste only fills empty slots so users don't accidentally overwrite the current image/video.

## ASCII

```text
[ Обложка (изображение) ]
┌────────────────────────────┐
│  drag · drop · paste · click │  ← same dashed zone, now accepts all 3
└────────────────────────────┘

[ Видео-презентация (до 3 минут) ]
┌────────────────────────────┐
│  drag · drop · paste · click │
└────────────────────────────┘
```