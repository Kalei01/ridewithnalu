// Mechanical "pure move" helper for splitting src/routes/index.tsx (docs/architecture/index-split.md).
//
// usage: node scripts/diag/split-extract.mjs <kind> <startLine> <endLine> <ComponentName> <targetFile> [--dry]
//   kind = statements : lines are whole statements INSIDE an `if (...) { ... }` block of Index();
//                       they become the body of <ComponentName>; the block is replaced by `return <ComponentName ... />;`
//   kind = jsx        : lines are whole JSX children (siblings) inside Index()'s returned JSX;
//                       they become `return (<>...</>)` of <ComponentName>; replaced by `<ComponentName ... />`
//
// Every variable the moved lines read from Index() becomes a prop of the same name (typed by the compiler),
// every import they use is copied across, and imports index.tsx no longer needs are removed.
// Nothing else is changed: no renames, no logic edits. Always run the gate afterwards.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const [kind, startArg, endArg, compName, target, flag] = process.argv.slice(2);
const startLine = Number(startArg);
const endLine = Number(endArg);
const dry = flag === "--dry";
const root = process.cwd();
const indexPath = path.join(root, "src/routes/index.tsx");

const cfgPath = path.join(root, "tsconfig.json");
const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root);
const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
const checker = program.getTypeChecker();
const sf = program.getSourceFile(indexPath);
if (!sf) throw new Error("index.tsx not in program");

const text = sf.getFullText();
const lines = text.split("\n");
const lineStart = (l) => sf.getPositionOfLineAndCharacter(l - 1, 0);
const rangeStart = lineStart(startLine);
const rangeEnd = lineStart(endLine + 1); // exclusive

// ---- find Index() ----
let indexFn;
sf.forEachChild((n) => {
  if (ts.isFunctionDeclaration(n) && n.name?.text === "Index") indexFn = n;
});
const bodyStart = indexFn.body.getStart();
const bodyEnd = indexFn.body.getEnd();
const inRange = (n) => n.getStart() >= rangeStart && n.getEnd() <= rangeEnd;
const inIndex = (n) => n.getStart() >= bodyStart && n.getEnd() <= bodyEnd;

const used = new Map(); // name -> symbol (outer Index() locals)
const importsUsed = new Map(); // name -> import specifier info
const moduleLevel = new Set(); // module-level non-import names used

function visit(n) {
  if (n.getEnd() <= rangeStart || n.getStart() >= rangeEnd) return;
  if (ts.isIdentifier(n)) {
    const parent = n.parent;
    // skip property names / attribute names / member access names
    if (ts.isPropertyAccessExpression(parent) && parent.name === n) return;
    if (ts.isPropertyAssignment(parent) && parent.name === n) return;
    if (ts.isJsxAttribute(parent) && parent.name === n) return;
    if (ts.isQualifiedName(parent) && parent.right === n) return;
    if (ts.isPropertySignature(parent) && parent.name === n) return;
    if (ts.isTypeReferenceNode(parent) || ts.isTypeQueryNode(parent) || true) {
      let sym;
      if (ts.isShorthandPropertyAssignment(parent) && parent.name === n)
        sym = checker.getShorthandAssignmentValueSymbol(parent);
      else sym = checker.getSymbolAtLocation(n);
      if (!sym) return;
      const decl = sym.declarations?.[0];
      if (!decl || decl.getSourceFile() !== sf) return;
      if (inRange(decl) && decl.getStart() >= rangeStart) return; // declared inside the moved lines
      if (ts.isImportSpecifier(decl) || ts.isImportClause(decl) || ts.isNamespaceImport(decl)) {
        importsUsed.set(n.text, decl);
        return;
      }
      if (inIndex(decl)) {
        if (ts.isTypeAliasDeclaration(decl) || ts.isInterfaceDeclaration(decl)) return;
        used.set(n.text, sym);
        return;
      }
      if (decl.parent === sf || decl.parent?.parent === sf || decl.parent?.parent?.parent === sf)
        moduleLevel.add(n.text);
    }
  }
  ts.forEachChild(n, visit);
}
visit(sf);

// ---- typing the props ----
const aliasFor = (s) =>
  s.replace(/import\("([^"]+)"\)/g, (m, p) => {
    const rel = p.startsWith("/") ? path.relative(path.join(root, "src"), p) : null;
    if (rel && !rel.startsWith("..")) return `import("@/${rel.replace(/\.(tsx?|jsx?)$/, "")}")`;
    return m;
  });
