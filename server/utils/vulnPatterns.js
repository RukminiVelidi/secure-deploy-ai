// Pattern-based vulnerability detection — same approach as the free tiers of
// Semgrep/Bandit/ESLint-security: syntactic red flags rather than true dataflow
// analysis. It catches the common, high-signal cases (string-built SQL, raw HTML
// injection, shell exec with interpolated input) but — same honesty note as the
// secret scanner — this is not a substitute for a real SAST tool with taint
// tracking. It's meaningfully more than "detect nothing", not "detect everything".

const VULN_PATTERNS = [
  // --- SQL injection ---
  { id: 'sqli_string_concat', desc: 'SQL query built via string concatenation with a variable', severity: 'critical', confidence: 'medium',
    regex: /(SELECT|INSERT|UPDATE|DELETE)\b[^;'"`]*['"`]\s*\+\s*\w+/gi },
  { id: 'sqli_template_literal', desc: 'SQL query built via template literal interpolation', severity: 'critical', confidence: 'medium',
    regex: /`[^`]*?(SELECT|INSERT|UPDATE|DELETE)[^`]*?\$\{[^}]+\}[^`]*?`/gi },
  { id: 'sqli_python_fstring', desc: 'SQL query built via Python f-string/% interpolation', severity: 'critical', confidence: 'medium',
    regex: /(execute|cursor\.execute)\(\s*f?['"]\s*(SELECT|INSERT|UPDATE|DELETE)[^'"]*%s[^'"]*['"]\s*%/gi },
  { id: 'sqli_raw_query_var', desc: 'Raw SQL query function called with a directly concatenated variable', severity: 'high', confidence: 'low',
    regex: /\.(query|raw)\(\s*['"`][^'"`]*\+\s*(req\.|params\.|body\.)/gi },

  // --- NoSQL injection ---
  { id: 'nosql_injection_body', desc: 'MongoDB query built directly from unvalidated request input', severity: 'critical', confidence: 'medium',
    regex: /\.(find|findOne|update|deleteOne|deleteMany)\(\s*req\.(body|query|params)\b/g },
  { id: 'nosql_where_eval', desc: 'MongoDB $where with interpolated input (arbitrary JS execution risk)', severity: 'critical', confidence: 'high',
    regex: /\$where\s*:\s*['"`].*\$\{/g },

  // --- Command / OS injection ---
  { id: 'command_injection_exec', desc: 'Shell command executed with interpolated/concatenated input', severity: 'critical', confidence: 'medium',
    regex: /(exec|execSync|spawn)\(\s*(`[^`]*\$\{|['"][^'"]*['"]\s*\+)/g },
  { id: 'command_injection_python', desc: 'Python subprocess/os.system called with shell=True and interpolated input', severity: 'critical', confidence: 'medium',
    regex: /(os\.system|subprocess\.(call|run|Popen))\([^)]*(shell\s*=\s*True)?[^)]*f['"]/g },

  // --- XSS / HTML injection ---
  { id: 'xss_dangerously_set_html', desc: 'dangerouslySetInnerHTML with non-sanitized content', severity: 'high', confidence: 'medium',
    regex: /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html\s*:\s*(?!DOMPurify|sanitize)/g },
  { id: 'xss_inner_html_assign', desc: 'innerHTML assigned directly from a variable (potential DOM XSS)', severity: 'high', confidence: 'medium',
    regex: /\.innerHTML\s*=\s*(?!['"`]\s*['"`])[a-zA-Z_$][\w.]*\s*;/g },
  { id: 'xss_document_write', desc: 'document.write with dynamic content', severity: 'medium', confidence: 'low',
    regex: /document\.write\(\s*[a-zA-Z_$]/g },

  // --- SSRF ---
  { id: 'ssrf_fetch_user_url', desc: 'Outbound request (fetch/axios) made to a user-controlled URL', severity: 'high', confidence: 'medium',
    regex: /(axios\.(get|post)|fetch)\(\s*(req\.(body|query|params)|url)\b/g },

  // --- Path traversal ---
  { id: 'path_traversal', desc: 'File path built from unvalidated request input (path traversal risk)', severity: 'high', confidence: 'medium',
    regex: /(readFile|writeFile|createReadStream|sendFile)\w*\(\s*(path\.join\()?[^)]*req\.(params|query|body)/g },

  // --- Insecure crypto / secrets handling ---
  { id: 'weak_hash_password', desc: 'MD5/SHA1 used for password or token hashing (not suitable for passwords)', severity: 'high', confidence: 'medium',
    regex: /(md5|sha1)\([^)]*password/gi },
  { id: 'weak_random_token', desc: 'Math.random() used to generate a security-sensitive token/id', severity: 'high', confidence: 'medium',
    regex: /(token|secret|password|otp|sessionId)\s*=\s*[^;]*Math\.random\(\)/gi },
  { id: 'jwt_none_algorithm', desc: 'JWT signed/verified with algorithm "none"', severity: 'critical', confidence: 'high',
    regex: /algorithm\s*:\s*['"]none['"]/gi },
  { id: 'insecure_tls_disabled', desc: 'TLS/SSL certificate verification disabled', severity: 'critical', confidence: 'high',
    regex: /(rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0)/g },

  // --- Deserialization ---
  { id: 'insecure_eval', desc: 'eval() or new Function() used on dynamic input', severity: 'critical', confidence: 'medium',
    regex: /\b(eval|new Function)\(\s*(?!['"`])/g },
  { id: 'insecure_deserialize_python', desc: 'pickle.loads / yaml.load without SafeLoader (unsafe deserialization)', severity: 'critical', confidence: 'medium',
    regex: /(pickle\.loads|yaml\.load\((?!.*SafeLoader))/g },
  { id: 'insecure_deserialize_node', desc: 'node-serialize or similar unserialize() called on external input', severity: 'critical', confidence: 'low',
    regex: /\bunserialize\(\s*(req\.|JSON\.parse\(req\.)/g },

  // --- Misc web security misconfig ---
  { id: 'cors_wildcard_credentials', desc: 'CORS configured with wildcard origin alongside credentials — effectively disables CORS protection', severity: 'high', confidence: 'medium',
    regex: /origin\s*:\s*['"]\*['"][^}]*credentials\s*:\s*true/g },
  { id: 'prototype_pollution_merge', desc: 'Recursive merge/extend of unvalidated input (prototype pollution risk)', severity: 'medium', confidence: 'low',
    regex: /(_\.merge|deepmerge|extend)\(\s*\{\},\s*req\.(body|query)/g },
  { id: 'open_redirect', desc: 'Redirect target taken directly from request input without validation', severity: 'medium', confidence: 'low',
    regex: /res\.redirect\(\s*req\.(query|body|params)\b/g }
];

module.exports = { VULN_PATTERNS };
