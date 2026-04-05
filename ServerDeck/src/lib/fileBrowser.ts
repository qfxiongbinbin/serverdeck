// author: BrianXiong
// time: 2026/04/05/12:19:04
export function formatFileSize(size: number) {
  if (size <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// author: BrianXiong
// time: 2026/04/05/12:19:04
export function formatModified(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).format(date);
}

// author: BrianXiong
// time: 2026/04/05/12:19:04
export function getParentPath(path: string) {
  const normalized = path.trim();
  if (!normalized || normalized === "/" || normalized === "~") {
    return normalized || "~";
  }

  if (normalized.endsWith(":\\") || normalized.endsWith(":/")) {
    return normalized;
  }

  const slashNormalized = normalized.replace(/\\/g, "/").replace(/\/$/, "");
  const segments = slashNormalized.split("/");
  segments.pop();

  if (segments.length === 1 && segments[0] === "") {
    return "/";
  }

  return segments.join("/") || "~";
}

// author: BrianXiong
// time: 2026/04/05/12:19:04
export function joinChildPath(basePath: string, name: string) {
  const trimmedBase = basePath.trim();
  if (!trimmedBase || trimmedBase === ".") {
    return name;
  }
  if (trimmedBase === "/") {
    return `/${name}`;
  }
  if (trimmedBase.endsWith("/")) {
    return `${trimmedBase}${name}`;
  }
  return `${trimmedBase}/${name}`;
}
