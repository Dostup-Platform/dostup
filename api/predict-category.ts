// Vercel serverless function для предсказания категории через Gemini API

export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { title, description = "", faq = [], categories = [] } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY is not configured",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const fullText = [
      `Название: ${title}`,
      description ? `Описание: ${description.replace(/<[^>]*>?/gm, "")}` : "",
      faq.length > 0 ? `FAQ: ${faq.map((f: any) => `В: ${f.question} О: ${f.answer}`).join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const systemInstruction = `Ты — экспертный AI-классификатор продуктов для маркетплейса Dostup.
Определи категорию, подкатегорию и тему продукта.
Верни ТОЛЬКО JSON:
{
  "categorySlug": "online-lessons" | "materials" | "subscriptions" | "events",
  "subcategorySlug": string,
  "lessonFormat": "individual" | "group" | null,
  "topic": string
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${systemInstruction}\n\nДАННЫЕ ПРОДУКТА:\n${fullText}` }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(resultText);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
