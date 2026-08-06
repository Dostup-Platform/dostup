import DOMPurify from "dompurify";
import { useMemo } from "react";

interface Props { html: string; }

const AnnouncementView = ({ html }: Props) => {
  const clean = useMemo(() => {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ["video", "source"],
      ADD_ATTR: ["controls", "src", "target", "rel", "style", "poster"],
    });
  }, [html]);
  return (
    <div
      className="prose prose-sm max-w-none break-words [&_img]:rounded-md [&_video]:rounded-md [&_a]:text-primary [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
};

export default AnnouncementView;