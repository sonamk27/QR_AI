import Anthropic from "@anthropic-ai/sdk";

export type DraftInput = {
  restaurantName: string;
  overall: number;
  food?: number | null;
  service?: number | null;
  chips: string[];
  text?: string | null;
  variant?: "short" | "casual" | "detailed";
};

const SYSTEM = `You help a restaurant customer put their own experience into words for a Google review.
Rules:
- Write in the first person, as the customer.
- Use ONLY what the customer rated, selected or wrote. Never invent dishes, staff names, prices or events.
- Match the sentiment of the ratings. A 3-star visit must not sound glowing. A 1-2 star visit should be honest and polite, never hostile.
- No hashtags, no emojis, no marketing language, no mention of AI.
- Output only the review text.`;

const LENGTH = {
  short: "1-2 sentences.",
  casual: "2-3 sentences, relaxed and conversational.",
  detailed: "3-4 sentences, a little more specific about what they liked or did not.",
};

function fallback(i: DraftInput) {
  const liked = i.chips.length ? ` I especially noticed the ${i.chips.join(", ").toLowerCase()}.` : "";
  const tone =
    i.overall >= 4 ? "I had a good experience at" : i.overall === 3 ? "My visit to" : "I was not fully satisfied with my visit to";
  return `${tone} ${i.restaurantName}.${liked}${i.text ? ` ${i.text}` : ""}`.trim();
}

export async function generateDraft(i: DraftInput): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return fallback(i);
  try {
    const client = new Anthropic();
    const prompt = [
      `Restaurant: ${i.restaurantName}`,
      `Overall rating: ${i.overall}/5`,
      i.food ? `Food rating: ${i.food}/5` : null,
      i.service ? `Service rating: ${i.service}/5` : null,
      i.chips.length ? `Customer said they enjoyed: ${i.chips.join(", ")}` : null,
      i.text ? `Customer's own words: "${i.text}"` : null,
      `Length: ${LENGTH[i.variant ?? "casual"]}`,
    ]
      .filter(Boolean)
      .join("\n");
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : fallback(i);
  } catch (e) {
    console.error("AI draft failed", e);
    return fallback(i);
  }
}
