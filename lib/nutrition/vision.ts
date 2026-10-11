import type { PhotoEstimate } from "./types";

export function visionConfigured() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function parseEstimate(raw: unknown): PhotoEstimate {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const items = Array.isArray(o.items)
    ? o.items
        .map((item) => {
          const i = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          return {
            name: String(i.name ?? "").trim(),
            portion: String(i.portion ?? "").trim(),
            kcal: clamp(Number(i.kcal), 0, 2000),
          };
        })
        .filter((i) => i.name)
    : [];
  return {
    name: String(o.name ?? "Meal").trim() || "Meal",
    kcal: clamp(Number(o.kcal), 0, 4000),
    protein_g: clamp(Number(o.protein_g), 0, 300),
    carb_g: clamp(Number(o.carb_g), 0, 400),
    fat_g: clamp(Number(o.fat_g), 0, 250),
    confidence: clamp(Number(o.confidence), 0, 1),
    items,
    notes: String(o.notes ?? "").trim(),
    not_food: Boolean(o.not_food),
  };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The photo estimate did not return usable numbers.");
  return JSON.parse(body.slice(start, end + 1));
}

const PROMPT = `You estimate food from a photo for a coaching app. Return JSON only:
{
  "not_food": boolean,
  "name": "short meal name",
  "kcal": number,
  "protein_g": number,
  "carb_g": number,
  "fat_g": number,
  "confidence": number,
  "items": [{"name":"","portion":"e.g. 150 g or 1 cup","kcal":0}],
  "notes": "one sentence on portion uncertainty"
}
Rules:
- If this is not a meal, snack, drink, or leftover plate, set not_food true and zeros.
- Estimate visible food only. Do not invent hidden sides.
- Use typical cooked restaurant/home portions. Be slightly conservative if unsure.
- kcal should roughly match 4*protein + 4*carb + 9*fat.
- confidence 0 to 1. This is an estimate, not a lab measurement or medical advice.
- Do not diagnose, do not mention diseases.`;

async function openaiEstimate(imageBase64: string, mime: string): Promise<PhotoEstimate> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("missing");
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mime};base64,${imageBase64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision request failed (${res.status}).`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseEstimate(extractJson(json.choices?.[0]?.message?.content ?? ""));
}

async function anthropicEstimate(imageBase64: string, mime: string): Promise<PhotoEstimate> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("missing");
  const model = process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-4-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: imageBase64 } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision request failed (${res.status}).`);
  const json = (await res.json()) as { content?: { type?: string; text?: string }[] };
  const text = (json.content ?? []).map((c) => c.text ?? "").join("\n");
  return parseEstimate(extractJson(text));
}

export async function estimateMealFromImage(imageBase64: string, mime: string): Promise<PhotoEstimate> {
  if (process.env.OPENAI_API_KEY) return openaiEstimate(imageBase64, mime);
  if (process.env.ANTHROPIC_API_KEY) return anthropicEstimate(imageBase64, mime);
  throw new Error("Add OPENAI_API_KEY to .env.local, then restart the app, to estimate from a photo.");
}
