// Finds capitalised JSX tags that are neither imported nor defined in the file.
// This is the class of bug `next build` misses on dynamic routes: an undefined
// identifier is valid JS and only explodes when the component actually renders.
const fs = require("fs"), path = require("path");

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(e.name)) continue;
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p) : /\.(js|jsx)$/.test(e.name) && files.push(p);
  }
})(process.cwd());

const HTML_OR_BUILTIN = /^(Fragment|Suspense|Image|Link|Head|Script)$/;
let problems = 0;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");

  const used = new Set(
    [...src.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)].map((m) => m[1])
  );
  if (!used.size) continue;

  const defined = new Set();
  // default + named imports
  for (const m of src.matchAll(/import\s+([A-Za-z0-9_]+)\s*(?:,|from)/g)) defined.add(m[1]);
  for (const m of src.matchAll(/import\s*{([^}]+)}/g)) {
    m[1].split(",").forEach((n) => defined.add(n.trim().split(/\s+as\s+/).pop().trim()));
  }
  // locally declared components
  for (const m of src.matchAll(/(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g)) defined.add(m[1]);

  for (const name of used) {
    if (HTML_OR_BUILTIN.test(name)) continue;
    if (!defined.has(name)) {
      console.log(`  ${path.relative(process.cwd(), file)}  ->  <${name}> is used but never imported or defined`);
      problems += 1;
    }
  }
}

console.log(problems === 0
  ? "No undefined JSX components found."
  : `\n${problems} undefined component reference(s) found.`);
process.exit(problems ? 1 : 0);
