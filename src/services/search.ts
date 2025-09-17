import axios from "axios";
import config from "../config";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(query: string, count = 3): Promise<WebSearchResult[]> {
  if (!config.bingSearchApiKey) {
    return [];
  }
  const endpoint = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${count}`;
  try {
    const { data } = await axios.get(endpoint, {
      headers: { "Ocp-Apim-Subscription-Key": config.bingSearchApiKey },
    });
    return (data.webPages?.value || []).slice(0, count).map((v: any) => ({
      title: v.name,
      url: v.url,
      snippet: v.snippet,
    }));
  } catch (err) {
    console.error("webSearch error", err);
    return [];
  }
}

export function formatCitedResponse(answer: string, results: WebSearchResult[]): string {
  if (!results.length) return answer;
  const citations = results
    .map((r, i) => `[${i + 1}] ${r.title} - ${r.url}`)
    .join("\n");
  return `${answer}\n\nSources:\n${citations}`;
}
