import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxHeight?: number;
}

export const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ className, value, onChange, maxHeight = 220, rows = 1, ...props }, forwardedRef) => {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = () => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    if (el.scrollHeight > maxHeight) {
      el.style.overflowY = "auto";
    } else {
      el.style.overflowY = "hidden";
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      rows={rows}
      value={value}
      onChange={(e) => {
        adjustHeight();
        onChange?.(e);
      }}
      className={cn(
        "w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-base text-foreground font-normal leading-relaxed shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all resize-none overflow-hidden",
        className
      )}
      {...props}
    />
  );
});

AutoResizeTextarea.displayName = "AutoResizeTextarea";
