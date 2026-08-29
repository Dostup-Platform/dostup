import type { ReactNode } from "react";

const renderInline = (text: string): ReactNode[] => {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_|[^*_]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={`${match.index}-b`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("_") && token.endsWith("_")) {
      parts.push(<em key={`${match.index}-i`}>{token.slice(1, -1)}</em>);
    } else if (token) {
      parts.push(token);
    }
  }

  return parts;
};

const LegalDocumentBody = ({ markdown }: { markdown: string }) => {
  const blocks = markdown.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="space-y-4 text-base leading-[1.7] text-[#1F2328]">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const first = lines[0];

        if (first.startsWith("## ")) {
          return (
            <h2 key={index} className="pt-2 text-[20px] font-semibold leading-snug text-[#1F2328]">
              {renderInline(first.slice(3))}
            </h2>
          );
        }

        if (first.startsWith("### ")) {
          return (
            <h3 key={index} className="pt-1 text-[20px] font-semibold leading-snug text-[#1F2328]">
              {renderInline(first.slice(4))}
            </h3>
          );
        }

        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5">
              {lines.map((line, itemIndex) => (
                <li key={itemIndex}>{renderInline(line.slice(2))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
};

export default LegalDocumentBody;
