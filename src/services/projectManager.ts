import simpleGit from "simple-git";
import * as fs from "fs";
import * as path from "path";
import config from "../config";

export interface GitStatus {
  current: string;
  files: Array<{
    path: string;
    status: string;
    staged: boolean;
  }>;
  ahead: number;
  behind: number;
}

export interface ProjectMetrics {
  totalFiles: number;
  totalLines: number;
  languages: { [key: string]: number };
  lastCommit: string;
  contributors: string[];
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
}

// Git operations
export async function getGitStatus(): Promise<GitStatus> {
  try {
    const git = simpleGit(config.projectRoot);
    const status = await git.status();
    
    return {
      current: status.current,
      files: status.files.map(f => ({
        path: f.path,
        status: f.working_dir + f.index,
        staged: f.index !== ' ' && f.index !== '?',
      })),
      ahead: status.ahead,
      behind: status.behind,
    };
  } catch (e) {
    console.error("Git status failed:", e);
    return { current: "unknown", files: [], ahead: 0, behind: 0 };
  }
}

export async function commitChanges(message: string, files?: string[]): Promise<boolean> {
  try {
    const git = simpleGit(config.projectRoot);
    
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }
    
    await git.commit(message);
    return true;
  } catch (e) {
    console.error("Git commit failed:", e);
    return false;
  }
}

export async function createBranch(branchName: string): Promise<boolean> {
  try {
    const git = simpleGit(config.projectRoot);
    await git.checkoutLocalBranch(branchName);
    return true;
  } catch (e) {
    console.error("Branch creation failed:", e);
    return false;
  }
}

export async function getCommitHistory(count = 10): Promise<Array<{ hash: string; message: string; author: string; date: string }>> {
  try {
    const git = simpleGit(config.projectRoot);
    const log = await git.log({ maxCount: count });
    
    return log.all.map(commit => ({
      hash: commit.hash.substring(0, 8),
      message: commit.message,
      author: commit.author_name,
      date: commit.date,
    }));
  } catch (e) {
    console.error("Git history failed:", e);
    return [];
  }
}

// Project analysis
export async function analyzeProject(): Promise<ProjectMetrics> {
  try {
    const packageJsonPath = path.join(config.projectRoot, 'package.json');
    let dependencies = {};
    let devDependencies = {};
    
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      dependencies = pkg.dependencies || {};
      devDependencies = pkg.devDependencies || {};
    }
    
    const git = simpleGit(config.projectRoot);
    let lastCommit = "";
    let contributors: string[] = [];
    
    try {
      const log = await git.log({ maxCount: 1 });
      if (log.latest) {
        lastCommit = `${log.latest.hash.substring(0, 8)} - ${log.latest.message}`;
      }
      
      const allLog = await git.log();
      const authorSet = new Set(allLog.all.map(c => c.author_name));
      contributors = Array.from(authorSet);
    } catch (e) {
      console.warn("Git analysis failed:", e);
    }
    
    // Count files and lines (simplified)
    const sourceFiles = await findSourceFiles(config.projectRoot);
    let totalFiles = sourceFiles.length;
    let totalLines = 0;
    const languages: { [key: string]: number } = {};
    
    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').length;
        totalLines += lines;
        
        const ext = path.extname(file);
        languages[ext] = (languages[ext] || 0) + 1;
      } catch (e) {
        // Skip files that can't be read
      }
    }
    
    return {
      totalFiles,
      totalLines,
      languages,
      lastCommit,
      contributors,
      dependencies,
      devDependencies,
    };
  } catch (e) {
    console.error("Project analysis failed:", e);
    return {
      totalFiles: 0,
      totalLines: 0,
      languages: {},
      lastCommit: "",
      contributors: [],
      dependencies: {},
      devDependencies: {},
    };
  }
}

async function findSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cs', '.go', '.rs'];
  
  function walkDir(currentPath: string) {
    if (currentPath.includes('node_modules') || currentPath.includes('.git')) {
      return;
    }
    
    try {
      const items = fs.readdirSync(currentPath);
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (extensions.includes(path.extname(item))) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // Skip directories we can't read
    }
  }
  
  walkDir(dir);
  return files;
}

// Environment management
export interface Environment {
  name: string;
  variables: { [key: string]: string };
  active: boolean;
}

export function getEnvironments(): Environment[] {
  const envDir = path.join(config.projectRoot, 'env');
  const environments: Environment[] = [];
  
  try {
    if (fs.existsSync(envDir)) {
      const files = fs.readdirSync(envDir).filter(f => f.startsWith('.env.'));
      
      for (const file of files) {
        const name = file.replace('.env.', '');
        const filePath = path.join(envDir, file);
        const variables: { [key: string]: string } = {};
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          
          for (const line of lines) {
            if (line.includes('=') && !line.startsWith('#')) {
              const [key, value] = line.split('=', 2);
              variables[key.trim()] = value.trim();
            }
          }
          
          environments.push({
            name,
            variables,
            active: name === process.env.TEAMSFX_ENV,
          });
        } catch (e) {
          console.warn(`Failed to read ${file}:`, e);
        }
      }
    }
  } catch (e) {
    console.error("Environment analysis failed:", e);
  }
  
  return environments;
}
