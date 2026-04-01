export type NavKey =
  | "hosts"
  | "keychain"
  | "forwarding"
  | "snippets"
  | "known-hosts"
  | "logs";

export type HostRecord = {
  id: string;
  label: string;
  address: string;
  protocol: "ssh";
  port: number;
  username: string;
  tags: string[];
  vault: string;
};

export const navItems = [
  { key: "hosts", label: "Hosts" },
  { key: "keychain", label: "Keychain" },
  { key: "forwarding", label: "Port Forwarding" },
  { key: "snippets", label: "Snippets" },
  { key: "known-hosts", label: "Known Hosts" },
  { key: "logs", label: "Logs" }
] as const;

export const hosts: HostRecord[] = [
  {
    id: "host-1",
    label: "Prod Gateway",
    address: "39.102.101.201",
    protocol: "ssh",
    port: 22,
    username: "root",
    tags: ["prod", "gateway"],
    vault: "Personal vault"
  },
  {
    id: "host-2",
    label: "App Server",
    address: "60.205.195.64",
    protocol: "ssh",
    port: 22,
    username: "root",
    tags: ["docker", "api"],
    vault: "Personal vault"
  }
];
