import { convertFileSrc } from "@tauri-apps/api/core";

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

type MarkdownCodeBlock = {
  placeholder: string;
  html: string;
};

type MarkdownRenderContext = {
  baseFilePath?: string;
};

export type ResolvedMarkdownUrl = {
  url: string | null;
  localPath?: string;
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
// time: 2026/04/06/10:18:22
export function isMarkdownPreview(fileName: string, mimeType?: string) {
  const lowerName = fileName.toLowerCase();
  const ext = lowerName.split(".").pop() ?? "";
  return ["md", "markdown", "mdown", "mkd"].includes(ext) || mimeType === "text/markdown";
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
// time: 2026/04/06/10:18:22
function normalizeMarkdownCodeLanguage(language: string): CodeLanguage {
  const normalized = language.trim().toLowerCase();

  if (["js", "jsx", "mjs", "cjs", "node"].includes(normalized)) return "javascript";
  if (["ts", "tsx"].includes(normalized)) return "typescript";
  if (["json", "jsonc"].includes(normalized)) return "json";
  if (["py", "python"].includes(normalized)) return "python";
  if (["sh", "bash", "zsh", "shell"].includes(normalized)) return "shell";
  if (["rs", "rust"].includes(normalized)) return "rust";
  if (["go", "golang"].includes(normalized)) return "go";
  if (["java"].includes(normalized)) return "java";
  if (["c"].includes(normalized)) return "c";
  if (["cpp", "cc", "cxx", "hpp", "h"].includes(normalized)) return "cpp";
  if (["yml", "yaml"].includes(normalized)) return "yaml";
  if (["html", "xml", "svg"].includes(normalized)) return "html";
  if (["css"].includes(normalized)) return "css";
  if (["sql"].includes(normalized)) return "sql";

  return "plaintext";
}

// author: BrianXiong
// time: 2026/04/06/10:18:22
function getParentDir(filePath?: string) {
  if (!filePath) {
    return "";
  }

  const normalized = filePath.replace(/\\/g, "/");
  const lastSlashIndex = normalized.lastIndexOf("/");
  return lastSlashIndex >= 0 ? normalized.slice(0, lastSlashIndex) : "";
}

function joinRelativePath(baseDir: string, relativePath: string) {
  const segments = `${baseDir}/${relativePath}`.split("/");
  const resolved: string[] = [];

  segments.forEach((segment) => {
    if (!segment || segment === ".") {
      return;
    }

    if (segment === "..") {
      resolved.pop();
      return;
    }

    resolved.push(segment);
  });

  return `${baseDir.startsWith("/") ? "/" : ""}${resolved.join("/")}`;
}

function toFileUrl(path: string) {
  const normalized = path.replace(/\\/g, "/");

  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    return convertFileSrc(normalized);
  }

  return `file://${encodeURI(normalized)}`;
}

export function resolveMarkdownUrl(url: string, context?: MarkdownRenderContext): ResolvedMarkdownUrl {
  const trimmed = url.trim();
  if (!trimmed) {
    return { url: null };
  }

  if (/^(https?:|mailto:|#)/i.test(trimmed)) {
    return { url: trimmed };
  }

  if (trimmed.startsWith("/")) {
    return { url: toFileUrl(trimmed), localPath: trimmed };
  }

  if (["./", "../"].some((prefix) => trimmed.startsWith(prefix)) || !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
    const baseDir = getParentDir(context?.baseFilePath);
    const localPath = baseDir ? joinRelativePath(baseDir, trimmed) : trimmed;
    return { url: baseDir ? toFileUrl(localPath) : trimmed, localPath: baseDir ? localPath : undefined };
  }

  return { url: null };
}

function sanitizeMarkdownUrl(url: string, context?: MarkdownRenderContext) {
  return resolveMarkdownUrl(url, context).url;
}

// author: BrianXiong
// time: 2026/04/06/10:30:41
function sanitizeInlineHtml(html: string, context?: MarkdownRenderContext) {
  if (/<script|onerror=|onload=|javascript:/i.test(html)) {
    return escapeHtml(html);
  }

  return html
    .replace(/(src|href)="([^"]+)"/gi, (_match, attr: string, value: string) => {
      const resolved = resolveMarkdownUrl(value, context);
      if (!resolved.url) {
        return `${attr}="${escapeHtml(value)}"`;
      }

      const localPathAttr = attr.toLowerCase() === "src" && resolved.localPath ? ` data-local-path="${escapeHtml(resolved.localPath)}"` : "";
      return `${attr}="${escapeHtml(resolved.url)}"${localPathAttr}`;
    })
    .replace(/(src|href)='([^']+)'/gi, (_match, attr: string, value: string) => {
      const resolved = resolveMarkdownUrl(value, context);
      if (!resolved.url) {
        return `${attr}='${escapeHtml(value)}'`;
      }

      const localPathAttr = attr.toLowerCase() === "src" && resolved.localPath ? ` data-local-path='${escapeHtml(resolved.localPath)}'` : "";
      return `${attr}='${escapeHtml(resolved.url)}'${localPathAttr}`;
    });
}

