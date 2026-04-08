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

const SFTP_MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

// author: BrianXiong
// time: 2026/04/08/16:53:15
export function parseModifiedTimestamp(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);
  if (!Number.isNaN(numericValue)) {
    const timestamp = numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
    return Number.isNaN(new Date(timestamp).getTime()) ? null : timestamp;
  }

  const sftpMatch = trimmedValue.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4}|\d{1,2}:\d{2})$/);
  if (sftpMatch) {
    const [, monthLabel, dayValue, yearOrTime] = sftpMatch;
    const month = SFTP_MONTH_MAP[monthLabel.toLowerCase()];
    const day = Number(dayValue);

    if (month !== undefined && !Number.isNaN(day)) {
      if (yearOrTime.includes(":")) {
        const [hoursValue, minutesValue] = yearOrTime.split(":");
        const hours = Number(hoursValue);
        const minutes = Number(minutesValue);

        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
          const now = new Date();
          const candidate = new Date(now.getFullYear(), month, day, hours, minutes, 0, 0);
          if (candidate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
            candidate.setFullYear(candidate.getFullYear() - 1);
          }
          return candidate.getTime();
        }
      }

      const year = Number(yearOrTime);
      if (!Number.isNaN(year)) {
        return new Date(year, month, day, 0, 0, 0, 0).getTime();
      }
    }
  }

  const nativeTimestamp = new Date(trimmedValue).getTime();
  return Number.isNaN(nativeTimestamp) ? null : nativeTimestamp;
}

// author: BrianXiong
// time: 2026/04/05/12:19:04
export function formatModified(value: string) {
  if (!value) return "-";
  const timestamp = parseModifiedTimestamp(value);
  if (timestamp === null) return value;

  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).format(date);
}

// author: BrianXiong
// time: 2026/04/05/16:10:11
export function formatTimestamp(value: string) {
  if (!value) return "-";

  const numeric = Number(value);
  const date = Number.isNaN(numeric) ? new Date(value) : new Date(numeric * 1000);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
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
