import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { ESLint } from "eslint";
import config from "../config";
import axios from "axios";

export interface CodeAnalysisResult {
  file: string;
  issues: Array<{
    line: number;
    column: number;
    severity: "error" | "warning" | "info";
    message: string;
    rule?: string;
  }>;
  metrics: {
    lines: number;
    functions: number;
    complexity: number;
  };
}

export interface CodeReviewResult {
  summary: string;
  suggestions: string[];
  score: number; // 1-10
  issues: string[];
}

// Analyze code quality using ESLint
export async function analyzeCode(filePath: string): Promise<CodeAnalysisResult> {
  const eslint = new ESLint({
    baseConfig: {
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      extends: ["eslint:recommended", "@typescript-eslint/recommended"],
      env: { node: true, es2017: true },
    },
  });

  const results = await eslint.lintFiles([filePath]);
  const result = results[0];
  
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").length;
  const functions = (content.match(/function|=>/g) || []).length;
  const complexity = calculateComplexity(content);

  return {
    file: filePath,
    issues: result.messages.map(msg => ({
      line: msg.line,
      column: msg.column,
      severity: msg.severity === 2 ? "error" : "warning",
      message: msg.message,
      rule: msg.ruleId || undefined,
    })),
    metrics: { lines, functions, complexity },
  };
}

// AI-powered code review
export async function reviewCode(code: string, language = "typescript"): Promise<CodeReviewResult> {
  if (!config.azureOpenAIKey) {
    return {
      summary: "AI code review unavailable - missing API key",
      suggestions: [],
      score: 5,
      issues: [],
    };
  }

  const prompt = `Review this ${language} code for:
- Code quality and best practices
- Potential bugs and security issues  
- Performance optimizations
- Maintainability improvements

Rate 1-10 and provide specific suggestions:

\`\`\`${language}
${code}
\`\`\``;

  try {
    const response = await axios.post(
      `${config.azureOpenAIEndpoint}/openai/deployments/${config.azureOpenAIDeploymentName}/chat/completions?api-version=2024-02-15-preview`,
      {
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.3,
      },
      {
        headers: {
          "api-key": config.azureOpenAIKey,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0].message.content;
    return parseCodeReviewResponse(content);
  } catch (e) {
    console.error("Code review failed:", e);
    return {
      summary: "Code review failed",
      suggestions: [],
      score: 5,
      issues: [],
    };
  }
}

function calculateComplexity(code: string): number {
  const complexity_keywords = ["if", "else", "for", "while", "switch", "catch", "&&", "||"];
  return complexity_keywords.reduce((count, keyword) => {
    return count + (code.match(new RegExp(keyword, "g")) || []).length;
  }, 1);
}

function parseCodeReviewResponse(content: string): CodeReviewResult {
  const lines = content.split("\n");
  let score = 5;
  const suggestions: string[] = [];
  const issues: string[] = [];
  
  // Extract score (look for "Score: X" or "Rating: X")
  const scoreMatch = content.match(/(?:score|rating):\s*(\d+)/i);
  if (scoreMatch) score = parseInt(scoreMatch[1]);
  
  // Extract suggestions and issues from bullet points
  lines.forEach(line => {
    if (line.match(/^[-*]\s/)) {
      const item = line.replace(/^[-*]\s/, "").trim();
      if (line.toLowerCase().includes("bug") || line.toLowerCase().includes("error") || line.toLowerCase().includes("issue")) {
        issues.push(item);
      } else {
        suggestions.push(item);
      }
    }
  });

  return {
    summary: content.split("\n")[0] || "Code reviewed successfully",
    suggestions,
    score,
    issues,
  };
}

// Generate code based on requirements
export async function generateCode(requirements: string, language = "typescript"): Promise<string> {
  if (!config.azureOpenAIKey) return "// Code generation unavailable - missing API key";

  const prompt = `Generate clean, well-documented ${language} code for the following requirements:

${requirements}

Requirements:
- Include proper TypeScript types
- Add JSDoc comments
- Follow best practices
- Include error handling where appropriate
- Make it production-ready`;

  try {
    const response = await axios.post(
      `${config.azureOpenAIEndpoint}/openai/deployments/${config.azureOpenAIDeploymentName}/chat/completions?api-version=2024-02-15-preview`,
      {
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      },
      {
        headers: {
          "api-key": config.azureOpenAIKey,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (e) {
    console.error("Code generation failed:", e);
    return "// Code generation failed";
  }
}

// Find project files by pattern
export async function findProjectFiles(pattern: string, rootDir = config.projectRoot): Promise<string[]> {
  try {
    return await glob(pattern, { cwd: rootDir });
  } catch (e) {
    console.error("File search failed:", e);
    return [];
  }
}