// author: BrianXiong
// time: 2026/04/06/10:48:33
function applyInlineMarkdownWithoutCode(text: string, context?: MarkdownRenderContext) {
  let html = escapeHtml(text);

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, url: string) => {
    const resolved = resolveMarkdownUrl(url, context);
    if (!resolved.url) {
      return escapeHtml(alt);
    }
    const localPathAttr = resolved.localPath ? ` data-local-path="${escapeHtml(resolved.localPath)}"` : "";
    return `<img src="${escapeHtml(resolved.url)}" alt="${escapeHtml(alt)}"${localPathAttr} />`;
  });

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
    const safeUrl = sanitizeMarkdownUrl(url, context);
    if (!safeUrl) {
      return `${escapeHtml(label)} (${escapeHtml(url)})`;
    }
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
  });

  return html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
}

// author: BrianXiong
// time: 2026/04/06/10:48:33
function applyInlineMarkdown(text: string, context?: MarkdownRenderContext) {
  return text
    .split(/(`[^`]+`)/g)
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }

      return applyInlineMarkdownWithoutCode(part, context);
    })
    .join("");
}

// author: BrianXiong
// time: 2026/04/06/10:18:22
function renderMarkdownParagraph(lines: string[], context?: MarkdownRenderContext) {
  return `<p>${applyInlineMarkdown(lines.join(" "), context)}</p>`;
}

// author: BrianXiong
// time: 2026/04/06/10:30:41
function renderRawHtmlBlock(lines: string[], context?: MarkdownRenderContext) {
  return sanitizeInlineHtml(lines.join("\n"), context);
}

// author: BrianXiong
// time: 2026/04/06/10:18:22
function renderMarkdownList(lines: string[], ordered: boolean, context?: MarkdownRenderContext) {
  const tag = ordered ? "ol" : "ul";
  const items = lines
    .map((line) => line.replace(ordered ? /^\d+\.\s+/ : /^[-*+]\s+/, ""))
    .map((line) => `<li>${applyInlineMarkdown(line, context)}</li>`)
    .join("");
  return `<${tag}>${items}</${tag}>`;
}

// author: BrianXiong
// time: 2026/04/06/10:18:22
function renderMarkdownBlockquote(lines: string[], context?: MarkdownRenderContext) {
  const content = lines
    .map((line) => line.replace(/^>\s?/, ""))
    .map((line) => applyInlineMarkdown(line, context))
    .join("<br />");
  return `<blockquote>${content}</blockquote>`;
}

// author: BrianXiong
// time: 2026/04/06/10:18:22
function extractMarkdownCodeBlocks(source: string) {
  const blocks: MarkdownCodeBlock[] = [];
  const text = source.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_match, language: string, code: string) => {
    const placeholder = `__MARKDOWN_CODE_BLOCK_${blocks.length}__`;
    const normalizedLanguage = normalizeMarkdownCodeLanguage(language);
    const codeHtml = normalizedLanguage === "plaintext"
      ? escapeHtml(code.trimEnd())
      : highlightCodeToHtml(code.trimEnd(), normalizedLanguage);

    blocks.push({
      placeholder,
      html: `<pre class="local-preview-pane__text local-preview-pane__text--code local-preview-pane__markdown-code"><code>${codeHtml}</code></pre>`
    });
    return placeholder;
  });

  return { text, blocks };
}

// author: BrianXiong
// time: 2026/04/06/10:18:22
export function renderMarkdownToHtml(source: string, baseFilePath?: string) {
  const context = { baseFilePath };
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const { text, blocks } = extractMarkdownCodeBlocks(normalizedSource);
  const lines = text.split("\n");
  const htmlBlocks: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trimEnd();
    const codeBlock = blocks.find((block) => block.placeholder === line.trim());

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (codeBlock) {
      htmlBlocks.push(codeBlock.html);
      index += 1;
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const content = line.replace(/^#{1,6}\s+/, "");
      htmlBlocks.push(`<h${level}>${applyInlineMarkdown(content, context)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      htmlBlocks.push("<hr />");
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line.trim())) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim());
        index += 1;
      }
      htmlBlocks.push(renderMarkdownBlockquote(quoteLines, context));
      continue;
    }

    if (/^<[^>]+>/.test(line.trim())) {
      const htmlLines: string[] = [];
      while (index < lines.length && lines[index].trim()) {
        const current = lines[index].trim();
        const isMarkdownBoundary = /^#{1,6}\s+/.test(current) || /^[-*+]\s+/.test(current) || /^\d+\.\s+/.test(current) || /^>\s?/.test(current);
        if (isMarkdownBoundary) {
          break;
        }
        htmlLines.push(lines[index]);
        index += 1;
      }
      htmlBlocks.push(renderRawHtmlBlock(htmlLines, context));
      continue;
    }

    if (/^[-*+]\s+/.test(line.trim())) {
      const listLines: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        listLines.push(lines[index].trim());
        index += 1;
      }
      htmlBlocks.push(renderMarkdownList(listLines, false, context));
      continue;
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const listLines: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        listLines.push(lines[index].trim());
        index += 1;
      }
      htmlBlocks.push(renderMarkdownList(listLines, true, context));
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const currentLine = lines[index].trim();
      const isCodeBlock = blocks.some((block) => block.placeholder === currentLine);
      if (!currentLine || isCodeBlock || /^#{1,6}\s+/.test(currentLine) || /^(-{3,}|\*{3,}|_{3,})$/.test(currentLine) || /^>\s?/.test(currentLine) || /^[-*+]\s+/.test(currentLine) || /^\d+\.\s+/.test(currentLine)) {
        break;
      }
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    if (paragraphLines.length > 0) {
      htmlBlocks.push(renderMarkdownParagraph(paragraphLines, context));
      continue;
    }

    index += 1;
  }

  return htmlBlocks.join("");
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
