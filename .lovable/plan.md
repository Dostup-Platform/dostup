Change the initial state of `detailsOpen` from `false` to `true` in `ProductForm` so the "Детали" section is expanded by default when a creator opens the create/edit product form. The plus/minus toggle remains functional for collapsing/expanding.

File: `src/components/creator/CreatorProductsTab.tsx` line ~109.
- `const [detailsOpen, setDetailsOpen] = useState(false);` → `useState(true);`
- `paymentOpen` stays `false` by default.