const Groq = require('groq-sdk');
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Second-opinion pass for low-confidence entropy findings. The regex/entropy
 * scanner over-flags (hashes, minified identifiers, base64 images, etc.) — rather
 * than a flat entropy cutoff being the final word, ambiguous hits get judged here
 * using surrounding code context, which is exactly the kind of judgment call a
 * fixed pattern can't make. This is what makes detection "dynamic" beyond the
 * signature list: anything the signatures miss but looks statistically suspicious
 * still gets a real second look instead of being silently dropped or blindly kept.
 */
async function classifyAmbiguousFindings(candidates) {
  if (candidates.length === 0) return [];

  const prompt = `You are a security analyst. For each code snippet below, decide whether the
highlighted string is LIKELY_SECRET, LIKELY_NOT_SECRET, or UNCERTAIN based on the surrounding
context (variable names, file type, how it's used). Things like git commit hashes, CSS class
hashes, base64 image data, minified identifiers, and test fixture data are LIKELY_NOT_SECRET.
Things assigned to variables like apiKey/token/secret/password, or matching real credential
formats, are LIKELY_SECRET.

Candidates:
${JSON.stringify(candidates.map((c, i) => ({ index: i, file: c.file, line: c.line, context: c.context })), null, 2)}

Return ONLY valid JSON, no markdown, no backticks:
{ "results": [ { "index": 0, "verdict": "LIKELY_SECRET" | "LIKELY_NOT_SECRET" | "UNCERTAIN", "reason": "short reason" } ] }`;

  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1500
    });
    const cleaned = response.choices[0].message.content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.results || [];
  } catch (err) {
    console.error('Groq classification error:', err.message);
    // Fail safe: if AI classification is unavailable, keep findings as UNCERTAIN
    // rather than silently dropping or silently confirming them.
    return candidates.map((_, i) => ({ index: i, verdict: 'UNCERTAIN', reason: 'AI classification unavailable' }));
  }
}

async function getGptExplanations(findings) {
  if (findings.length === 0) {
    return {
      findings: [],
      summary: 'No issues found. This deployment looks clean and safe to proceed.'
    };
  }

  const prompt = `You are a security code review expert. Analyze these code findings and return a JSON object.

For "fixable" and "fixDiff", follow these rules by finding type:

SECRETS (hardcoded_secret, high_entropy_string): fixable:true only if replacing the value with
process.env.VARIABLE_NAME is safe — never fixable if it would require knowing the real secret value.

VULNERABILITIES (type: "vulnerability") — fixable:true ONLY for these specific rule ids, since they
have a real, safe, drop-in replacement that doesn't require app-specific context:
  - xss_inner_html_assign, xss_dangerously_set_html, xss_document_write:
    fixDiff should sanitize with DOMPurify (e.g. element.innerHTML = DOMPurify.sanitize(x);)
  - weak_random_token: fixDiff should use crypto.randomBytes(32).toString('hex') instead of Math.random()
  - weak_hash_password: fixDiff should use bcrypt.hash() instead of md5/sha1
  - jwt_none_algorithm: fixDiff should specify a real algorithm, e.g. algorithm: 'HS256'
  - insecure_tls_disabled: fixDiff should remove the override / set rejectUnauthorized: true

For ALL OTHER vulnerability rule ids (sqli_*, nosql_*, command_injection_*, ssrf_*, path_traversal,
cors_wildcard_credentials, open_redirect, prototype_pollution_merge, insecure_eval,
insecure_deserialize_*): ALWAYS set fixable:false. These require an app-specific decision (which
query builder, which URL allowlist, which fields are actually safe) that a generic one-line swap
can't make correctly — a fake "fix" here would be worse than flagging it for manual review, since it
would look resolved without actually being safe. For these, explain clearly in "explanation" why it's
risky and give general remediation guidance in "fix" (e.g. "use parameterized queries" / "validate
against an allowlist of permitted domains") without fabricating exact code.

OTHER (debug_mode, sensitive_console, todo_fixme): fixable:true if removing/commenting the line is safe.

Findings:
${JSON.stringify(findings.map(f => ({ type: f.type, file: f.file, line: f.line, message: f.message, severity: f.severity })), null, 2)}

Return ONLY valid JSON, no markdown, no backticks:
{
  "findings": [
    { "index": 0, "explanation": "Plain English explanation", "fix": "Exact code fix suggestion or remediation guidance", "fixable": true, "fixDiff": "the exact replacement line of code, or empty string if not fixable" }
  ],
  "summary": "2-3 sentence overall summary of the security posture"
}`;

  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000
    });
    const raw = response.choices[0].message.content;
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Groq returned invalid JSON:', cleaned.slice(0, 200));
      throw new Error('Invalid JSON from Groq');
    }
    if (!parsed.findings) parsed.findings = [];
    if (!parsed.summary) parsed.summary = 'Analysis complete.';
    return parsed;
  } catch (err) {
    console.error('Groq error:', err.message);
    return {
      findings: findings.map((_, i) => ({
        index: i,
        explanation: 'Could not generate explanation',
        fix: 'Please review manually',
        fixable: false,
        fixDiff: ''
      })),
      summary: 'AI analysis unavailable'
    };
  }
}

module.exports = { getGptExplanations, classifyAmbiguousFindings };
