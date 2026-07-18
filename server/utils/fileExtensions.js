// Single source of truth for "what counts as a scannable file" — previously this
// list was duplicated across githubService.js, publicGithubService.js, and the
// upload route, which meant expanding it required editing three places and they'd
// drift out of sync. Now everything imports from here.

const SUPPORTED_EXT = [
  // JS/TS ecosystem
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte',
  // Config/data
  '.json', '.env', '.yml', '.yaml', '.toml', '.ini', '.properties', '.xml',
  // Backend languages
  '.py', '.rb', '.go', '.java', '.kt', '.php', '.cs', '.cpp', '.cc', '.c', '.h',
  '.rs', '.swift', '.scala',
  // Infra / scripts
  '.sql', '.sh', '.bash', '.ps1', '.tf',
  // Markup that can carry XSS/injection risk
  '.html', '.htm'
];

// Files with no extension that are still worth scanning
const SUPPORTED_BASENAMES = ['Dockerfile', 'Makefile', 'docker-compose.yml'];

// Paths that should never be scanned regardless of extension — build output,
// dependency trees, and generated/vendor code produce enormous noise.
const SKIP_DIR_SEGMENTS = [
  'node_modules/', '.git/', 'dist/', 'build/', '.next/', 'vendor/', 'venv/', '.venv/',
  '__pycache__/', 'coverage/', '.cache/', 'target/', 'bin/obj/'
];

function isSupported(filePath) {
  if (SKIP_DIR_SEGMENTS.some(seg => filePath.includes(seg))) return false;
  const basename = filePath.split('/').pop();
  if (SUPPORTED_BASENAMES.includes(basename)) return true;
  return SUPPORTED_EXT.some(ext => filePath.endsWith(ext));
}

module.exports = { SUPPORTED_EXT, SUPPORTED_BASENAMES, SKIP_DIR_SEGMENTS, isSupported };
