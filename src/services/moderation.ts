import config from "../config";
import axios from "axios";

export interface ModerationResult {
  flagged: boolean;
  reasons: string[];
}

// Simple placeholder moderation: optionally call OpenAI moderation API if key provided, else keyword filter.
export async function moderateText(text: string): Promise<ModerationResult> {
  if (!config.enableModeration) {
    return { flagged: false, reasons: [] };
  }
  // Basic keyword check first
  const banned = ["hate", "terror", "bomb"];
  const triggered = banned.filter((w) => text.toLowerCase().includes(w));
  if (triggered.length) {
    return { flagged: true, reasons: ["keyword"] };
  }
  if (config.openAIModerationApiKey) {
    try {
      const resp = await axios.post(
        "https://api.openai.com/v1/moderations",
        { input: text, model: "omni-moderation-latest" },
        { headers: { Authorization: `Bearer ${config.openAIModerationApiKey}` } }
      );
      const results = resp.data.results?.[0];
      if (results?.flagged) {
        const cats = Object.entries(results.categories || {})
          .filter(([_, v]) => v)
          .map(([k]) => k);
        return { flagged: true, reasons: cats as string[] };
      }
    } catch (e) {
      console.warn("Moderation API failed", e);
    }
  }
  return { flagged: false, reasons: [] };
}
