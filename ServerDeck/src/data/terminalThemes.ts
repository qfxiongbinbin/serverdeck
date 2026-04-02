export type TerminalThemePreset = {
  id: string;
  name: string;
  description: string;
  badge?: string;
  preview: {
    background: string;
    border: string;
    lines: [string, string, string];
  };
  theme: {
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent?: string;
    selectionBackground?: string;
    black?: string;
    red?: string;
    green?: string;
    yellow?: string;
    blue?: string;
    magenta?: string;
    cyan?: string;
    white?: string;
    brightBlack?: string;
    brightRed?: string;
    brightGreen?: string;
    brightYellow?: string;
    brightBlue?: string;
    brightMagenta?: string;
    brightCyan?: string;
    brightWhite?: string;
  };
};

export const terminalThemePresets: TerminalThemePreset[] = [
  {
    id: "termius-dark",
    name: "Termius Dark",
    description: "Balanced dark terminal inspired by modern SSH clients.",
    badge: "Built-in",
    preview: {
      background: "#151823",
      border: "#34c759",
      lines: ["#34c759", "#2fbf71", "#3fd286"]
    },
    theme: {
      background: "#0a0d14",
      foreground: "#4ae06a",
      cursor: "#5df27f",
      cursorAccent: "#0a0d14",
      selectionBackground: "#18321e",
      black: "#0a0d14",
      red: "#ff5f5f",
      green: "#4ae06a",
      yellow: "#d6de6f",
      blue: "#4da3ff",
      magenta: "#d17bff",
      cyan: "#52e0c4",
      white: "#b7ffc5",
      brightBlack: "#33503a",
      brightRed: "#ff8b8b",
      brightGreen: "#7cff9a",
      brightYellow: "#eef49b",
      brightBlue: "#7dc1ff",
      brightMagenta: "#e0a7ff",
      brightCyan: "#84ffe7",
      brightWhite: "#ecfff0"
    }
  },
  {
    id: "termius-light",
    name: "Termius Light",
    description: "High contrast light theme for daytime work.",
    badge: "Built-in",
    preview: {
      background: "#dfe6ee",
      border: "#74839b",
      lines: ["#353b4a", "#66758d", "#2f9e44"]
    },
    theme: {
      background: "#f7f9fc",
      foreground: "#263447",
      cursor: "#2160ff",
      selectionBackground: "#cfe0ff",
      black: "#3e4c61",
      red: "#d73a49",
      green: "#22863a",
      yellow: "#b08800",
      blue: "#005cc5",
      magenta: "#6f42c1",
      cyan: "#0b7285",
      white: "#edf2f7",
      brightBlack: "#6b7a90",
      brightRed: "#ef5366",
      brightGreen: "#2fb344",
      brightYellow: "#c99700",
      brightBlue: "#1e74ff",
      brightMagenta: "#8e63d2",
      brightCyan: "#1693a5",
      brightWhite: "#ffffff"
    }
  },
  {
    id: "flexoki-dark",
    name: "Flexoki Dark",
    description: "Warm dark palette based on the open Flexoki color system.",
    badge: "Open palette",
    preview: {
      background: "#1c1b1a",
      border: "#7a9e22",
      lines: ["#d7cab3", "#878580", "#7a9e22"]
    },
    theme: {
      background: "#100f0f",
      foreground: "#cecdc3",
      cursor: "#d7cab3",
      selectionBackground: "#282726",
      black: "#100f0f",
      red: "#d14d41",
      green: "#879a39",
      yellow: "#d0a215",
      blue: "#4385be",
      magenta: "#ce5d97",
      cyan: "#3aa99f",
      white: "#cecdc3",
      brightBlack: "#575653",
      brightRed: "#e76e5b",
      brightGreen: "#a0af54",
      brightYellow: "#d0a215",
      brightBlue: "#6f97c2",
      brightMagenta: "#d782b7",
      brightCyan: "#5abcb2",
      brightWhite: "#fffcf0"
    }
  },
  {
    id: "flexoki-light",
    name: "Flexoki Light",
    description: "Warm paper-like light palette based on Flexoki.",
    badge: "Open palette",
    preview: {
      background: "#fffaf0",
      border: "#879a39",
      lines: ["#282726", "#6f6e69", "#879a39"]
    },
    theme: {
      background: "#fffcf0",
      foreground: "#100f0f",
      cursor: "#100f0f",
      selectionBackground: "#e6e4d9",
      black: "#100f0f",
      red: "#af3029",
      green: "#66800b",
      yellow: "#ad8301",
      blue: "#205ea6",
      magenta: "#a02f6f",
      cyan: "#24837b",
      white: "#f2f0e5",
      brightBlack: "#6f6e69",
      brightRed: "#d14d41",
      brightGreen: "#879a39",
      brightYellow: "#d0a215",
      brightBlue: "#4385be",
      brightMagenta: "#ce5d97",
      brightCyan: "#3aa99f",
      brightWhite: "#ffffff"
    }
  },
  {
    id: "kanagawa-wave",
    name: "Kanagawa Wave",
    description: "Open-source Japanese inspired dark palette.",
    badge: "Open palette",
    preview: {
      background: "#1f1f28",
      border: "#76946a",
      lines: ["#dcd7ba", "#7e9cd8", "#98bb6c"]
    },
    theme: {
      background: "#1f1f28",
      foreground: "#dcd7ba",
      cursor: "#c8c093",
      selectionBackground: "#2d4f67",
      black: "#090618",
      red: "#c34043",
      green: "#76946a",
      yellow: "#c0a36e",
      blue: "#7e9cd8",
      magenta: "#957fb8",
      cyan: "#6a9589",
      white: "#c8c093",
      brightBlack: "#727169",
      brightRed: "#e82424",
      brightGreen: "#98bb6c",
      brightYellow: "#e6c384",
      brightBlue: "#7fb4ca",
      brightMagenta: "#938aa9",
      brightCyan: "#7aa89f",
      brightWhite: "#dcd7ba"
    }
  },
  {
    id: "kanagawa-lotus",
    name: "Kanagawa Lotus",
    description: "Soft light variant from the Kanagawa family.",
    badge: "Open palette",
    preview: {
      background: "#f2ecbc",
      border: "#6f894e",
      lines: ["#545464", "#7e9cd8", "#6f894e"]
    },
    theme: {
      background: "#f2ecbc",
      foreground: "#545464",
      cursor: "#43436c",
      selectionBackground: "#ddd8bb",
      black: "#1f1f28",
      red: "#c84053",
      green: "#6f894e",
      yellow: "#77713f",
      blue: "#4d699b",
      magenta: "#b35b79",
      cyan: "#597b75",
      white: "#545464",
      brightBlack: "#716e61",
      brightRed: "#d7474b",
      brightGreen: "#6e915f",
      brightYellow: "#836f4a",
      brightBlue: "#6693bf",
      brightMagenta: "#624c83",
      brightCyan: "#5e857a",
      brightWhite: "#43436c"
    }
  },
  {
    id: "hacker-blue",
    name: "Hacker Blue",
    description: "Classic neon-on-dark blue terminal look.",
    badge: "Built-in",
    preview: {
      background: "#05101f",
      border: "#2ea8ff",
      lines: ["#51b8ff", "#2ea8ff", "#6bc5ff"]
    },
    theme: {
      background: "#03111f",
      foreground: "#9ed8ff",
      cursor: "#41b6ff",
      selectionBackground: "#0f3658",
      black: "#03111f",
      red: "#ff6b81",
      green: "#3fe17d",
      yellow: "#ffd166",
      blue: "#2ea8ff",
      magenta: "#b87bff",
      cyan: "#59d4ff",
      white: "#d8f1ff",
      brightBlack: "#36516b",
      brightRed: "#ff8a9b",
      brightGreen: "#68f4a0",
      brightYellow: "#ffe08a",
      brightBlue: "#61c0ff",
      brightMagenta: "#c99bff",
      brightCyan: "#80e1ff",
      brightWhite: "#ffffff"
    }
  },
  {
    id: "hacker-green",
    name: "Hacker Green",
    description: "Retro green terminal with softer contrast.",
    badge: "Built-in",
    preview: {
      background: "#041006",
      border: "#35d04f",
      lines: ["#92f29d", "#35d04f", "#5de26a"]
    },
    theme: {
      background: "#031005",
      foreground: "#8fe388",
      cursor: "#4ef26c",
      selectionBackground: "#18361c",
      black: "#031005",
      red: "#ff6868",
      green: "#35d04f",
      yellow: "#a6e22e",
      blue: "#4aa3ff",
      magenta: "#c678dd",
      cyan: "#66d9ef",
      white: "#dfffe0",
      brightBlack: "#2d5c31",
      brightRed: "#ff8b8b",
      brightGreen: "#66f08b",
      brightYellow: "#c8f36a",
      brightBlue: "#7ec0ff",
      brightMagenta: "#d79bf0",
      brightCyan: "#8ae6ff",
      brightWhite: "#ffffff"
    }
  },
  {
    id: "everforest-dark",
    name: "Everforest Dark",
    description: "Popular community theme with calm earthy contrast.",
    badge: "Open palette",
    preview: {
      background: "#232a2e",
      border: "#a7c080",
      lines: ["#d3c6aa", "#7fbbb3", "#a7c080"]
    },
    theme: {
      background: "#2d353b",
      foreground: "#d3c6aa",
      cursor: "#a7c080",
      selectionBackground: "#4c5a63",
      black: "#475258",
      red: "#e67e80",
      green: "#a7c080",
      yellow: "#dbbc7f",
      blue: "#7fbbb3",
      magenta: "#d699b6",
      cyan: "#83c092",
      white: "#d3c6aa",
      brightBlack: "#859289",
      brightRed: "#f85552",
      brightGreen: "#8da101",
      brightYellow: "#dfa000",
      brightBlue: "#3a94c5",
      brightMagenta: "#df69ba",
      brightCyan: "#35a77c",
      brightWhite: "#fffbef"
    }
  }
];

export const defaultTerminalThemeId = terminalThemePresets[0].id;
