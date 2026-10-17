export type SshErrorHint =
  | "dns"
  | "refused"
  | "timeout"
  | "unreachable"
  | "publicKey"
  | "password"
  | "hostKey"
  | "tooManyAttempts"
  | "connectionReset"
  | "sshpassMissing";

// author: BrianXiong
// time: 2026/10/18/01:00:00
// ssh reports failures as raw English stderr. Match the common causes so the UI
// can show an actionable hint instead of a bare message.
const MATCHERS: Array<{ hint: SshErrorHint; patterns: RegExp[] }> = [
  {
    hint: "hostKey",
    patterns: [/remote host identification has changed/, /host key verification failed/]
  },
  {
    hint: "dns",
    patterns: [/could not resolve hostname/, /name or service not known/, /nodename nor servname/, /temporary failure in name resolution/]
  },
  { hint: "refused", patterns: [/connection refused/] },
  { hint: "timeout", patterns: [/connection timed out/, /operation timed out/] },
  { hint: "unreachable", patterns: [/no route to host/, /network is unreachable/] },
  { hint: "publicKey", patterns: [/permission denied \(publickey/, /no supported authentication methods/] },
  { hint: "password", patterns: [/permission denied \(password/, /permission denied, please try again/] },
  { hint: "tooManyAttempts", patterns: [/too many authentication failures/] },
  { hint: "connectionReset", patterns: [/connection reset by peer/, /broken pipe/, /connection closed by remote host/] },
  { hint: "sshpassMissing", patterns: [/sshpass/] }
];

export function detectSshErrorHint(message: string): SshErrorHint | null {
  const value = message.toLowerCase();
  for (const entry of MATCHERS) {
    if (entry.patterns.some((pattern) => pattern.test(value))) {
      return entry.hint;
    }
  }

  return null;
}
