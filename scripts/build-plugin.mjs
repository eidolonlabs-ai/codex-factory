import { build } from "esbuild";
import { zipSync, strToU8 } from "fflate";
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "plugins/codex-factory");
const args = process.argv.slice(2);
if (args.some((a) => !["--check", "--archive"].includes(a)))
  throw new Error("Usage: build-plugin.mjs [--check] [--archive]");
const files = new Map();
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => {
      if (e.isSymbolicLink())
        throw new Error(`Symlinks are not packaged: ${e.name}`);
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
}
for (const file of walk(join(root, "plugin-src")))
  files.set(
    relative(join(root, "plugin-src"), file),
    readFileSync(file, "utf8"),
  );
const manifest = JSON.parse(files.get("plugin.json"));
// Codex currently skips lifecycle hooks for portable AgentPlugin manifests.
// Ship only the native manifest; retain portable metadata as canonical input.
files.delete("plugin.json");
const presentation = manifest.extensions["com.openai"].interface;
if (
  manifest.name !== "codex-factory" ||
  !/^\d+\.\d+\.\d+$/.test(manifest.version) ||
  presentation.shortDescription.length > 30
)
  throw new Error("Invalid plugin identity/version/subtitle");
files.set(
  ".codex-plugin/plugin.json",
  json({
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    skills: "./skills/",
    hooks: manifest.extensions["com.openai"].hooks,
    interface: presentation,
  }),
);
const marketplace = json({
  name: "codex-factory",
  interface: { displayName: "Codex Factory" },
  plugins: [
    {
      name: manifest.name,
      source: { source: "local", path: "./plugins/codex-factory" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: presentation.category,
    },
  ],
});
const command = 'node "<PLUGIN_ROOT>/scripts/factory.mjs"';
const adapt = (text) => text.replaceAll("npm run factory --", command);
for (const name of readdirSync(join(root, ".agents/skills")).sort()) {
  let text = adapt(read(`.agents/skills/${name}/SKILL.md`));
  const end = text.indexOf("\n---", 4) + 4;
  if (end < 4) throw new Error(`Missing skill frontmatter: ${name}`);
  const note =
    '\n\nResolve <PLUGIN_ROOT> from this installed skill path (two directories above).\nRun commands with the target project as the working directory, or supply\n`--repo "<PROJECT_ROOT>"`; source/task/config arguments resolve from the caller\nworking directory. Use absolute paths when working elsewhere. Never assume the\nproject contains this plugin’s npm scripts or edit the plugin installation.\nUse installed skill names as exposed by the host, including namespaces.\nIf not adopted, use this plugin’s factory-setup skill first.\nRead `../../references/plugin.md` for runtime requirements and role fallback.\n';
  text = text.slice(0, end) + note + text.slice(end);
  text = text
    .replaceAll("docs/plugin.md", "../../references/plugin.md")
    .replaceAll("docs/hooks.md", "../../references/hooks.md")
    .replaceAll("docs/entry-paths.md", "../../references/entry-paths.md")
    .replaceAll("docs/orchestration.md", "../../references/orchestration.md")
    .replaceAll("docs/solo-workflow.md", "../../references/solo-workflow.md")
    .replaceAll(
      "docs/design-checklist.md",
      "../../references/design-checklist.md",
    )
    .replaceAll(
      "`docs/templates/desktop-task.md`",
      "`../../templates/desktop-task.md`",
    )
    .replaceAll(
      "`docs/builder-prompts.md`",
      "`../../references/builder-prompts.md`",
    )
    .replace(
      "Maintain `docs/development-state.md` using its template:",
      "Maintain the project’s `docs/factory/development-state.md` using `../../templates/development-state.md`:",
    );
  if (name === "factory-pipeline")
    text +=
      "\nUse `../../references/design-checklist.md` to identify applicable contract and acceptance work before parallel builders.\nWhen using a native architect/reviewer, supply the relevant skill text and\n`../../references/roles/<role>.toml` behavioral instructions directly if the\nproject role cannot access plugin skills. Do not assume bundled TOML is loaded.\n";
  if (name === "factory-intake")
    text +=
      "\nConsult `../../references/design-checklist.md` for applicable edge cases; do not turn it into a generic questionnaire.\n";
  if (name === "factory-build")
    text +=
      "\nFor bug fixes or review findings, use the reproduction procedure in `../../references/design-checklist.md`.\n";
  files.set(`skills/${name}/SKILL.md`, text);
}
for (const name of ["desktop-task", "development-state"])
  files.set(`templates/${name}.md`, adapt(read(`docs/templates/${name}.md`)));
files.set("templates/factory.json", read("plugin-src/templates/factory.json"));
files.set("templates/example-task.json", read("tasks/example.json"));
for (const name of ["acceptance-record", "config", "task", "result"])
  files.set(`schemas/${name}.schema.json`, read(`schemas/${name}.schema.json`));
for (const name of [
  "architect",
  "reviewer",
  "factory-architect",
  "factory-builder",
  "factory-reviewer",
])
  files.set(
    `references/roles/${name}.toml`,
    read(`.codex/agents/${name}.toml`),
  );
for (const name of [
  "builder-prompts",
  "security",
  "scaling",
  "design-checklist",
  "plugin",
  "execution-modes",
  "solo-policy",
  "solo-workflow",
  "entry-paths",
  "hooks",
  "orchestration",
])
  files.set(`references/${name}.md`, adapt(read(`docs/${name}.md`)));
files.set("LICENSE", read("LICENSE"));
files.set("README.md", read("docs/plugin.md"));
let notices = "# Bundled runtime dependency licenses\n\n";
for (const name of ["fflate", "saxes", "xmlchars"]) {
  const pkg = JSON.parse(read(`node_modules/${name}/package.json`));
  const license = readdirSync(join(root, "node_modules", name)).find((p) =>
    /^licen[sc]e(?:\.md|\.txt)?$/i.test(p),
  );
  const licenseText = license
    ? read(`node_modules/${name}/${license}`)
    : read(`plugin-src/licenses/${name}-${pkg.version}-LICENSE`);
  notices += `## ${name} ${pkg.version}\n\n${licenseText}\n\n`;
}
files.set("THIRD_PARTY_NOTICES.md", notices.trimEnd() + "\n");
const bundled = await build({
  absWorkingDir: root,
  entryPoints: ["factory/cli.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  write: false,
  legalComments: "inline",
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
});
files.set("runtime/cli.mjs", bundled.outputFiles[0].text);
const hookBundle = await build({
  absWorkingDir: root,
  entryPoints: ["factory/hook-entry.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  write: false,
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
});
files.set("runtime/hooks.mjs", hookBundle.outputFiles[0].text);
const names = [...files.keys()].filter((p) =>
  /^skills\/[^/]+\/SKILL.md$/.test(p),
);
if (names.length !== 8) throw new Error("Expected eight plugin skills");
for (const p of names) {
  const name = p.split("/")[1];
  if (!files.get(p).startsWith(`---\nname: ${name}\ndescription: `))
    throw new Error(`Invalid skill: ${p}`);
}
if (args.includes("--check")) {
  const stale = [];
  for (const [p, value] of files)
    if (
      !existsSync(join(output, p)) ||
      readFileSync(join(output, p), "utf8") !== value
    )
      stale.push(p);
  if (existsSync(output))
    for (const p of walk(output))
      if (!files.has(relative(output, p))) stale.push(relative(output, p));
  const catalog = join(root, ".agents/plugins/marketplace.json");
  if (!existsSync(catalog) || readFileSync(catalog, "utf8") !== marketplace)
    stale.push(".agents/plugins/marketplace.json");
  if (stale.length)
    throw new Error(
      `Generated plugin is stale; run npm run plugin:build:\n${stale.join("\n")}`,
    );
} else {
  rmSync(output, { recursive: true, force: true });
  for (const [p, value] of files) {
    mkdirSync(dirname(join(output, p)), { recursive: true });
    writeFileSync(join(output, p), value);
  }
  const catalog = join(root, ".agents/plugins/marketplace.json");
  if (!existsSync(catalog) || readFileSync(catalog, "utf8") !== marketplace) {
    mkdirSync(dirname(catalog), { recursive: true });
    writeFileSync(catalog, marketplace);
  }
}
if (args.includes("--archive")) {
  const entries = Object.fromEntries(
    [...files]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([p, v]) => [
        p,
        [strToU8(v), { mtime: new Date("2020-01-01T00:00:00Z") }],
      ]),
  );
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(
    join(root, `dist/codex-factory-${manifest.version}.zip`),
    zipSync(entries),
  );
}
console.log(
  `${args.includes("--check") ? "Verified" : "Generated"} ${files.size} plugin files, ${names.length} skills${args.includes("--archive") ? ", and source distribution ZIP" : ""}.`,
);
