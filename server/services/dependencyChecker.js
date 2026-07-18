const axios = require('axios');

async function checkDependencies(packageJsonContent) {
  const findings = [];
  let pkg;
  try {
    pkg = JSON.parse(packageJsonContent);
  } catch {
    return findings;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  try {
    const response = await axios.post(
      'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk',
      { packages: Object.keys(deps) },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const advisories = response.data;
    Object.entries(advisories).forEach(([pkgName, advisoryList]) => {
      advisoryList.forEach(adv => {
        findings.push({
          type: 'vulnerable_dependency',
          file: 'package.json',
          line: null,
          message: `${pkgName}: ${adv.title} (${adv.severity})`,
          severity: adv.severity,
          confidence: 'high',
          detectionMethod: 'dependency_advisory'
        });
      });
    });
  } catch (err) {
    console.error('Dep check error:', err.message);
  }
  return findings;
}

module.exports = { checkDependencies };
