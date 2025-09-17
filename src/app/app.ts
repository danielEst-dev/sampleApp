import { MemoryStorage, MessageFactory, TurnContext, Attachment } from "botbuilder";
import * as path from "path";
import config from "../config";

// See https://aka.ms/teams-ai-library to learn more about the Teams AI library.
import { Application, ActionPlanner, OpenAIModel, PromptManager } from "@microsoft/teams-ai";
import { webSearch, formatCitedResponse } from "../services/search";
import { moderateText } from "../services/moderation";
import axios from "axios";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";
import pdfParse from "pdf-parse";
import { parse as csvParse } from "csv-parse";

// Create AI components
const model = new OpenAIModel({
  azureApiKey: config.azureOpenAIKey,
  azureDefaultDeployment: config.azureOpenAIDeploymentName,
  azureEndpoint: config.azureOpenAIEndpoint,

  useSystemMessages: true,
  logRequests: true,
});
const prompts = new PromptManager({
  promptsFolder: path.join(__dirname, "../prompts"),
});
const planner = new ActionPlanner({
  model,
  prompts,
  defaultPrompt: "chat",
});

// Define storage and application
const storage = new MemoryStorage();
const app = new Application({
  storage,
  ai: {
    planner,
    enable_feedback_loop: true,
  },
});

app.feedbackLoop(async (context, state, feedbackLoopData) => {
  //add custom feedback process logic here
  console.log("Your feedback is " + JSON.stringify(context.activity.value));
});

// ---------------- Custom Enhancements -----------------

// Intent detection (simple heuristic + keywords). Could be replaced by LLM classification.
function detectIntent(text: string): string {
  const t = text.toLowerCase();
  if (/^search\b/.test(t)) return "search";
  if (/\bcard\b/.test(t) || /^generate card/.test(t)) return "card";
  if (/\bsummary\b|summarize/.test(t)) return "summarize";
  if (/help|commands/.test(t)) return "help";
  return "chat";
}

async function ensureNotFlagged(text: string, context: TurnContext): Promise<boolean> {
  const mod = await moderateText(text);
  if (mod.flagged) {
    await context.sendActivity("⚠️ Your message was blocked by safety guardrails." + (mod.reasons.length ? ` Reasons: ${mod.reasons.join(", ")}` : ""));
    return false;
  }
  return true;
}

async function processAttachments(context: TurnContext): Promise<string[]> {
  const atts = context.activity.attachments || [];
  const outputs: string[] = [];
  for (const att of atts) {
    try {
      const text = await extractTextFromAttachment(att);
      outputs.push(text.slice(0, 4000)); // limit
    } catch (e) {
      outputs.push("[Error processing attachment]");
    }
  }
  return outputs;
}

async function extractTextFromAttachment(att: Attachment): Promise<string> {
  if (!att.contentUrl) return "";
  const tmp = path.join(os.tmpdir(), crypto.randomUUID() + '-' + (att.name || 'file'));
  const resp = await axios.get(att.contentUrl, { responseType: 'arraybuffer' });
  fs.writeFileSync(tmp, resp.data);
  const lower = (att.name || '').toLowerCase();
  let content = '';
  if (lower.endsWith('.pdf')) {
    const pdfData = await pdfParse(fs.readFileSync(tmp));
    content = pdfData.text;
  } else if (lower.endsWith('.csv')) {
    content = await parseCsv(fs.readFileSync(tmp));
  } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    content = fs.readFileSync(tmp, 'utf-8');
  } else {
    content = '[Unsupported file type – only PDF, CSV, TXT, MD processed]';
  }
  fs.unlink(tmp, () => {});
  return `File: ${att.name}\n${content}`;
}

function parseCsv(buf: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const records: string[] = [];
    csvParse(buf, { to_line: 50 }, (err, rows: string[][]) => {
      if (err) return reject(err);
      rows.forEach(r => records.push(r.join(', ')));
      resolve(records.slice(0, 50).join('\n'));
    });
  });
}

function buildAdaptiveCard(title: string, body: string) {
  return {
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium' },
      { type: 'TextBlock', text: body, wrap: true }
    ],
    actions: [
      { type: 'Action.Submit', title: 'Help', data: { command: 'help' } },
      { type: 'Action.Submit', title: 'Search docs', data: { command: 'search Teams AI library' } }
    ],
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json'
  };
}

// Main message hook: extend existing pipeline using app.message hook
app.message(/.*/i, async (context, state) => {
  const text = context.activity.text || '';

  if (!(await ensureNotFlagged(text, context))) return; // moderation

  // Handle attachments first
  if (context.activity.attachments?.length) {
    const extracted = await processAttachments(context);
    await context.sendActivity(MessageFactory.text(`Processed ${extracted.length} file(s). Content snippet(s):\n\n${extracted.join('\n---\n')}`));
    return;
  }

  const intent = detectIntent(text);

  switch (intent) {
    case 'help':
      await context.sendActivity(MessageFactory.text('Commands: search <query>, generate card <topic>, upload a file, summarize <text>.'));
      return;
    case 'search': {
      const q = text.replace(/^search\s*/i, '').trim();
      const results = await webSearch(q);
      if (!results.length) {
        await context.sendActivity('No web results or search API key missing.');
        return;
      }
      const summaryPrompt = `Summarize objectively the following search results and cite them as [n]:\n${results.map((r, i) => `[${i + 1}] ${r.title}: ${r.snippet}`).join('\n')}`;
      // Use model to summarize with citations
      const completion = await model.completeChat([{ role: 'user', content: summaryPrompt }]);
      const cited = formatCitedResponse(completion.output.trim(), results);
      await context.sendActivity(cited);
      return;
    }
    case 'card': {
      const topic = text.replace(/generate card/i, '').trim() || 'Info';
      const card = buildAdaptiveCard('Generated Card', `Topic: ${topic}`);
      await context.sendActivity({ attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }] });
      return;
    }
    case 'summarize': {
      const content = text.replace(/summarize/i, '').trim();
      const completion = await model.completeChat([{ role: 'user', content: `Summarize this:
${content}` }]);
      await context.sendActivity(completion.output.trim());
      return;
    }
    default:
      // Fall through to default planner (chat) behavior
      return; // allow underlying AI planner to respond
  }
});

// -------------------------------------------------------

export default app;
