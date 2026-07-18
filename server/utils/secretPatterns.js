// Comprehensive, provider-specific secret patterns — modeled on the same class of
// rules used by tools like Gitleaks/TruffleHog, rather than the previous 5 generic
// regexes. Each pattern has a fixed, high-confidence signature (a real key format),
// so these fire with very few false positives and don't need the entropy fallback.
//
// severity: critical | high | medium
// confidence: high (structural match on a known key format) | medium (generic pattern)

const PROVIDER_PATTERNS = [
  // --- Cloud providers ---
  { id: 'aws_access_key', desc: 'AWS Access Key ID', severity: 'critical', confidence: 'high',
    regex: /\b(AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[0-9A-Z]{16}\b/g },
  { id: 'aws_secret_key', desc: 'AWS Secret Access Key (near "aws" context)', severity: 'critical', confidence: 'medium',
    regex: /aws(.{0,20})?['"][0-9a-zA-Z/+]{40}['"]/gi },
  { id: 'gcp_api_key', desc: 'Google Cloud API Key', severity: 'critical', confidence: 'high',
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  { id: 'gcp_service_account', desc: 'GCP Service Account JSON key', severity: 'critical', confidence: 'high',
    regex: /"type":\s*"service_account"/g },
  { id: 'azure_storage_key', desc: 'Azure Storage Account Key', severity: 'critical', confidence: 'medium',
    regex: /AccountKey=[a-zA-Z0-9+/=]{88}/g },

  // --- Payments ---
  { id: 'stripe_live_secret', desc: 'Stripe Live Secret Key', severity: 'critical', confidence: 'high',
    regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/g },
  { id: 'stripe_live_publishable', desc: 'Stripe Live Publishable Key', severity: 'medium', confidence: 'high',
    regex: /\bpk_live_[0-9a-zA-Z]{24,}\b/g },
  { id: 'stripe_restricted', desc: 'Stripe Restricted Key', severity: 'critical', confidence: 'high',
    regex: /\brk_live_[0-9a-zA-Z]{24,}\b/g },
  { id: 'paypal_token', desc: 'PayPal / Braintree Access Token', severity: 'critical', confidence: 'high',
    regex: /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/g },
  { id: 'square_token', desc: 'Square Access Token', severity: 'critical', confidence: 'high',
    regex: /\bsq0atp-[0-9A-Za-z\-_]{22}\b/g },

  // --- Messaging / comms ---
  { id: 'slack_token', desc: 'Slack Token', severity: 'critical', confidence: 'high',
    regex: /\bxox[baprs]-[0-9A-Za-z\-]{10,}\b/g },
  { id: 'slack_webhook', desc: 'Slack Webhook URL', severity: 'high', confidence: 'high',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Za-z]{8,}\/B[0-9A-Za-z]{8,}\/[0-9A-Za-z]{20,}/g },
  { id: 'twilio_key', desc: 'Twilio API Key', severity: 'critical', confidence: 'high',
    regex: /\bSK[0-9a-fA-F]{32}\b/g },
  { id: 'twilio_account_sid', desc: 'Twilio Account SID', severity: 'medium', confidence: 'high',
    regex: /\bAC[0-9a-fA-F]{32}\b/g },
  { id: 'sendgrid_key', desc: 'SendGrid API Key', severity: 'critical', confidence: 'high',
    regex: /\bSG\.[0-9A-Za-z\-_]{22}\.[0-9A-Za-z\-_]{43}\b/g },
  { id: 'mailgun_key', desc: 'Mailgun API Key', severity: 'critical', confidence: 'high',
    regex: /\bkey-[0-9a-zA-Z]{32}\b/g },
  { id: 'mailchimp_key', desc: 'Mailchimp API Key', severity: 'high', confidence: 'high',
    regex: /\b[0-9a-f]{32}-us[0-9]{1,2}\b/g },
  { id: 'discord_webhook', desc: 'Discord Webhook URL', severity: 'medium', confidence: 'high',
    regex: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/g },
  { id: 'discord_bot_token', desc: 'Discord Bot Token', severity: 'critical', confidence: 'high',
    regex: /\b[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}\b/g },

  // --- Dev platforms ---
  { id: 'github_pat_classic', desc: 'GitHub Personal Access Token (classic)', severity: 'critical', confidence: 'high',
    regex: /\bghp_[0-9A-Za-z]{36}\b/g },
  { id: 'github_pat_fine', desc: 'GitHub Fine-grained PAT', severity: 'critical', confidence: 'high',
    regex: /\bgithub_pat_[0-9A-Za-z_]{22,}\b/g },
  { id: 'github_oauth', desc: 'GitHub OAuth Token', severity: 'critical', confidence: 'high',
    regex: /\bgho_[0-9A-Za-z]{36}\b/g },
  { id: 'github_app_token', desc: 'GitHub App Installation/User Token', severity: 'critical', confidence: 'high',
    regex: /\b(ghu|ghs)_[0-9A-Za-z]{36}\b/g },
  { id: 'gitlab_pat', desc: 'GitLab Personal Access Token', severity: 'critical', confidence: 'high',
    regex: /\bglpat-[0-9A-Za-z\-_]{20}\b/g },
  { id: 'npm_token', desc: 'npm Access Token', severity: 'high', confidence: 'high',
    regex: /\bnpm_[0-9A-Za-z]{36}\b/g },
  { id: 'heroku_key', desc: 'Heroku API Key', severity: 'high', confidence: 'medium',
    regex: /heroku(.{0,20})?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi },
  { id: 'vercel_token', desc: 'Vercel Token', severity: 'high', confidence: 'medium',
    regex: /vercel(.{0,20})?['"][0-9a-zA-Z]{24}['"]/gi },
  { id: 'docker_auth', desc: 'Docker Registry Auth Config', severity: 'high', confidence: 'medium',
    regex: /"auth":\s*"[A-Za-z0-9+/=]{20,}"/g },

  // --- AI providers ---
  { id: 'openai_key', desc: 'OpenAI API Key', severity: 'critical', confidence: 'high',
    regex: /\bsk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}\b|\bsk-proj-[A-Za-z0-9_\-]{20,}\b/g },
  { id: 'anthropic_key', desc: 'Anthropic API Key', severity: 'critical', confidence: 'high',
    regex: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g },
  { id: 'groq_key', desc: 'Groq API Key', severity: 'critical', confidence: 'high',
    regex: /\bgsk_[A-Za-z0-9]{20,}\b/g },
  { id: 'huggingface_token', desc: 'Hugging Face Token', severity: 'high', confidence: 'high',
    regex: /\bhf_[A-Za-z0-9]{34}\b/g },
  { id: 'cohere_key', desc: 'Cohere API Key', severity: 'high', confidence: 'medium',
    regex: /cohere(.{0,20})?['"][0-9A-Za-z]{40}['"]/gi },

  // --- Databases / infra ---
  { id: 'mongodb_uri', desc: 'MongoDB Connection String with credentials', severity: 'critical', confidence: 'high',
    regex: /mongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]+@[^\s'"]+/g },
  { id: 'postgres_uri', desc: 'PostgreSQL Connection String with credentials', severity: 'critical', confidence: 'high',
    regex: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^\s'"]+/g },
  { id: 'mysql_uri', desc: 'MySQL Connection String with credentials', severity: 'critical', confidence: 'high',
    regex: /mysql:\/\/[^:\s]+:[^@\s]+@[^\s'"]+/g },
  { id: 'redis_uri', desc: 'Redis Connection String with credentials', severity: 'high', confidence: 'high',
    regex: /redis:\/\/[^:\s]+:[^@\s]+@[^\s'"]+/g },
  { id: 'firebase_key', desc: 'Firebase / Google API Key', severity: 'high', confidence: 'high',
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  { id: 'supabase_key', desc: 'Supabase Service Role Key', severity: 'critical', confidence: 'medium',
    regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g }, // JWT shape, flagged w/ context

  // --- Crypto / keys ---
  { id: 'private_key_block', desc: 'Private key block (PEM)', severity: 'critical', confidence: 'high',
    regex: /-----BEGIN\s?(RSA|EC|OPENSSH|PGP|DSA)?\s?PRIVATE KEY-----/g },
  { id: 'ssh_key', desc: 'SSH Private Key', severity: 'critical', confidence: 'high',
    regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g },
  { id: 'jwt_hardcoded', desc: 'Hardcoded JWT (possible session/auth token)', severity: 'medium', confidence: 'medium',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },

  // --- Generic (kept as a safety net, but tightened vs. the old version) ---
  { id: 'generic_api_key', desc: 'Generic API key assignment', severity: 'high', confidence: 'medium',
    regex: /\b(api[_-]?key|apikey)\b\s*[:=]\s*['"`][A-Za-z0-9_\-]{16,}['"`]/gi },
  { id: 'generic_secret', desc: 'Generic secret assignment', severity: 'high', confidence: 'medium',
    regex: /\bsecret\b\s*[:=]\s*['"`][A-Za-z0-9_\-]{8,}['"`]/gi },
  { id: 'generic_password', desc: 'Hardcoded password assignment', severity: 'critical', confidence: 'medium',
    regex: /\bpassword\b\s*[:=]\s*['"`][^'"`\s]{4,}['"`]/gi },
  { id: 'generic_bearer_token', desc: 'Hardcoded Bearer token', severity: 'high', confidence: 'medium',
    regex: /Bearer\s+[A-Za-z0-9_\-.]{20,}/g }
];

const DEBUG_PATTERNS = [
  { id: 'debug_flag', desc: 'Debug mode enabled', severity: 'high', regex: /\bDEBUG\s*=\s*true\b/gi },
  { id: 'morgan_logger', desc: 'Morgan request logger left in code', severity: 'medium', regex: /app\.use\(\s*morgan\(/g },
  { id: 'console_debug', desc: 'console.debug left in code', severity: 'low', regex: /console\.debug\(/g },
  { id: 'node_env_dev_hardcoded', desc: 'NODE_ENV hardcoded to development', severity: 'medium', regex: /NODE_ENV\s*=\s*['"]development['"]/g }
];

const SENSITIVE_LOG_PATTERNS = [
  { id: 'log_sensitive', desc: 'console.log printing sensitive data', severity: 'medium',
    regex: /console\.(log|info|warn)\([^)]*?(password|token|secret|apikey|api_key|authorization)/gi }
];

const TODO_PATTERNS = [
  { id: 'todo_fixme', desc: 'TODO/FIXME comment left in production code', severity: 'low',
    regex: /\/\/\s*(TODO|FIXME|HACK|XXX):/gi }
];

// File paths/extensions where entropy scanning is skipped or de-weighted, since
// these are legitimately full of high-entropy strings (hashes, minified bundles,
// lockfiles) and would otherwise flood findings with false positives.
const ENTROPY_SKIP_PATTERNS = [
  /\.min\.js$/, /\.map$/, /package-lock\.json$/, /yarn\.lock$/, /pnpm-lock\.yaml$/,
  /\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/, /\/dist\//, /\/build\//, /\/node_modules\//,
  /\.test\.(js|ts)$/, /\.spec\.(js|ts)$/, /__tests__\//, /\.snap$/
];

module.exports = {
  PROVIDER_PATTERNS,
  DEBUG_PATTERNS,
  SENSITIVE_LOG_PATTERNS,
  TODO_PATTERNS,
  ENTROPY_SKIP_PATTERNS
};
