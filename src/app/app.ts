import { MemoryStorage, MessageFactory, TurnContext, Attachment } from "botbuilder";
import * as path from "path";
import config from "../config";

// See https://aka.ms/teams-ai-library to learn more about the Teams AI library.
import { Application, ActionPlanner, OpenAIModel, PromptManager } from "@microsoft/teams-ai";
import { webSearch, formatCitedResponse } from "../services/search";
import { moderateText } from "../services/moderation";
import { analyzeCode, reviewCode, generateCode, findProjectFiles } from "../services/codeAnalysis";
import { getGitStatus, commitChanges, createBranch, getCommitHistory, analyzeProject, getEnvironments } from "../services/projectManager";
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
  if (/^review code|code review/.test(t)) return "code_review";
  if (/^analyze|analysis/.test(t)) return "code_analysis";
  if (/^generate code|create code/.test(t)) return "code_generate";
  if (/^git status|status/.test(t)) return "git_status";
  if (/^commit/.test(t)) return "git_commit";
  if (/^branch/.test(t)) return "git_branch";
  if (/^project|dashboard/.test(t)) return "project_info";
  if (/^deploy|deployment/.test(t)) return "deployment";
  if (/^env|environment/.test(t)) return "environment";
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

function buildDeveloperDashboard(projectMetrics: any) {
  return {
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: '🚀 Developer Dashboard', weight: 'Bolder', size: 'Large' },
      { type: 'ColumnSet', columns: [
        { type: 'Column', width: 'stretch', items: [
          { type: 'TextBlock', text: `📁 ${projectMetrics.totalFiles} Files`, weight: 'Bolder' },
          { type: 'TextBlock', text: `📝 ${projectMetrics.totalLines.toLocaleString()} Lines` },
          { type: 'TextBlock', text: `👥 ${projectMetrics.contributors.length} Contributors` }
        ]},
        { type: 'Column', width: 'stretch', items: [
          { type: 'TextBlock', text: `📦 Dependencies: ${Object.keys(projectMetrics.dependencies).length}` },
          { type: 'TextBlock', text: `🔧 Dev Dependencies: ${Object.keys(projectMetrics.devDependencies).length}` },
          { type: 'TextBlock', text: `💾 Last Commit: ${projectMetrics.lastCommit.split(' - ')[0]}` }
        ]}
      ]},
      { type: 'TextBlock', text: '💻 Languages:', weight: 'Bolder', spacing: 'Medium' },
      { type: 'TextBlock', text: Object.entries(projectMetrics.languages).map(([ext, count]) => `${ext}: ${count}`).join(', '), wrap: true },
    ],
    actions: [
      { type: 'Action.Submit', title: '📊 Analyze Code', data: { command: 'analyze *.ts' } },
      { type: 'Action.Submit', title: '🔍 Git Status', data: { command: 'git status' } },
      { type: 'Action.Submit', title: '🌐 Deploy', data: { command: 'deploy' } },
      { type: 'Action.Submit', title: '⚙️ Environments', data: { command: 'env' } }
    ],
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json'
  };
}

