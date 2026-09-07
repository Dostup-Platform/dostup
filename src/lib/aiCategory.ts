// Сервис интеллектуального определения категории, подкатегории и темы
import { TAXONOMY_DEFINITIONS, getPresetTopics } from "./taxonomyData";
import { type CatalogCategory } from "./catalog";

export interface CategoryPrediction {
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  subcategoryId: string;
  subcategorySlug: string;
  subcategoryName: string;
  topic: string;
}

export interface PredictInput {
  title: string;
  description?: string;
  faq?: Array<{ question: string; answer: string }>;
  categories: CatalogCategory[];
}

/**
 * Очищает название темы от любых эмодзи, флагов и спецсимволов для надежного сравнения
 */
export function cleanTopicStr(str: string): string {
  return (str || "")
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Проверяет, совпадает ли тема точно (с очисткой эмодзи и нормализацией регистра/пробелов)
 */
export function isExactTopicMatch(topicA: string, topicB: string): boolean {
  if (!topicA || !topicB) return false;
  if (topicA === topicB) return true;
  const a = cleanTopicStr(topicA);
  const b = cleanTopicStr(topicB);
  if (!a || !b) return false;
  return a === b;
}

/**
 * Проверяет, совпадает ли тема (с учетом эмодзи, синонимов и префиксов)
 */
export function isTopicMatch(topicA: string, topicB: string): boolean {
  if (!topicA || !topicB) return false;
  if (topicA === topicB) return true;
  const a = cleanTopicStr(topicA);
  const b = cleanTopicStr(topicB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  return false;
}

/**
 * Преобразует любую тему или синоним в точную предустановленную строку из каталога (включая эмодзи)
 */
export function resolvePresetTopic(predictedTopic: string, availableTopics: string[]): string {
  if (!predictedTopic) return "";
  const match = availableTopics.find((t) => isTopicMatch(predictedTopic, t));
  return match || "";
}

/**
 * Приоритетные сопоставители ключевых слов с темами.
 * Конкретные экзамены и предметы проверяются раньше общих языков.
 */
const TOPIC_MATCHERS: Array<{ match: RegExp; topicSubstrings: string[] }> = [
  // Экзамены и специализированные школы (приоритет над общими языками/предметами)
  { match: /(ielts|айелтс|аелтс)/i, topicSubstrings: ["IELTS"] },
  { match: /(toefl|тоефл|тоэфл)/i, topicSubstrings: ["TOEFL"] },
  { match: /(sat|сэт)/i, topicSubstrings: ["SAT"] },
  { match: /(ент|ubt|ұбт|ент-ға|ентга)/i, topicSubstrings: ["ЕНТ"] },
  { match: /(ниш|nish|нзм)/i, topicSubstrings: ["НИШ"] },
  { match: /(ктл|ktl|билом|білім-инновация|bil)/i, topicSubstrings: ["КТЛ"] },
  { match: /(рфмш|fizmat|физмат)/i, topicSubstrings: ["РФМШ"] },
  { match: /(поступлен|вуз|универ|абитуриент)/i, topicSubstrings: ["Поступление"] },

  // Языки
  { match: /(англ|english|инглиш|энглиш)/i, topicSubstrings: ["Английский"] },
  { match: /(казахск|қазақша|қазақ\s*тіл|qazaq\s*tili)/i, topicSubstrings: ["Казахский"] },
  { match: /(китай|chinese|hsk|қытай)/i, topicSubstrings: ["Китайский"] },
  { match: /(турец|turkish|түрк|tömer|томер)/i, topicSubstrings: ["Турецкий"] },
  { match: /(корей|korean|топик|topik)/i, topicSubstrings: ["Корейский"] },

  // Школьные и научные предметы
  { match: /(математ|алгебр|геометр|math)/i, topicSubstrings: ["Математика"] },
  { match: /(физик|physics)/i, topicSubstrings: ["Физика"] },
  { match: /(хими|chemistry)/i, topicSubstrings: ["Химия"] },
  { match: /(биолог|biology)/i, topicSubstrings: ["Биология"] },

  // IT и разработка
  { match: /(программир|python|javascript|react|frontend|backend|разработк|coding|код|html|css|typescript|golang|java\b|flutter|swift|c\+\+|node\.js)/i, topicSubstrings: ["Программирование"] },
  { match: /(ai|нейросет|chatgpt|gpt|искусственн.*интеллект|midjourney)/i, topicSubstrings: ["AI", "AI и нейросети"] },
  { match: /(it.*стартап|стартап|startup)/i, topicSubstrings: ["IT и стартапы"] },

  // Творчество и дизайн
  { match: /(дизайн|design|figma|ui|ux|иллюстрац|веб-дизайн|графическ.*дизайн)/i, topicSubstrings: ["Дизайн"] },
  { match: /(рисовани|живопис|рисунок|скетчинг|акварель)/i, topicSubstrings: ["Рисование"] },
  { match: /(фотограф|видеомонтаж|монтаж|premiere|capcut|видеосъемк)/i, topicSubstrings: ["Фотография", "Фотография и видеомонтаж"] },
  { match: /(вокал|пение|голос|vocal)/i, topicSubstrings: ["Вокал"] },
  { match: /(музык|гитар|фортепиан|пианино|скрипк|барабан|укулеле)/i, topicSubstrings: ["Игра на музыкальных инструментах", "Музыка"] },

  // Бизнес, маркетинг, финансы
  { match: /(маркетинг|marketing|продаж|таргет|реклам)/i, topicSubstrings: ["Маркетинг", "Маркетинг и продажи"] },
  { match: /(smm|смм|инста|tiktok|reels|stories)/i, topicSubstrings: ["SMM"] },
  { match: /(предприним|бизнес|business|управлен)/i, topicSubstrings: ["Бизнес", "Предпринимательство"] },
  { match: /(трейдинг|trading|биржа)/i, topicSubstrings: ["Трейдинг"] },
  { match: /(инвест|крипт|акци|crypto)/i, topicSubstrings: ["Инвестиции", "Инвестиции и крипта"] },
  { match: /(деньг|финанс|бюджет)/i, topicSubstrings: ["Финансы", "Финансы и инвестиции"] },

  // Личностный рост, здоровье, спорт
  { match: /(психолог|psychology|отношен|самооценк|тревож|терапи|коучинг)/i, topicSubstrings: ["Психология"] },
  { match: /(лидерств|руководств|soft skills)/i, topicSubstrings: ["Лидерство"] },
  { match: /(выступлен|оратор|спикер|дикция|речь)/i, topicSubstrings: ["Публичные выступления"] },
  { match: /(шахмат|chess)/i, topicSubstrings: ["Шахматы"] },
  { match: /(йог|yoga|пилатес|стретчинг|растяжк)/i, topicSubstrings: ["Йога", "Фитнес / Йога / Пилатес", "Фитнес, йога, пилатес", "Фитнес и йога"] },
  { match: /(фитнес|fitness|похуден|тренировк|зал|спорт|мышц)/i, topicSubstrings: ["Фитнес", "Спортзалы и бассейны"] },
  { match: /(здоров|питан|диет|нутрициолог)/i, topicSubstrings: ["Здоровье", "Нутрициология", "Здоровье и программы тренировок"] },
  { match: /(кулинар|готовка|рецепт|выпечк)/i, topicSubstrings: ["Кулинария"] },
  { match: /(танц|dance|хореограф)/i, topicSubstrings: ["Танцы", "Музыка и танцы"] },
  { match: /(нетворк|networking|знакомств)/i, topicSubstrings: ["Нетворкинг"] },

  // Мероприятия и развлечения
  { match: /(кино|фильм|сериал)/i, topicSubstrings: ["Кино", "Кино-вечера", "Кино и сериалы"] },
  { match: /(театр|спектакл|пьес)/i, topicSubstrings: ["Театр"] },
  { match: /(концерт|выступлен)/i, topicSubstrings: ["Концерты"] },
  { match: /(фестивал|fest)/i, topicSubstrings: ["Фестивали"] },
  { match: /(стендап|standup|комик)/i, topicSubstrings: ["Стендап"] },
  { match: /(вечеринк|party|тусовк|дискотек)/i, topicSubstrings: ["Вечеринки", "Дискотеки"] },
  { match: /(квест|quest)/i, topicSubstrings: ["Квесты"] },
  { match: /(экскурси|тур|поход|гид)/i, topicSubstrings: ["Экскурсии"] },
  { match: /(выставк|музей|галере)/i, topicSubstrings: ["Выставки"] },
  { match: /(игр|гейминг|киберспорт|dota|cs|pubg)/i, topicSubstrings: ["Игры", "Киберспорт"] },
];

/**
 * Локальный анализатор текста.
 * Если не удается уверенно определить категорию, подкатегорию или тему — возвращает пустые значения,
 * не навязывая случайных значений по умолчанию.
 */
export function smartTextClassifier(
  text: string,
  categories: CatalogCategory[]
): CategoryPrediction {
  const lower = (text || "").toLowerCase();

  // 1. Поиск темы по ключевым словам
  let detectedTopic = "";
  for (const entry of TOPIC_MATCHERS) {
    if (entry.match.test(lower)) {
      detectedTopic = entry.topicSubstrings[0];
      break;
    }
  }

  // 2. Определение ключевых слов форматов и категорий
  const isLessons =
    lower.includes("урок") ||
    lower.includes("репетитор") ||
    lower.includes("zoom") ||
    lower.includes("заняти") ||
    lower.includes("преподавател") ||
    lower.includes("ментор") ||
    lower.includes("индивидуальн") ||
    lower.includes("группов") ||
    lower.includes("обучени") ||
    lower.includes("подготовк");

  const isSubs =
    lower.includes("telegram") ||
    lower.includes("телеграм") ||
    lower.includes("канал") ||
    lower.includes("подписк") ||
    lower.includes("клуб") ||
    lower.includes("сообществ") ||
    lower.includes("в месяц") ||
    lower.includes("ежемесячн") ||
    lower.includes("закрытый чат") ||
    lower.includes("комьюнити");

  const isEvents =
    lower.includes("вебинар") ||
    lower.includes("мастер-класс") ||
    lower.includes("интенсив") ||
    lower.includes("воркшоп") ||
    lower.includes("конференц") ||
    lower.includes("билет") ||
    lower.includes("встреч") ||
    lower.includes("концерт") ||
    lower.includes("стендап") ||
    lower.includes("вечеринк") ||
    lower.includes("фестивал") ||
    lower.includes("спектакл") ||
    lower.includes("экскурси") ||
    lower.includes("выставк") ||
    lower.includes("квест");

  const isMaterials =
    lower.includes("книга") ||
    lower.includes("pdf") ||
    lower.includes("файл") ||
    lower.includes("шаблон") ||
    lower.includes("чек-лист") ||
    lower.includes("гайд") ||
    lower.includes("видеокурс") ||
    lower.includes("запис") ||
    lower.includes("материал") ||
    lower.includes("пособи") ||
    lower.includes("сборник") ||
    lower.includes("таблиц");

  let targetCatSlug = "";
  let targetSubcatSlug = "";

  if (isLessons) {
    targetCatSlug = "online-lessons";
    targetSubcatSlug = lower.includes("групп") ? "group" : "individual";
  } else if (isSubs) {
    targetCatSlug = "subscriptions";
    targetSubcatSlug =
      lower.includes("спорт") ||
      lower.includes("зал") ||
      lower.includes("бассейн") ||
      lower.includes("офлайн")
        ? "offline"
        : "online";
  } else if (isEvents) {
    targetCatSlug = "events";
    targetSubcatSlug =
      lower.includes("офлайн") ||
      lower.includes("алматы") ||
      lower.includes("астана") ||
      lower.includes("концерт") ||
      lower.includes("театр") ||
      lower.includes("стендап") ||
      lower.includes("квест") ||
      lower.includes("экскурси") ||
      lower.includes("билет")
        ? "offline"
        : "online";
  } else if (isMaterials) {
    targetCatSlug = "materials";
    if (lower.includes("видео") || lower.includes("курс") || lower.includes("запис")) {
      targetSubcatSlug = "video-courses";
    } else if (lower.includes("книг") || lower.includes("ebook")) {
      targetSubcatSlug = "ebooks";
    } else {
      targetSubcatSlug = "files";
    }
  } else if (detectedTopic) {
    // Если указана конкретная тема (например, «Математика» или «ЕНТ»), но формат не указан,
    // по умолчанию относим к онлайн-урокам
    targetCatSlug = "online-lessons";
    targetSubcatSlug = "individual";
  } else {
    // Не удалось понять категорию — оставляем поля пустыми для ручного выбора
    return {
      categoryId: "",
      categorySlug: "",
      categoryName: "",
      subcategoryId: "",
      subcategorySlug: "",
      subcategoryName: "",
      topic: "",
    };
  }

  const matchedCat = categories.find((c) => c.slug === targetCatSlug);
  if (!matchedCat) {
    return {
      categoryId: "",
      categorySlug: "",
      categoryName: "",
      subcategoryId: "",
      subcategorySlug: "",
      subcategoryName: "",
      topic: "",
    };
  }

  const matchedSubcat =
    matchedCat.subcategories?.find((s) => s.slug === targetSubcatSlug) ||
    matchedCat.subcategories?.[0];

  const availableTopics = getPresetTopics(matchedCat.slug, matchedSubcat?.slug);

  let finalTopic = "";
  if (detectedTopic) {
    finalTopic = resolvePresetTopic(detectedTopic, availableTopics);
  }

  return {
    categoryId: matchedCat.id,
    categorySlug: matchedCat.slug,
    categoryName: matchedCat.name_ru,
    subcategoryId: matchedSubcat ? matchedSubcat.id : "",
    subcategorySlug: matchedSubcat ? matchedSubcat.slug : "",
    subcategoryName: matchedSubcat ? matchedSubcat.name_ru : "",
    topic: finalTopic,
  };
}

/**
 * Прогнозирует категорию, подкатегорию и тему с помощью Gemini API
 * (с резервным вызовом локального классификатора при отсутствии ключа или ошибке сети)
 */
export async function predictProductCategory({
  title,
  description = "",
  faq = [],
  categories,
}: PredictInput): Promise<CategoryPrediction> {
  const fullText = [
    `Название: ${title}`,
    description ? `Описание: ${description.replace(/<[^>]*>?/gm, "")}` : "",
    faq.length > 0 ? `FAQ: ${faq.map((f) => `В: ${f.question} О: ${f.answer}`).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const geminiKey =
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_API_KEY ||
    (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "");

  const openAiKey =
    (import.meta as any).env?.VITE_OPENAI_API_KEY ||
    (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : "");

  // 1. Попытка через Gemini API
  if (geminiKey) {
    try {
      const taxonomyPrompt = TAXONOMY_DEFINITIONS.map((c) => ({
        slug: c.slug,
        name: c.name_ru,
        subcategories: c.subcategories.map((s) => ({
          slug: s.slug,
          name: s.name_ru,
          topics: s.topics,
        })),
      }));

      const systemInstruction = `Ты — AI-классификатор маркетплейса Dostup.
Определи категорию, подкатегорию и тему продукта.
СТРУКТУРА:
${JSON.stringify(taxonomyPrompt, null, 2)}

Верни ТОЛЬКО JSON формата:
{
  "categorySlug": "online-lessons" | "materials" | "subscriptions" | "events" | null,
  "subcategorySlug": string | null,
  "topic": string | null
}
Если категорию или тему нельзя уверенно определить по тексту, верни null для этого поля.
Если тема найдена в списке тем для выбранной подкатегории, верни её ТОЧНО так, как она записана (включая эмодзи).`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemInstruction}\n\nПРОДУКТ:\n${fullText}` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const textPart = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textPart) {
          const parsed = JSON.parse(textPart);
          if (parsed.categorySlug) {
            const cat = categories.find((c) => c.slug === parsed.categorySlug);
            if (cat) {
              const sub = cat.subcategories?.find((s) => s.slug === parsed.subcategorySlug);
              const availableTopics = getPresetTopics(cat.slug, sub?.slug);
              const resolvedTopic = parsed.topic
                ? resolvePresetTopic(parsed.topic, availableTopics)
                : "";

              return {
                categoryId: cat.id,
                categorySlug: cat.slug,
                categoryName: cat.name_ru,
                subcategoryId: sub ? sub.id : "",
                subcategorySlug: sub ? sub.slug : "",
                subcategoryName: sub ? sub.name_ru : "",
                topic: resolvedTopic,
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn("Gemini API call failed, trying backup:", e);
    }
  }

  // 2. Попытка через OpenAI API (если задан ключ)
  if (openAiKey) {
    try {
      const taxonomyPrompt = TAXONOMY_DEFINITIONS.map((c) => ({
        slug: c.slug,
        name: c.name_ru,
        subcategories: c.subcategories.map((s) => ({
          slug: s.slug,
          name: s.name_ru,
          topics: s.topics,
        })),
      }));

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Ты — классификатор продуктов Dostup. Определи категорию, подкатегорию и тему из структуры: ${JSON.stringify(
                taxonomyPrompt
              )}. Ответ только в JSON: {"categorySlug":"...","subcategorySlug":"...","topic":"..."}. Если не уверен в теме, верни topic: null.`,
            },
            {
              role: "user",
              content: fullText,
            },
          ],
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.categorySlug) {
            const cat = categories.find((c) => c.slug === parsed.categorySlug);
            if (cat) {
              const sub = cat.subcategories?.find((s) => s.slug === parsed.subcategorySlug);
              const availableTopics = getPresetTopics(cat.slug, sub?.slug);
              const resolvedTopic = parsed.topic
                ? resolvePresetTopic(parsed.topic, availableTopics)
                : "";

              return {
                categoryId: cat.id,
                categorySlug: cat.slug,
                categoryName: cat.name_ru,
                subcategoryId: sub ? sub.id : "",
                subcategorySlug: sub ? sub.slug : "",
                subcategoryName: sub ? sub.name_ru : "",
                topic: resolvedTopic,
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn("OpenAI fallback failed:", e);
    }
  }

  // 3. Надежный локальный классификатор (быстро, без задержек и лимитов API)
  return smartTextClassifier(fullText, categories);
}

const TOPIC_EMOJI_RULES: Array<{ match: RegExp; topic: string }> = [
  // Языки мира (с флагами)
  { match: /(немецк|deutsch|german|герман)/i, topic: "🇩🇪 Немецкий язык" },
  { match: /(француз|french|français)/i, topic: "🇫🇷 Французский язык" },
  { match: /(испан|spanish|español)/i, topic: "🇪🇸 Испанский язык" },
  { match: /(итальян|italian|italiano)/i, topic: "🇮🇹 Итальянский язык" },
  { match: /(арабск|arabic|араб)/i, topic: "🇸🇦 Арабский язык" },
  { match: /(японск|japanese|nihongo)/i, topic: "🇯🇵 Японский язык" },
  { match: /(китай|chinese|hsk|мандарин)/i, topic: "🇨🇳 Китайский язык" },
  { match: /(корей|korean|topik|хангыль)/i, topic: "🇰🇷 Корейский язык" },
  { match: /(турец|turkish|түрк)/i, topic: "🇹🇷 Турецкий язык" },
  { match: /(англ|english|инглиш|энглиш)/i, topic: "🇬🇧 Английский язык" },
  { match: /(казахск|қазақша|қазақ\s*тіл|qazaq\s*tili)/i, topic: "🇰🇿 Казахский язык" },
  { match: /(русск(ий|ого|ому|ом)?\s*язык)/i, topic: "🇷🇺 Русский язык" },
  { match: /(португал|portuguese)/i, topic: "🇵🇹 Португальский язык" },
  { match: /(польск|polish)/i, topic: "🇵🇱 Польский язык" },

  // Экзамены и олимпиады
  { match: /(ielts|айелтс|аелтс)/i, topic: "📜 IELTS" },
  { match: /(toefl|тоефл|тоэфл)/i, topic: "📜 TOEFL" },
  { match: /(sat|сэт)/i, topic: "🎓 SAT" },
  { match: /(ент|ubt|ұбт|ент-ға)/i, topic: "🇰🇿 ЕНТ" },
  { match: /(ниш|nish|нзм)/i, topic: "🏫 НИШ" },
  { match: /(ктл|ktl|билом|білім-инновация)/i, topic: "🏫 КТЛ" },
  { match: /(рфмш|fizmat|физмат)/i, topic: "📐 РФМШ" },
  { match: /(олимпиад)/i, topic: "🏆 Олимпиада" },
  { match: /(поступлен|вуз|универ|магистратур)/i, topic: "🎓 Поступление" },

  // Школьные и академические предметы
  { match: /(математ|алгебр|геометр|math)/i, topic: "🔢 Математика" },
  { match: /(физик|physics)/i, topic: "🧲 Физика" },
  { match: /(хими|chemistry)/i, topic: "🧪 Химия" },
  { match: /(биолог|biology)/i, topic: "🧬 Биология" },
  { match: /(географ)/i, topic: "🌍 География" },
  { match: /(истор|history)/i, topic: "🏛️ История" },
  { match: /(литератур)/i, topic: "📚 Литература" },
  { match: /(прав|юриспруд|закон)/i, topic: "⚖️ Право" },

  // IT и программирование
  { match: /(python|пайтон|питон)/i, topic: "🐍 Python" },
  { match: /(javascript|typescript|front-?end|фронтенд|react|vue|angular)/i, topic: "💻 JavaScript" },
  { match: /(node|backend|бэкенд|golang|java\b|spring)/i, topic: "💻 Бэкенд разработка" },
  { match: /(ios|android|flutter|swift|мобильн.*разработ)/i, topic: "📱 Мобильная разработка" },
  { match: /(веб-разработ|html|css|верстк|создани.*сайтов)/i, topic: "💻 Веб-разработка" },
  { match: /(ai|нейросет|chatgpt|gpt|искусственн.*интеллект|midjourney|prompt)/i, topic: "🤖 AI и нейросети" },
  { match: /(безопасност|хакинг|security|cyber)/i, topic: "🛡️ Кибербезопасность" },
  { match: /(тестирован|qa|quality assurance)/i, topic: "🐞 Тестирование ПО" },
  { match: /(1c|1с)/i, topic: "💼 1C Программирование" },
  { match: /(аналитик.*данн|sql|power bi|excel|data science)/i, topic: "📊 Аналитика данных" },
  { match: /(unity|unreal|геймдев|разработк.*игр)/i, topic: "🎮 Разработка игр" },
  { match: /(программир|coding|код)/i, topic: "💻 Программирование" },

  // Дизайн и искусство
  { match: /(figma|ui\/ux|ui|ux|интерфейс)/i, topic: "🎨 UI/UX Дизайн" },
  { match: /(3d|blender|блендер|моделирован)/i, topic: "🧊 3D Моделирование" },
  { match: /(моушн|motion|after effects)/i, topic: "✨ Моушн-дизайн" },
  { match: /(графическ.*дизайн|логотип|иллюстрац)/i, topic: "🎨 Графический дизайн" },
  { match: /(дизайн|design)/i, topic: "🎨 Дизайн" },
  { match: /(рисовани|живопис|акварел|скетчинг)/i, topic: "🎨 Рисование" },
  { match: /(фотограф|съемк)/i, topic: "📷 Фотография" },
  { match: /(видеомонтаж|монтаж|premiere|capcut|видеосъемк)/i, topic: "🎬 Видеомонтаж" },
  { match: /(актерск|театр)/i, topic: "🎭 Актерское мастерство" },

  // Музыка
  { match: /(гитар|guitar|укулеле)/i, topic: "🎸 Гитара" },
  { match: /(фортепиан|пианино|клавишн)/i, topic: "🎹 Фортепиано" },
  { match: /(барабан|ударн)/i, topic: "🥁 Барабаны" },
  { match: /(скрипк)/i, topic: "🎻 Скрипка" },
  { match: /(вокал|пени|голос)/i, topic: "🎤 Вокал" },
  { match: /(битмейкинг|бит|sound|звук|музык)/i, topic: "🎧 Создание музыки" },

  // Бизнес и финансы
  { match: /(smm|смм|reels|stories|инста)/i, topic: "📱 SMM" },
  { match: /(таргет|таргетинг)/i, topic: "🎯 Таргетированная реклама" },
  { match: /(маркетинг|marketing)/i, topic: "📈 Маркетинг" },
  { match: /(продаж|sales)/i, topic: "🤝 Продажи" },
  { match: /(маркетплейс|wildberries|вайлдберриз|ozon|озон|kaspi|каспи)/i, topic: "🛍️ Маркетплейсы" },
  { match: /(трейдинг|trading|биржа)/i, topic: "📊 Трейдинг" },
  { match: /(крипт|crypto|биткоин|blockchain)/i, topic: "🪙 Криптовалюта" },
  { match: /(инвест)/i, topic: "📈 Инвестиции" },
  { match: /(деньг|финанс|бюджет)/i, topic: "💳 Финансы" },
  { match: /(бизнес|business|предприним|стартап)/i, topic: "💼 Бизнес" },

  // Спорт, здоровье, психология
  { match: /(йог|yoga)/i, topic: "🧘 Йога" },
  { match: /(пилатес|стретчинг|растяжк)/i, topic: "🤸 Стретчинг и пилатес" },
  { match: /(фитнес|fitness|тренировк|зал|мышц)/i, topic: "🏋️ Фитнес" },
  { match: /(похуден|питан|диет|нутрициолог)/i, topic: "🥗 Здоровое питание" },
  { match: /(плавани|бассейн)/i, topic: "🏊 Плавание" },
  { match: /(бокс|единоборств|борьб)/i, topic: "🥊 Единоборства" },
  { match: /(бег|марафон)/i, topic: "🏃 Бег" },
  { match: /(танц|dance|хореограф)/i, topic: "💃 Танцы" },
  { match: /(шахмат|chess)/i, topic: "♟️ Шахматы" },
  { match: /(психолог|самооценк|тревож|терапи|отношен)/i, topic: "🧠 Психология" },
  { match: /(медитац|осознан)/i, topic: "🧘 Медитация" },
  { match: /(спин|осанк)/i, topic: "🧍 Здоровая спина" },

  // Хобби и развитие
  { match: /(кулинар|готовк|выпечк|кондитер)/i, topic: "🍳 Кулинария" },
  { match: /(оратор|выступлен|дикци|речь)/i, topic: "🎤 Ораторское искусство" },
  { match: /(скорочтен|памят)/i, topic: "⚡ Развитие памяти" },
  { match: /(вожден|пдд|авто)/i, topic: "🚗 Вождение и ПДД" },
  { match: /(макияж|визаж|бьюти)/i, topic: "💄 Макияж" },
  { match: /(маникюр|педикюр)/i, topic: "💅 Маникюр" },
  { match: /(массаж)/i, topic: "💆 Массаж" },
  { match: /(вязани|шить|рукодели)/i, topic: "🧶 Рукоделие" },
  { match: /(астролог|таро)/i, topic: "🔮 Астрология" },
];

function ensureTopicHasEmoji(topic: string, categorySlug?: string): string {
  const trimmed = topic.trim();
  const hasEmoji = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}]/u.test(trimmed);
  if (hasEmoji) {
    const match = trimmed.match(/^([\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F\u200D]+)\s*(.*)$/u);
    if (match && match[2]) {
      return `${match[1]} ${match[2].charAt(0).toUpperCase() + match[2].slice(1)}`;
    }
    return trimmed;
  }

  let defaultEmoji = "💡";
  if (categorySlug === "online-lessons") defaultEmoji = "🎓";
  else if (categorySlug === "materials") defaultEmoji = "📁";
  else if (categorySlug === "subscriptions") defaultEmoji = "🌐";
  else if (categorySlug === "events") defaultEmoji = "🎟️";

  return `${defaultEmoji} ${trimmed.charAt(0).toUpperCase() + trimmed.slice(1)}`;
}

function extractTopicFromTitle(title: string, categorySlug?: string): string {
  if (!title || !title.trim()) return "";
  let cleaned = title
    .replace(/(онлайн|курс|уроки|урок|занятия|занятие|обучение|для начинающих|с нуля|мастер-класс|интенсив|вебинар)/gi, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) cleaned = title.trim();
  const words = cleaned.split(" ").filter((w) => w.length > 2);
  const topicCore = words.slice(0, 3).join(" ") || cleaned;

  return ensureTopicHasEmoji(topicCore, categorySlug);
}

/**
 * Автоматически подбирает тему продукта со смайликом в начале
 * на основе названия, описания, часто задаваемых вопросов (FAQ) и категории.
 */
export async function suggestCustomTopicWithEmoji({
  title,
  description = "",
  faq = [],
  categorySlug,
  subcategorySlug,
}: {
  title: string;
  description?: string;
  faq?: Array<{ question: string; answer: string }>;
  categorySlug?: string;
  subcategorySlug?: string;
}): Promise<string> {
  const cleanDesc = description ? description.replace(/<[^>]*>?/gm, " ").trim() : "";
  const cleanFaq = (faq || [])
    .map((f) => `${f.question || ""} ${f.answer || ""}`.trim())
    .filter(Boolean)
    .join(". ");

  const fullText = [title, cleanDesc, cleanFaq].filter(Boolean).join("\n");
  if (!fullText.trim()) return "";

  const openAiKey =
    (import.meta as any).env?.VITE_OPENAI_API_KEY ||
    (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : "");

  if (openAiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Ты — AI-помощник на платформе Dostup. По названию, описанию и FAQ продукта определи или сформулируй точную, лаконичную и привлекательную тему (1-3 слова) на русском языке.
ОБЯЗАТЕЛЬНО: первым символом должен быть подходящий эмодзи/смайлик (флаг страны для языка 🇩🇪, предмет 💼, 🛍️, 📈, 💻, 🎸, 🧪, 🎨, 🥗, 🤖, ♟️ и т.д.), затем один пробел, затем название темы с заглавной буквы.
Важные правила:
1. Тема должна точно передавать тематику и специализацию продукта (например: "💼 Бизнес на маркетплейсах", "🛍️ Продажи на Kaspi", "🇩🇪 Немецкий язык", "🐍 Python с нуля", "📈 Финансовая грамотность", "🎯 Таргетированная реклама").
2. КРИТИЧЕСКИ ВАЖНО: НЕ путай географические упоминания (например, "в Казахстане", "по Казахстану", "Алматы", "Астана", "РК") с темой языка! Если продукт про бизнес, торговлю или продажи в Казахстане, тема должна быть про бизнес/продажи ("💼 Бизнес на маркетплейсах", "🛍️ Продажи на Kaspi", "💼 Бизнес в Казахстане"), но НИ В КОЕМ СЛУЧАЕ НЕ "Казахский язык". Тему "Казахский язык" выбирай ТОЛЬКО если продукт непосредственно обучает казахскому языку или правилам грамматики.
Ответь ТОЛЬКО валидным JSON формата: {"topic": "💼 Бизнес на маркетплейсах"}`,
            },
            {
              role: "user",
              content: `Категория: ${categorySlug || "не указана"}\nПодкатегория: ${subcategorySlug || "не указана"}\nНазвание: ${title}\nОписание: ${cleanDesc.slice(0, 700)}\nFAQ: ${cleanFaq.slice(0, 400)}`,
            },
          ],
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed?.topic && typeof parsed.topic === "string" && parsed.topic.trim()) {
            return ensureTopicHasEmoji(parsed.topic.trim(), categorySlug);
          }
        }
      }
    } catch (e) {
      console.warn("OpenAI topic suggestion failed:", e);
    }
  }

  const geminiKey =
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_API_KEY ||
    (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "");

  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Ты — AI-помощник на платформе Dostup. По названию, описанию и FAQ продукта определи или сформулируй точную и лаконичную тему (1-3 слова) на русском языке.
