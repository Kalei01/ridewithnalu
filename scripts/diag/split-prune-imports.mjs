// Removes import specifiers from a file that nothing in it references any more (used after split-extract).
// usage: node scripts/diag/split-prune-imports.mjs <file>
import ts from "typescript";
import fs from "node:fs";
const file = process.argv[2];
const src = fs.readFileSync(file, "utf8");
const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const counts = new Map();
const walk = (n) => {
  if (ts.isImportDeclaration(n)) return;
  if (ts.isIdentifier(n)) counts.set(n.text, (counts.get(n.text) ?? 0) + 1);
  ts.forEachChild(n, walk);
};
walk(sf);
const edits = [];
for (const st of sf.statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause) continue;
  const c = st.importClause;
  const keepDefault = c.name && counts.get(c.name.text);
  let named = [];
  let ns = null;
  if (c.namedBindings && ts.isNamedImports(c.namedBindings)) {
    named = c.namedBindings.elements.filter((e) => counts.get(e.name.text));
  } else if (c.namedBindings && ts.isNamespaceImport(c.namedBindings)) {
    ns = counts.get(c.namedBindings.name.text) ? c.namedBindings : null;
  }
  const total =
    (c.namedBindings && ts.isNamedImports(c.namedBindings)
      ? c.namedBindings.elements.length
      : c.namedBindings
        ? 1
        : 0) + (c.name ? 1 : 0);
  const kept = named.length + (ns ? 1 : 0) + (keepDefault ? 1 : 0);
  if (kept === total) continue;
  const mod = st.moduleSpecifier.getText();
  if (kept === 0) {
    edits.push([st.getFullStart(), st.getEnd(), ""]);
    continue;
  }
  const parts = [];
  if (keepDefault) parts.push(c.name.text);
  if (ns) parts.push(`* as ${ns.name.text}`);
  if (named.length) parts.push(`{ ${named.map((e) => e.getText()).join(", ")} }`);
  edits.push([
    st.getStart(),
    st.getEnd(),
    `import ${c.isTypeOnly ? "type " : ""}${parts.join(", ")} from ${mod};`,
  ]);
}
let out = src;
for (const [s, e, r] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + r + out.slice(e);
fs.writeFileSync(file, out);
console.log(`pruned ${edits.length} import statements in ${file}`);