function buildGitStatusCard(gitStatus: any) {
  return {
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      { type: 'TextBlock', text: `🌿 Branch: ${gitStatus.current}`, weight: 'Bolder', size: 'Medium' },
      { type: 'TextBlock', text: `📈 Ahead: ${gitStatus.ahead} | 📉 Behind: ${gitStatus.behind}` },
      { type: 'TextBlock', text: '📝 Modified Files:', weight: 'Bolder', spacing: 'Medium' },
      ...gitStatus.files.slice(0, 5).map((f: any) => ({
        type: 'TextBlock',
        text: `${f.staged ? '✅' : '⚠️'} ${f.path} (${f.status})`,
        wrap: true
      }))
    ],
    actions: [
      { type: 'Action.Submit', title: '💾 Commit All', data: { command: 'commit Auto-commit via bot' } },
      { type: 'Action.Submit', title: '🌿 New Branch', data: { command: 'branch feature/new-feature' } },
      { type: 'Action.Submit', title: '📜 History', data: { command: 'git log' } }
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
      await context.sendActivity(MessageFactory.text(`🤖 **Developer Assistant Commands:**

**📁 File & Code:**
• \`analyze <file>\` - Code analysis & quality check
• \`review code <paste code>\` - AI-powered code review
• \`generate code <requirements>\` - Generate code from requirements
• \`search <query>\` - Web search with citations

**🔧 Git & Project:**
• \`git status\` - Show git status with interactive card
• \`commit <message>\` - Commit changes
• \`branch <name>\` - Create new branch
• \`project\` or \`dashboard\` - Show project metrics

**🚀 Deployment & Environment:**
• \`deploy\` - Show deployment options
• \`env\` - List environment configurations

**📎 Files:**
• Upload files (PDF, CSV, TXT, MD) for analysis
• \`generate card <topic>\` - Create interactive cards
• \`summarize <text>\` - Summarize content`));
      return;

    case 'code_analysis': {
      const pattern = text.replace(/^analyze\s*/i, '').trim() || '**/*.ts';
      const files = await findProjectFiles(pattern);
      
      if (files.length === 0) {
        await context.sendActivity('No files found matching pattern.');
        return;
      }
      
      const results = [];
      for (const file of files.slice(0, 3)) { // Limit to 3 files
        const analysis = await analyzeCode(file);
        results.push(`**${file}:**\n- ${analysis.issues.length} issues\n- ${analysis.metrics.lines} lines, ${analysis.metrics.functions} functions\n- Complexity: ${analysis.metrics.complexity}`);
      }
      
      await context.sendActivity(MessageFactory.text(`📊 **Code Analysis Results:**\n\n${results.join('\n\n')}`));
      return;
    }

    case 'code_review': {
      const code = text.replace(/^(review code|code review)\s*/i, '').trim();
      if (!code) {
        await context.sendActivity('Please provide code to review after the command.');
        return;
      }
      
      const review = await reviewCode(code);
      const response = `🔍 **Code Review (Score: ${review.score}/10)**\n\n${review.summary}\n\n**Suggestions:**\n${review.suggestions.map(s => `• ${s}`).join('\n')}\n\n**Issues:**\n${review.issues.map(i => `⚠️ ${i}`).join('\n')}`;
      await context.sendActivity(MessageFactory.text(response));
      return;
    }

    case 'code_generate': {
      const requirements = text.replace(/^(generate code|create code)\s*/i, '').trim();
      if (!requirements) {
        await context.sendActivity('Please specify requirements for code generation.');
        return;
      }
      
      const code = await generateCode(requirements);
      await context.sendActivity(MessageFactory.text(`🛠️ **Generated Code:**\n\n\`\`\`typescript\n${code}\n\`\`\``));
      return;
    }

    case 'git_status': {
      const gitStatus = await getGitStatus();
      const card = buildGitStatusCard(gitStatus);
      await context.sendActivity({ attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }] });
      return;
    }

    case 'git_commit': {
      const message = text.replace(/^commit\s*/i, '').trim() || 'Auto-commit via bot';
      const success = await commitChanges(message);
      await context.sendActivity(MessageFactory.text(success ? `✅ Committed with message: "${message}"` : '❌ Commit failed'));
      return;
    }

    case 'git_branch': {
      const branchName = text.replace(/^branch\s*/i, '').trim();
      if (!branchName) {
        await context.sendActivity('Please specify branch name.');
        return;
      }
      
      const success = await createBranch(branchName);
      await context.sendActivity(MessageFactory.text(success ? `✅ Created and switched to branch: ${branchName}` : '❌ Branch creation failed'));
      return;
    }

    case 'project_info': {
      const metrics = await analyzeProject();
      const card = buildDeveloperDashboard(metrics);
      await context.sendActivity({ attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }] });
      return;
    }

    case 'deployment': {
      await context.sendActivity(MessageFactory.text(`🚀 **Deployment Options:**

**Microsoft 365 Agents Toolkit:**
• \`npm run dev:teamsfx:testtool\` - Run in playground
• \`teamsapp provision --env sandbox\` - Provision resources
• \`teamsapp deploy --env sandbox\` - Deploy to Azure
• \`teamsapp publish --env sandbox\` - Publish to Teams store

**Tasks Available:**
• F5 in VS Code to debug in playground
• Use VS Code command palette for toolkit commands
• Check .vscode/tasks.json for all available tasks`));
      return;
    }

    case 'environment': {
      const environments = getEnvironments();
      const envInfo = environments.map(env => 
        `**${env.name}** ${env.active ? '(Active)' : ''}\n• ${Object.keys(env.variables).length} variables`
      ).join('\n\n');
      
      await context.sendActivity(MessageFactory.text(`⚙️ **Environment Configurations:**\n\n${envInfo}`));
      return;
    }

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
      const metrics = await analyzeProject(); // Get real project data for demo
      const card = buildDeveloperDashboard(metrics);
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
