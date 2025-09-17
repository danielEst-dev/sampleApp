# Advanced Developer Assistant Agent for Microsoft Teams

This project is an enhanced AI-powered developer assistant built with the Microsoft 365 Agents Toolkit and Teams AI Library. It provides comprehensive development workflow automation, code analysis, project management, and deployment assistance directly within Microsoft Teams.

## 🚀 Features

### 🧠 AI-Powered Capabilities
- **Smart Chat**: Context-aware conversations with Azure OpenAI integration
- **Code Review**: AI-powered code analysis with suggestions and quality scoring
- **Code Generation**: Generate TypeScript code from natural language requirements
- **Web Search**: Real-time search with AI summarization and citations
- **Safety Guardrails**: Content moderation and filtering

### 📁 File & Code Analysis
- **Multi-format Support**: Process PDF, CSV, TXT, MD files
- **Code Quality Analysis**: ESLint integration with metrics tracking
- **Syntax Checking**: Real-time code validation and error detection
- **Project Insights**: Comprehensive codebase analysis and statistics

### 🔧 Development Workflow
- **Git Integration**: Status, commits, branching with interactive cards
- **Environment Management**: Multi-environment configuration handling
- **Deployment Assistance**: Teams Toolkit deployment guidance
- **Project Dashboard**: Real-time metrics and quick actions

### 🎨 Interactive UI
- **Adaptive Cards**: Rich, interactive dashboard interfaces
- **Developer Dashboard**: Project metrics, git status, quick actions
- **Command Palette**: Comprehensive command discovery and execution
- **File Upload Interface**: Drag-and-drop file analysis

## 📋 Commands Reference

### 🤖 Getting Help
- `help` - Show comprehensive command list

### 📊 Project Management
- `project` or `dashboard` - Interactive project metrics dashboard
- `analyze <pattern>` - Code analysis (e.g., `analyze *.ts`)
- `env` - List environment configurations

### 💻 Code Operations
- `review code <paste code>` - AI-powered code review with scoring
- `generate code <requirements>` - Generate code from requirements
- `analyze <file pattern>` - Code quality and metrics analysis

### 🌿 Git Operations
- `git status` - Interactive git status with actions
- `commit <message>` - Commit changes with specified message
- `branch <name>` - Create and switch to new branch
- `git log` - Recent commit history (via status card actions)

### 🚀 Deployment
- `deploy` - Show deployment options and commands
- Teams Toolkit integration for provision/deploy/publish

### 🔍 Search & Research
- `search <query>` - Web search with AI summarization
- File upload for document analysis and processing
- `summarize <text>` - AI-powered content summarization

### 🎨 UI Generation
- `generate card <topic>` - Create interactive adaptive cards
- Automatic dashboard generation with project metrics

## ⚙️ Configuration

### Required Environment Variables
Add these to your environment files (`env/.env.playground.user`, etc.):

```bash
# Azure OpenAI (Required)
SECRET_AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name

# Optional: Enhanced Features
BING_SEARCH_API_KEY=your_bing_search_key
ENABLE_MODERATION=true
OPENAI_MODERATION_KEY=your_openai_moderation_key
ENABLE_CODE_REVIEW=true
GITHUB_TOKEN=your_github_token
FILE_MAX_SIZE_MB=10
PROJECT_ROOT=./
```

### Installation & Setup

1. **Install dependencies:**
```powershell
npm install
```

2. **Configure environment:**
   - Copy environment variables to `env/.env.playground.user`
   - Ensure Azure OpenAI resource is accessible

3. **Run in development:**
```powershell
# Run in Microsoft 365 Agents Playground
npm run dev:teamsfx:testtool

# Run locally with hot reload
npm run dev
```

4. **Debug in VS Code:**
   - Press F5 and select "Debug in Microsoft 365 Agents Playground"
   - Use built-in debugging for Teams environment

## 🛠️ Development Workflow

### Local Development
1. **Start the agent:** `npm run dev:teamsfx:testtool`
2. **Open playground:** Launches automatically or use `npm run dev:teamsfx:launch-testtool`
3. **Test commands:** Try `help`, `project`, `git status`

### Deployment
```powershell
# Provision Azure resources
teamsapp provision --env sandbox

# Deploy application
teamsapp deploy --env sandbox

# Publish to Teams store (optional)
teamsapp publish --env sandbox
```

### Using VS Code Tasks
- **F5:** Debug in playground
- **Ctrl+Shift+P:** Teams Toolkit commands
- **Tasks:** Available in VS Code task runner

## 📊 Project Architecture

### Core Components
- **`src/index.ts`** - Express server and bot endpoint
- **`src/adapter.ts`** - Teams adapter with error handling  
- **`src/app/app.ts`** - Main application logic and intent routing
- **`src/config.ts`** - Environment configuration management

### Services
- **`src/services/search.ts`** - Web search and citation formatting
- **`src/services/moderation.ts`** - Content filtering and safety
- **`src/services/codeAnalysis.ts`** - Code review, analysis, generation
- **`src/services/projectManager.ts`** - Git operations, project insights

### Infrastructure
- **`infra/`** - Bicep templates for Azure deployment
- **`appPackage/`** - Teams app manifest and assets
- **`m365agents.yml`** - Teams Toolkit configuration
- **`.vscode/`** - Debug and task configurations

## 🎯 Usage Examples

### Interactive Project Dashboard
```
You: project
Bot: [Shows adaptive card with metrics, git status, quick actions]
```

### Code Review with AI
```
You: review code
function buggyCode() {
  var x = undefined;
  return x.length;
}

Bot: 🔍 Code Review (Score: 3/10)
Issues found: Undefined variable access, missing error handling...
Suggestions: Add null checks, use const/let instead of var...
```

### Git Operations
```
You: git status
Bot: [Interactive card showing modified files, commit/branch options]

You: commit Updated documentation  
Bot: ✅ Committed with message: "Updated documentation"
```

### Code Generation
```
You: generate code Create a TypeScript interface for a user profile with name, email, and optional avatar

Bot: 🛠️ Generated Code:
```typescript
interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}
```

### Web Search with Citations
```
You: search TypeScript best practices 2024

Bot: Here's a summary of TypeScript best practices for 2024...
[Provides summarized results with numbered citations]

Sources:
[1] TypeScript Handbook - https://...
[2] Microsoft TypeScript Guidelines - https://...
```

## 🔧 Customization

### Adding New Commands
1. Update `detectIntent()` function in `src/app/app.ts`
2. Add new case in the main switch statement
3. Implement command logic
4. Update help text and manifest commands

### Extending Code Analysis
1. Modify `src/services/codeAnalysis.ts`
2. Add new ESLint rules or custom analyzers
3. Enhance metrics collection
4. Add support for new file types

### Custom Adaptive Cards
1. Create card builders in `src/app/app.ts`
2. Use Adaptive Cards Designer for complex layouts
3. Add interactive actions and data submission

## 📚 Resources & References

### Microsoft Documentation
- [Microsoft 365 Agents Toolkit](https://aka.ms/teams-toolkit)
- [Teams AI Library](https://aka.ms/teams-ai-library)
- [Adaptive Cards](https://adaptivecards.io/)

### Development
- [Azure OpenAI Service](https://aka.ms/oai/access)
- [Bot Framework SDK](https://docs.microsoft.com/azure/bot-service/)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)

### Samples & Templates  
- [Teams Toolkit Samples](https://github.com/OfficeDev/TeamsFx-Samples)
- [Adaptive Cards Samples](https://adaptivecards.io/samples/)

---

**🎉 Ready to enhance your development workflow with AI-powered assistance in Microsoft Teams!**
