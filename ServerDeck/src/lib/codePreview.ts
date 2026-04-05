export type CodeLanguage =
  | "javascript"
  | "typescript"
  | "json"
  | "python"
  | "shell"
  | "rust"
  | "go"
  | "java"
  | "c"
  | "cpp"
  | "yaml"
  | "html"
  | "css"
  | "sql"
  | "plaintext";

type CodePreviewMeta = {
  isCode: boolean;
  language: CodeLanguage;
};

const BRACE_LANGUAGES = new Set<CodeLanguage>([
  "javascript",
  "typescript",
  "rust",
  "go",
  "java",
  "c",
  "cpp",
  "css"
]);

const KEYWORDS_BY_LANGUAGE: Record<CodeLanguage, string[]> = {
  javascript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "switch", "case", "break", "continue", "try", "catch", "finally", "throw", "new", "class", "extends", "import", "from", "export", "default", "async", "await", "true", "false", "null", "undefined"],
  typescript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "switch", "case", "break", "continue", "try", "catch", "finally", "throw", "new", "class", "extends", "import", "from", "export", "default", "async", "await", "type", "interface", "implements", "enum", "public", "private", "protected", "readonly", "true", "false", "null", "undefined"],
  json: ["true", "false", "null"],
  python: ["def", "class", "return", "if", "elif", "else", "for", "while", "try", "except", "finally", "raise", "import", "from", "as", "with", "pass", "break", "continue", "lambda", "True", "False", "None"],
  shell: ["if", "then", "else", "fi", "for", "do", "done", "case", "esac", "function", "in", "while"],
  rust: ["fn", "let", "mut", "pub", "struct", "enum", "impl", "trait", "match", "if", "else", "loop", "while", "for", "in", "return", "use", "mod", "crate", "self", "Self", "true", "false", "None", "Some", "Ok", "Err"],
  go: ["func", "package", "import", "var", "const", "type", "struct", "interface", "return", "if", "else", "switch", "case", "for", "range", "go", "defer", "true", "false", "nil"],
  java: ["class", "interface", "public", "private", "protected", "static", "final", "return", "if", "else", "switch", "case", "break", "continue", "new", "import", "package", "void", "true", "false", "null"],
  c: ["int", "char", "float", "double", "void", "return", "if", "else", "switch", "case", "break", "continue", "for", "while", "struct", "typedef", "enum", "static", "const", "NULL"],
  cpp: ["int", "char", "float", "double", "void", "return", "if", "else", "switch", "case", "break", "continue", "for", "while", "struct", "typedef", "enum", "static", "const", "class", "namespace", "template", "public", "private", "protected", "nullptr", "true", "false"],
  yaml: ["true", "false", "null"],
  html: ["doctype"],
  css: ["display", "position", "color", "background", "font", "padding", "margin", "border", "grid", "flex"],
  sql: ["select", "from", "where", "group", "order", "by", "insert", "into", "update", "delete", "join", "left", "right", "inner", "outer", "on", "as", "and", "or", "not", "null", "create", "table", "values", "limit"],
  plaintext: []
};

// author: BrianXiong
// time: 2026/04/05/15:21:27
export function detectCodePreviewMeta(fileName: string): CodePreviewMeta {
  const lowerName = fileName.toLowerCase();
  const ext = lowerName.split(".").pop() ?? "";

  if (["js", "jsx", "mjs", "cjs"].includes(ext)) return { isCode: true, language: "javascript" };
  if (["ts", "tsx"].includes(ext)) return { isCode: true, language: "typescript" };
  if (ext === "json") return { isCode: true, language: "json" };
  if (ext === "py") return { isCode: true, language: "python" };
  if (["sh", "zsh", "bash"].includes(ext) || lowerName === ".zshrc" || lowerName === ".bashrc") return { isCode: true, language: "shell" };
  if (ext === "rs") return { isCode: true, language: "rust" };
  if (ext === "go") return { isCode: true, language: "go" };
  if (ext === "java") return { isCode: true, language: "java" };
  if (ext === "c") return { isCode: true, language: "c" };
  if (["cpp", "cc", "cxx", "hpp", "h"].includes(ext)) return { isCode: true, language: "cpp" };
  if (["yml", "yaml"].includes(ext)) return { isCode: true, language: "yaml" };
  if (["html", "xml", "svg"].includes(ext)) return { isCode: true, language: "html" };
  if (ext === "css") return { isCode: true, language: "css" };
  if (ext === "sql") return { isCode: true, language: "sql" };

  return { isCode: false, language: "plaintext" };
}

// author: BrianXiong
// time: 2026/04/05/15:21:27
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// author: BrianXiong
// time: 2026/04/05/15:21:27
function getKeywordPattern(language: CodeLanguage) {
  const keywords = KEYWORDS_BY_LANGUAGE[language];
  if (!keywords || keywords.length === 0) {
    return null;
  }
  return `\\b(?:${keywords.join("|")})\\b`;
}

// author: BrianXiong
// time: 2026/04/05/15:21:27
export function highlightCodeToHtml(source: string, language: CodeLanguage) {
  const keywordPattern = getKeywordPattern(language);
  const pattern = new RegExp(
    [
      "(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/.*$|#.*$)",
      '("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)',
      "(\\b\\d+(?:\\.\\d+)?\\b)",
      keywordPattern ? `(${keywordPattern})` : null
    ]
      .filter(Boolean)
      .join("|"),
    "gm"
  );
  let html = "";
  let cursor = 0;

  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    const raw = match[0];
    const plainText = source.slice(cursor, index);
    html += escapeHtml(plainText);

    if (raw.startsWith("//") || raw.startsWith("/*") || raw.startsWith("#")) {
      html += `<span class="code-token code-token--comment">${escapeHtml(raw)}</span>`;
    } else if (raw.startsWith('"') || raw.startsWith("'") || raw.startsWith("`")) {
      html += `<span class="code-token code-token--string">${escapeHtml(raw)}</span>`;
    } else if (/^\b\d/.test(raw)) {
      html += `<span class="code-token code-token--number">${escapeHtml(raw)}</span>`;
    } else {
      html += `<span class="code-token code-token--keyword">${escapeHtml(raw)}</span>`;
    }

    cursor = index + raw.length;
  }

  html += escapeHtml(source.slice(cursor));

  return html;
}

// author: BrianXiong
// time: 2026/04/05/15:21:27
function formatJson(source: string) {
  return JSON.stringify(JSON.parse(source), null, 2);
}

// author: BrianXiong
// time: 2026/04/05/15:21:27
function formatBraceLanguage(source: string) {
  const lines = source.split(/\r?\n/);
  let indentLevel = 0;

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return "";
      }

      if (/^[}\])]/.test(trimmed)) {
        indentLevel = Math.max(indentLevel - 1, 0);
      }

      const formatted = `${"  ".repeat(indentLevel)}${trimmed}`;

      if (/[{[(]$/.test(trimmed) && !/^[\/\/*#]/.test(trimmed)) {
        indentLevel += 1;
      }

      return formatted;
    })
    .join("\n");
}

// author: BrianXiong
// time: 2026/04/05/15:21:27
export function formatCodeText(source: string, language: CodeLanguage) {
  try {
    if (language === "json") {
      return formatJson(source);
    }

    if (BRACE_LANGUAGES.has(language)) {
      return formatBraceLanguage(source);
    }

    return source;
  } catch {
    return source;
  }
}
