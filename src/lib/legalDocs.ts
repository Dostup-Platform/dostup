import legalDocsRaw from "../../dostup-legal-docs.md?raw";

export type LegalDocId = "terms" | "privacy";

export type LegalDocument = {
  id: LegalDocId;
  title: string;
  updated: string;
  body: string;
};

const parseDocument = (id: LegalDocId, block: string): LegalDocument => {
  const lines = block.trim().split("\n");
  let title = "";
  let updated = "";
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("title:")) {
      title = line.slice("title:".length).trim();
      bodyStart = i + 1;
      continue;
    }
    if (line.startsWith("updated:")) {
      updated = line.slice("updated:".length).trim();
      bodyStart = i + 1;
      continue;
    }
    if (line.startsWith("## ")) {
      bodyStart = i;
      break;
    }
  }

  return {
    id,
    title,
    updated,
    body: lines.slice(bodyStart).join("\n").trim(),
  };
};

const parseLegalDocs = (raw: string): Record<LegalDocId, LegalDocument> => {
  const blocks = raw
    .trim()
    .split(/\n(?=# (?:terms|privacy)\b)/)
    .map((block) => block.trim())
    .filter(Boolean);

  const docs = {} as Record<LegalDocId, LegalDocument>;

  for (const block of blocks) {
    const match = block.match(/^# (terms|privacy)\s*\n([\s\S]*)$/);
    if (!match) continue;
    const id = match[1] as LegalDocId;
    docs[id] = parseDocument(id, match[2]);
  }

  return docs;
};

export const legalDocuments = parseLegalDocs(legalDocsRaw);

export const getLegalDocument = (id: LegalDocId): LegalDocument | undefined => legalDocuments[id];
