const config = {
  MicrosoftAppId: process.env.BOT_ID,
  MicrosoftAppType: process.env.BOT_TYPE,
  MicrosoftAppTenantId: process.env.BOT_TENANT_ID,
  MicrosoftAppPassword: process.env.BOT_PASSWORD,
  azureOpenAIKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  bingSearchApiKey: process.env.BING_SEARCH_API_KEY,
  enableModeration: process.env.ENABLE_MODERATION === "true",
  openAIModerationApiKey: process.env.OPENAI_MODERATION_KEY,
  fileMaxSizeMB: Number(process.env.FILE_MAX_SIZE_MB || 10),
  gitHubToken: process.env.GITHUB_TOKEN,
  enableCodeReview: process.env.ENABLE_CODE_REVIEW === "true",
  projectRoot: process.env.PROJECT_ROOT || process.cwd(),
};

export default config;
