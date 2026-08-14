const fs = require('fs');

// Production-ready configuration management
const configPath = './config.json';
let config = JSON.parse(fs.readFileSync('./config.example.json'));

// Override with local config if it exists
if (fs.existsSync(configPath)) {
  config = { ...config, ...JSON.parse(fs.readFileSync(configPath)) };
}

// Override with environment variables (for production)
config = {
  ...config,
  port: process.env.PORT || config.port || 3001,
  appsScriptUrl: process.env.APPS_SCRIPT_URL || config.appsScriptUrl,
  dbPath: process.env.DATABASE_PATH || config.dbPath || './dnd.db',
  // Discord OAuth env overrides
  discordClientId: process.env.DISCORD_CLIENT_ID || config.discordClientId,
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || config.discordClientSecret,
  discordRedirectUri: process.env.DISCORD_REDIRECT_URI || config.discordRedirectUri,
  // The intake templates a DM copies (MERGE_PLAN.md §20). These are "make a copy" URLs for
  // documents the deployment owns; leaving them unset hides the copy buttons and leaves the
  // rest of the import working, because pasting an existing sheet was always the fallback.
  sheetTemplateUrl: process.env.SHEET_TEMPLATE_URL || config.sheetTemplateUrl || null,
  formTemplateUrl: process.env.FORM_TEMPLATE_URL || config.formTemplateUrl || null,
  // Optional frontend origin allowlist
  frontendOrigin: process.env.FRONTEND_ORIGIN || config.frontendOrigin,
  allowedReturnOrigins: (process.env.ALLOWED_RETURN_ORIGINS
    ? process.env.ALLOWED_RETURN_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : config.allowedReturnOrigins)
};

module.exports = { config };
