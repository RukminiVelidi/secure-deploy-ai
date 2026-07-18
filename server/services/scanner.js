const {
  PROVIDER_PATTERNS,
  DEBUG_PATTERNS,
  SENSITIVE_LOG_PATTERNS,
  TODO_PATTERNS,
  ENTROPY_SKIP_PATTERNS
} = require('../utils/secretPatterns');
const { VULN_PATTERNS } = require('../utils/vulnPatterns');

function runPatternSet(filename, content, patterns, type) {
  const findings = [];
  const lines = content.split('\n');
  patterns.forEach(({ id, desc, severity, confidence, regex }) => {
    lines.forEach((line, idx) => {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        findings.push({
          type,
          file: filename,
          line: idx + 1,
          message: `${desc} (rule: ${id})`,
          severity,
          confidence: confidence || 'high',
          detectionMethod: 'signature'
        });
      }
    });
  });
  return findings;
}

/**
 * Main per-file scan: known-provider secret signatures + debug/log/todo patterns.
 * This replaces the old 5-regex approach with ~35 provider-specific rules that
 * match actual key formats (Stripe, AWS, GitHub, OpenAI, Mongo URIs, etc.), so
 * detection is not limited to a handful of hand-picked cases.
 */
function scanFile(filename, content) {
  if (filename.endsWith('.env')) return []; // handled separately by scanEnvUsage
  return [
    ...runPatternSet(filename, content, PROVIDER_PATTERNS, 'hardcoded_secret'),
    ...runPatternSet(filename, content, DEBUG_PATTERNS, 'debug_mode'),
    ...runPatternSet(filename, content, SENSITIVE_LOG_PATTERNS, 'sensitive_console'),
    ...runPatternSet(filename, content, TODO_PATTERNS, 'todo_fixme')
  ];
}

function scanEnvUsage(filename, content, envFileContent) {
  const findings = [];
  const envVarRegex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  const definedVars = new Set();
  if (envFileContent) {
    envFileContent.split('\n').forEach(line => {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match) definedVars.add(match[1]);
    });
  }
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    let m;
    envVarRegex.lastIndex = 0;
    while ((m = envVarRegex.exec(line)) !== null) {
      const varName = m[1];
      if (definedVars.size > 0 && !definedVars.has(varName)) {
        findings.push({
          type: 'missing_env',
          file: filename,
          line: idx + 1,
          message: `process.env.${varName} used but not found in .env`,
          severity: 'high',
          confidence: 'high',
          detectionMethod: 'static_analysis'
        });
      }
    }
  });
  return findings;
}

function shannonEntropy(str) {
  const freq = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  return Object.values(freq).reduce((e, f) => {
    const p = f / str.length;
    return e - p * Math.log2(p);
  }, 0);
}

// Cheap heuristics to rule out obviously-not-secrets before we even bother
// scoring entropy — cuts a large chunk of false positives for free.
function looksLikeSecretCandidate(str) {
  if (/^[a-f0-9]{32}$/i.test(str)) return true; // could be an md5/api key
  if (/^[a-f0-9]{40}$/i.test(str)) return false; // git SHA — extremely common, not a secret
  if (/^[0-9a-zA-Z+/]+={0,2}$/.test(str) && str.length % 4 === 0) return true; // base64-shaped
  if (/^[A-Za-z0-9_\-]{20,}$/.test(str)) return true; // opaque token shape
  return true;
}

/**
 * High-entropy string detector, now with:
 *  - a skip-list for paths that are legitimately full of random-looking strings
 *    (minified bundles, lockfiles, test fixtures, images)
 *  - a slightly higher bar + candidate pre-filter to cut noise
 *  - findings are marked confidence:'medium'/detectionMethod:'entropy' rather than
 *    'high', so the orchestrator knows to send these through the Groq second-opinion
 *    pass before they're shown as confirmed secrets.
 */
function scanForHighEntropyStrings(filename, content) {
  if (ENTROPY_SKIP_PATTERNS.some(p => p.test(filename))) return [];

  const findings = [];
  const lines = content.split('\n');
  const stringRegex = /['"`]([A-Za-z0-9+/=_\-]{20,})['"`]/g;

  lines.forEach((line, idx) => {
    let match;
    stringRegex.lastIndex = 0;
    while ((match = stringRegex.exec(line)) !== null) {
      const candidate = match[1];
      if (!looksLikeSecretCandidate(candidate)) continue;

      const entropy = shannonEntropy(candidate);
      if (entropy > 4.3) {
        findings.push({
          type: 'high_entropy_string',
          file: filename,
          line: idx + 1,
          message: `High entropy string (entropy: ${entropy.toFixed(2)}) — possible unrecognized secret`,
          severity: entropy > 5 ? 'high' : 'medium',
          confidence: 'low',
          detectionMethod: 'entropy',
          _rawValue: candidate.slice(0, 6) + '…' // never store/expose the full value
        });
      }
    }
  });
  return findings;
}

/**
 * Vulnerability scan — SQLi, XSS, SSRF, insecure crypto, command injection, etc.
 * Separate from scanFile() (which covers hardcoded secrets/debug/todo) so each
 * check category can be toggled independently in project settings.
 */
function scanVulnerabilities(filename, content) {
  return runPatternSet(filename, content, VULN_PATTERNS, 'vulnerability');
}

module.exports = { scanFile, scanEnvUsage, scanForHighEntropyStrings, scanVulnerabilities };
