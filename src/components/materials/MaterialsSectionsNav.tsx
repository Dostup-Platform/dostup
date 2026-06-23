import { Library, Star, MoreVertical, Trash2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useRef, useLayoutEffect, type ReactNode } from "react";

export type MaterialsSection = "library" | "bookmarks" | "trash" | "storage";

interface Props {
  value: MaterialsSection;
  onChange: (v: MaterialsSection) => void;
  addButton?: ReactNode;
  showAdd?: boolean;
  showTrash?: boolean;
  trashCount?: number;
  showStorage?: boolean;
}

export const MaterialsSectionsNav = ({
  value,
  onChange,
  addButton,
  showAdd = true,
  showTrash = false,
  trashCount = 0,
  showStorage = false,
}: Props) => {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const phantomRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  const items: { key: MaterialsSection; label: string; icon: typeof Library }[] = [
    { key: "library", label: language === "kk" ? "Кітапхана" : "Библиотека", icon: Library },
    { key: "bookmarks", label: language === "kk" ? "Белгіленгендер" : "Помеченные", icon: Star },
  ];
  if (showTrash) {
    items.push({ key: "trash", label: language === "kk" ? "Себет" : "Корзина", icon: Trash2 });
  }
  if (showStorage) {
    items.push({ key: "storage", label: language === "kk" ? "Қойма" : "Хранилище", icon: HardDrive });
  }

  useLayoutEffect(() => {
    const container = containerRef.current;
    const phantom = phantomRef.current;
    if (!container || !phantom) return;
    const check = () => {
      const available = container.clientWidth;
      const needed = phantom.scrollWidth;
      setOverflow(needed > available + 1);
    };
    const ro = new ResizeObserver(check);
    ro.observe(container);
    ro.observe(phantom);
    check();
    return () => ro.disconnect();
  }, [items.length, language, trashCount, showAdd]);

  const renderItemButton = (it: typeof items[number]) => {
    const Icon = it.icon;
    const active = value === it.key;
    return (
      <button
        key={it.key}
        onClick={() => onChange(it.key)}
        className={`relative inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap ${
          active
            ? "bg-accent/15 text-accent border-accent/40"
            : "bg-background text-muted-foreground border-input hover:bg-accent/10 hover:text-foreground"
        }`}
      >
        <Icon className="w-4 h-4" />
        <span>{it.label}</span>
        {it.key === "trash" && trashCount > 0 && (
          <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-semibold">
            {trashCount}
          </span>
        )}
      </button>
    );
  };

  const menuTrigger = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 flex-shrink-0 relative"
          aria-label={language === "kk" ? "Бөлімдер" : "Разделы"}
        >
          <MoreVertical className="w-4 h-4" />
          {trashCount > 0 && (
            <span className="absolute -top-1 -right-1 text-[10px] min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white font-semibold flex items-center justify-center">
              {trashCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>{language === "kk" ? "Бөлімдер" : "Разделы"}</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 mt-4">
          {items.map((it) => {
            const Icon = it.icon;
            const active = value === it.key;
            return (
              <button
                key={it.key}
                onClick={() => {
                  onChange(it.key);
                  setOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                  active
                    ? "bg-accent text-white"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1">{it.label}</span>
                {it.key === "trash" && trashCount > 0 && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-semibold">
                    {trashCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-2 w-full min-w-0 overflow-hidden"
    >
      {/* Phantom layout for measurement — always full size, never visible */}
      <div
        ref={phantomRef}
        aria-hidden="true"
        className="absolute left-0 top-0 flex items-center gap-2 pointer-events-none opacity-0"
        style={{ visibility: "hidden" }}
      >
        {items.map(renderItemButton)}
        {showAdd && addButton}
      </div>

      {overflow ? (
        <>
          {showAdd && addButton}
          {menuTrigger}
        </>
      ) : (
        <>
          {items.map(renderItemButton)}
          {showAdd && addButton}
        </>
      )}
    </div>
  );
};

export default MaterialsSectionsNav;
