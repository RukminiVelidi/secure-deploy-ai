const WEIGHTS = {
  hardcoded_secret: 35,
  missing_env: 25,
  vulnerable_dependency_critical: 20,
  vulnerable_dependency_high: 10,
  debug_mode: 15,
  sensitive_console: 10,
  todo_fixme: 5,
  high_entropy_string: 20,
  vulnerability_critical: 30,
  vulnerability_high: 18,
  vulnerability_medium: 8,
  vulnerability_low: 3
};

/**
 * Score is now driven purely by severity/type — confidence is NOT factored in
 * here anymore. Five "high" findings score as five "high" findings, full stop,
 * regardless of how confident each individual match was. Confidence is still
 * recorded on each finding and shown in the UI as its own separate label, so
 * you can see "this one's less certain" without it silently discounting the
 * overall risk number. (Previous version multiplied score by confidence, which
 * could make five clearly-high findings add up to a Low score — removed.)
 */
function calculateRisk(findings) {
  let score = 0;
  findings.forEach(f => {
    let base;
    if (f.type === 'vulnerable_dependency') {
      base = f.severity === 'critical' ? WEIGHTS.vulnerable_dependency_critical
        : f.severity === 'high' ? WEIGHTS.vulnerable_dependency_high : 0;
    } else if (f.type === 'vulnerability') {
      base = WEIGHTS[`vulnerability_${f.severity}`] || 0;
    } else {
      base = WEIGHTS[f.type] || 0;
    }
    score += base;
  });
  score = Math.round(score);

  let level = 'Low';
  if (score > 60) level = 'High';
  else if (score > 30) level = 'Medium';

  const status = level === 'High' ? 'blocked' : 'allowed';
  return { score, level, status };
}

module.exports = { calculateRisk };