const fmt =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseFullyQualifiedType |
  ts.TypeFormatFlags.WriteArrowStyleSignature;
const props = [...used.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([name, sym]) => {
    const decl = sym.declarations[0];
    const t = checker.getTypeOfSymbolAtLocation(sym, decl);
    return { name, type: aliasFor(checker.typeToString(t, undefined, fmt)) };
  });

// ---- imports ----
const importLines = new Map(); // module -> {def, named:Set, ns}
for (const [name, decl] of importsUsed) {
  const imp =
    decl.parent?.parent?.parent && ts.isImportDeclaration(decl.parent.parent.parent)
      ? decl.parent.parent.parent
      : ts.isImportClause(decl)
        ? decl.parent
        : decl.parent.parent.parent;
  const mod = imp.moduleSpecifier.text;
  const e = importLines.get(mod) ?? {
    def: null,
    named: new Set(),
    ns: null,
    typeOnly: imp.importClause?.isTypeOnly,
  };
  if (ts.isImportClause(decl)) e.def = name;
  else if (ts.isNamespaceImport(decl)) e.ns = name;
  else {
    const orig = decl.propertyName
      ? `${decl.propertyName.text} as ${decl.name.text}`
      : decl.name.text;
    e.named.add((decl.isTypeOnly ? "type " : "") + orig);
  }
  importLines.set(mod, e);
}
const importText = [...importLines.entries()]
  .map(([mod, e]) => {
    const parts = [];
    if (e.def) parts.push(e.def);
    if (e.ns) parts.push(`* as ${e.ns}`);
    if (e.named.size) parts.push(`{ ${[...e.named].join(", ")} }`);
    return `import ${e.typeOnly ? "type " : ""}${parts.join(", ")} from "${mod}";`;
  })
  .join("\n");

// ---- body text ----
let body = lines.slice(startLine - 1, endLine).join("\n");
const propNames = props.map((p) => p.name);
const typeText = props.length
  ? `{\n${props.map((p) => `  ${p.name}: ${p.type};`).join("\n")}\n}`
  : "{}";
const destructure = propNames.length
  ? `  const {\n${propNames.map((n) => `    ${n},`).join("\n")}\n  } = props;\n`
  : "";
let componentText;
if (kind === "statements") {
  // dedent by 2 (statements lived inside `if (...) {` at 4 spaces; component body is at 2)
  const dedented = body
    .split("\n")
    .map((l) => (l.startsWith("  ") ? l.slice(2) : l))
    .join("\n");
  componentText = `export type ${compName}Props = ${typeText};\n\nexport function ${compName}(props: ${compName}Props) {\n${destructure}${dedented}\n}\n`;
} else {
  const indented = body
    .split("\n")
    .map((l) => (l.length ? l : l))
    .join("\n");
  componentText = `export type ${compName}Props = ${typeText};\n\nexport function ${compName}(props: ${compName}Props) {\n${destructure}  return (\n    <>\n${indented}\n    </>\n  );\n}\n`;
}
const fileText = `${importText}\n\n${componentText}`;

const callProps = propNames.map((n) => `${n}={${n}}`);
const indent = lines[startLine - 1].match(/^\s*/)[0];
const callText =
  kind === "statements"
    ? `${indent}return (\n${indent}  <${compName}\n${callProps.map((p) => `${indent}    ${p}`).join("\n")}\n${indent}  />\n${indent});`
    : `${indent}<${compName}\n${callProps.map((p) => `${indent}  ${p}`).join("\n")}\n${indent}/>`;

console.log(`props (${props.length}): ${propNames.join(", ")}`);
console.log(`imports used: ${[...importsUsed.keys()].join(", ")}`);
console.log(
  `module-level names used (must be exported/moved by hand): ${[...moduleLevel].join(", ") || "none"}`,
);
if (dry) process.exit(0);

fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
fs.writeFileSync(path.join(root, target), fileText);
const importLine = `import { ${compName} } from "@/${path.relative("src", target).replace(/\.tsx?$/, "")}";`;
const newLines = [importLine, ...lines.slice(0, startLine - 1), callText, ...lines.slice(endLine)];
fs.writeFileSync(indexPath, newLines.join("\n"));
console.log(`wrote ${target}; index.tsx now ${newLines.length} lines`);