ОБЯЗАТЕЛЬНО: в самом начале должен быть подходящий эмодзи/смайлик (флаг страны для языка 🇩🇪, предмет 🎸, 🧪, 🐍, ♟️, или значок), затем пробел, затем название темы с заглавной буквы.
Примеры:
- 🇩🇪 Немецкий язык
- 🇫🇷 Французский язык
- 🎸 Гитара
- 🐍 Python
- 🎓 SAT
- 🧪 Химия
- 🎨 Рисование
- 🥗 Здоровое питание
- 📱 Мобильная разработка
- ♟️ Шахматы

Категория: ${categorySlug || "не указана"}
Подкатегория: ${subcategorySlug || "не указана"}
Название: ${title}
Описание: ${cleanDesc.slice(0, 500)}
FAQ: ${cleanFaq.slice(0, 300)}

Ответь ТОЛЬКО валидным JSON формата: {"topic": "🇩🇪 Немецкий язык"}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const textPart = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textPart) {
          const parsed = JSON.parse(textPart);
          if (parsed?.topic && typeof parsed.topic === "string" && parsed.topic.trim()) {
            return ensureTopicHasEmoji(parsed.topic.trim(), categorySlug);
          }
        }
      }
    } catch (e) {
      console.warn("Gemini topic suggestion failed, using local rules:", e);
    }
  }

  // Локальный подбор по правилам
  for (const entry of TOPIC_EMOJI_RULES) {
    if (entry.match.test(fullText)) {
      return entry.topic;
    }
  }

  // Если точное правило не сработало, формируем тему из названия с подходящим эмодзи
  return extractTopicFromTitle(title, categorySlug);
}
