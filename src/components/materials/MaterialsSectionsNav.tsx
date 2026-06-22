import { Library, Star, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, type ReactNode } from "react";

export type MaterialsSection = "library" | "bookmarks" | "trash";

interface Props {
  value: MaterialsSection;
  onChange: (v: MaterialsSection) => void;
  /** Rendered to the left of the menu trigger. */
  addButton?: ReactNode;
  /** Hide the Add button entirely. */
  showAdd?: boolean;
  /** Show the Trash section (creator only). */
  showTrash?: boolean;
  /** Optional badge next to Trash (count of items). */
  trashCount?: number;
}

export const MaterialsSectionsNav = ({ value, onChange, addButton, showAdd = true, showTrash = false, trashCount = 0 }: Props) => {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);

  const items: { key: MaterialsSection; label: string; icon: typeof Library }[] = [
    {
      key: "library",
      label: language === "kk" ? "Кітапхана" : "Библиотека",
      icon: Library,
    },
    {
      key: "bookmarks",
      label: language === "kk" ? "Белгіленгендер" : "Помеченные",
      icon: Star,
    },
  ];
  if (showTrash) {
    items.push({
      key: "trash",
      label: language === "kk" ? "Себет" : "Корзина",
      icon: Trash2,
    });
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {showAdd && addButton}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 flex-shrink-0"
            aria-label={language === "kk" ? "Бөлімдер" : "Разделы"}
          >
            <MoreVertical className="w-4 h-4" />
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
    </div>
  );
};

export default MaterialsSectionsNav;
