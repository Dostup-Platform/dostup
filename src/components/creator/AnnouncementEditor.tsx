import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline as UnderlineIcon, Heading2, Link as LinkIcon, Image as ImageIcon, Video, Eraser, Loader2 } from "lucide-react";
import { uploadAnnouncementMedia } from "@/hooks/useAnnouncements";
import { toast } from "sonner";
import { useState } from "react";

interface Props {
  productId: string;
  initialHtml?: string;
  onSave: (html: string) => Promise<void> | void;
  onCancel?: () => void;
  saving?: boolean;
  submitLabel?: string;
}

const AnnouncementEditor = ({ productId, initialHtml = "", onSave, onCancel, saving, submitLabel = "Опубликовать" }: Props) => {
  const imgInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: initialHtml || "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[180px] focus:outline-none px-3 py-2",
      },
    },
  });

  useEffect(() => {
    return () => { editor?.destroy(); };
  }, [editor]);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL ссылки:", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const handleFile = async (file: File, kind: "image" | "video") => {
    setUploading(true);
    try {
      const url = await uploadAnnouncementMedia(file, productId, kind);
      if (kind === "image") {
        editor.chain().focus().setImage({ src: url }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent(`<p><video src="${url}" controls style="max-width:100%"></video></p>`) 
          .run();
      }
    } catch (e) {
      toast.error("Не удалось загрузить файл");
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <Button type="button" size="sm" variant={active ? "default" : "toggle"} onClick={onClick} title={title} className="h-8 w-8 p-0">
      {icon}
    </Button>
  );

  return (
    <div className="border rounded-md bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold className="w-4 h-4" />, "Жирный")}
        {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic className="w-4 h-4" />, "Курсив")}
        {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon className="w-4 h-4" />, "Подчёркнутый")}
        {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="w-4 h-4" />, "Заголовок")}
        {btn(editor.isActive("link"), setLink, <LinkIcon className="w-4 h-4" />, "Ссылка")}
        {btn(false, () => imgInputRef.current?.click(), <ImageIcon className="w-4 h-4" />, "Картинка")}
        {btn(false, () => videoInputRef.current?.click(), <Video className="w-4 h-4" />, "Видео")}
        {btn(false, () => editor.chain().focus().clearNodes().unsetAllMarks().run(), <Eraser className="w-4 h-4" />, "Очистить форматирование")}
        {uploading && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
      </div>
      <EditorContent editor={editor} />
      <input ref={imgInputRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, "image"); e.target.value = ""; }} />
      <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, "video"); e.target.value = ""; }} />
      <div className="flex justify-end gap-2 border-t px-2 py-2">
        {onCancel && <Button type="button" variant="toggle" size="sm" onClick={onCancel} disabled={saving}>Отмена</Button>}
        <Button type="button" size="sm" onClick={() => onSave(editor.getHTML())} disabled={saving || uploading}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};

export default AnnouncementEditor;