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

export type FeedbackSuggestionInput = {
  food: number;
};

const SYSTEM = `You help a restaurant customer put their own experience into words for a Google review.
Rules:
- Write in the first person, as the customer.
- Use ONLY what the customer rated, selected or wrote. Never invent dishes, staff names, prices or events.
- Match the sentiment of the ratings. A 3-star visit must not sound glowing. A 1-2 star visit should be honest and polite, never hostile.
- Treat overall, food and service ratings as separate signals. When a food rating is provided, reflect its sentiment in the review without inventing why the customer gave that rating.
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
  const foodSentiment = i.food
    ? ` The food was ${i.food === 5 ? "excellent" : i.food === 4 ? "good" : i.food === 3 ? "average" : "disappointing"}.`
    : "";
  return `${tone} ${i.restaurantName}.${foodSentiment}${liked}${i.text ? ` ${i.text}` : ""}`.trim();
}

function ratingStatements(aspect: string, rating: number) {
  if (aspect === "Overall experience") {
    if (rating <= 2) return ["My visit could improve", "My experience fell short of expectations"];
    if (rating === 3) return ["My visit was okay", "My experience was average"];
    if (rating === 4) return ["My visit was good", "I enjoyed my visit"];
    return ["My visit was excellent", "I really enjoyed my visit"];
  }

  const subject = `The ${aspect.toLowerCase()}`;
  if (rating <= 2) return [`${subject} could improve`, `${subject} fell short of expectations`];
  if (rating === 3) return [`${subject} was okay`, `${subject} was average`];
  if (rating === 4) return [`${subject} was good`, `${subject} made the experience enjoyable`];
  return [`${subject} was excellent`, `${subject} made my visit enjoyable`];
}

export async function suggestFeedback(input: FeedbackSuggestionInput): Promise<string[]> {
  const aspects: [string, number][] = [["Food", input.food]];
  const fallbackSuggestions = aspects.flatMap(([aspect, rating]) =>
    ratingStatements(aspect, rating),
  ).slice(0, 6);

  if (!process.env.ANTHROPIC_API_KEY) return fallbackSuggestions;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 180,
      system: `Create short selectable feedback suggestions for a restaurant guest, based only on their ratings.
- Return only a JSON array of 3 to 6 short first-person feedback phrases.
- Reflect each provided rating accurately; low ratings must not sound positive.
- Do not invent dishes, events, reasons, staff names, or details not supplied.
- Keep each phrase under 70 characters and make each one usable as a guest-selected feedback tag.`,
      messages: [{
        role: "user",
        content: aspects.map(([aspect, rating]) => `${aspect}: ${rating}/5`).join("\n"),
      }],
    });
    const block = response.content.find((item) => item.type === "text");
    if (block?.type !== "text") return fallbackSuggestions;
    const parsed: unknown = JSON.parse(block.text.trim());
    if (
      Array.isArray(parsed) &&
      parsed.length >= 3 &&
      parsed.length <= 6 &&
      parsed.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 70)
    ) {
      return parsed.map((item: string) => item.trim());
    }
    console.error("AI feedback suggestions returned an invalid format");
  } catch (error) {
    console.error("AI feedback suggestions failed", error);
  }
  return fallbackSuggestions;
}

export async function generateDraft(i: DraftInput): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return fallback(i);
  try {
    const client = new Anthropic();
    const prompt = [
      `Restaurant: ${i.restaurantName}`,
      `Overall rating: ${i.overall}/5`,
      i.food
        ? `Food rating: ${i.food}/5. Reflect this food-specific sentiment in the review; do not invent reasons or specific dishes.`
        : null,
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
