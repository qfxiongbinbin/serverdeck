export type AppLanguage = "en" | "zh" | "ja";

export const languageOptions: Array<{ label: string; value: AppLanguage }> = [
  { label: "English", value: "en" },
  { label: "中文", value: "zh" },
  { label: "日本語", value: "ja" }
];

type Messages = {
  light: string;
  dark: string;
  untitledHost: string;
  ready: string;
  refresh: string;
  up: string;
  loading: string;
  updaterDesktopOnly: string;
  checkingForUpdates: string;
  updateAvailableStatus: (version: string) => string;
  latestVersion: string;
  updateCheckFailed: string;
  failedLoadLocalDirectory: string;
  failedLoadRemoteDirectory: string;
  connected: string;
  failedSubscribeTerminalEvents: string;
  downloadUpdateStatus: (version: string) => string;
  updateReadyStatus: (version: string) => string;
  updateDownloadFailed: string;
  restartingToApplyUpdate: string;
  restartFailed: string;
  clearDataSuccess: string;
  clearDataFailed: string;
  appliedTerminalTheme: (themeName: string) => string;
  appliedAppTheme: (themeName: string) => string;
  appliedLanguage: (languageName: string) => string;
  appliedTerminalFontSize: (fontSize: number) => string;
  appliedTerminalCharset: (charset: string) => string;
  uploadingTo: (path: string) => string;
  uploaded: (name: string) => string;
  uploadedTo: (path: string) => string;
  uploadCancelled: (name: string) => string;
  uploadFailed: (name: string) => string;
  downloadingTo: (path: string) => string;
  downloaded: (name: string) => string;
  downloadedTo: (path: string) => string;
  downloadFailed: (name: string) => string;
  deletedLocal: (name: string) => string;
  deletedRemote: (name: string) => string;
  addressRequired: string;
  savedHost: (name: string) => string;
  saveFailed: string;
  deletedHost: (name: string) => string;
  deleteFailed: string;
  removedHost: (name: string) => string;
  removeFailed: string;
  hostCopySuffix: string;
  duplicatedHost: (name: string) => string;
  duplicateFailed: string;
  copiedLink: (name: string) => string;
  copyLinkFailed: string;
  notWiredYet: (label: string) => string;
  selectOrFillHostFirst: string;
  testingHost: (username: string, address: string, port: number) => string;
  connectionTestFailed: string;
  passwordRequired: string;
  keyPathRequired: string;
  connectingToHost: (username: string, address: string, port: number) => string;
  terminalSessionOpened: (username: string, address: string) => string;
  terminalOpenFailed: string;
  closedTerminalTab: (title: string) => string;
  monitor: string;
  forwards: string;
  forwardsDescription: string;
  newForward: string;
  editForward: string;
  forwardLabel: string;
  forwardKind: string;
  forwardKindLocal: string;
  forwardKindRemote: string;
  forwardKindDynamic: string;
  forwardHost: string;
  forwardBindHost: string;
  forwardBindPort: string;
  forwardTargetHost: string;
  forwardTargetPort: string;
  forwardAutoStart: string;
  forwardAutoStartDescription: string;
  forwardStart: string;
  forwardStop: string;
  forwardsEmpty: string;
  forwardsEmptyDescription: string;
  forwardsHostMissing: string;
  forwardsLoadFailed: string;
  forwardsSaved: string;
  forwardsSaveFailed: string;
  forwardsStarted: (name: string) => string;
  forwardsStopped: (name: string) => string;
  forwardsToggleFailed: string;
  forwardsDeleted: string;
  forwardsConfirmDelete: string;
  sshConfig: string;
  sshConfigDescription: string;
  sshConfigFile: string;
  sshConfigMissing: string;
  sshConfigEmpty: string;
  sshConfigSelectAll: string;
  sshConfigClearAll: string;
  sshConfigImport: string;
  sshConfigStateNew: string;
  sshConfigStateUpdated: string;
  sshConfigStateUnchanged: string;
  sshConfigViaJump: string;
  sshConfigNoSelection: string;
  sshConfigLoadFailed: string;
  sshConfigImported: (imported: number, updated: number) => string;
  sshConfigImportFailed: string;
  sshSettings: string;
  sshSettingsDescription: string;
  knownHosts: string;
  knownHostsDescription: string;
  knownHostsEmpty: string;
  knownHostsRefresh: string;
  knownHostsRemoved: (host: string) => string;
  knownHostsLoadFailed: string;
  knownHostsRemoveFailed: string;
  sshErrorDns: string;
  sshErrorRefused: string;
  sshErrorTimeout: string;
  sshErrorUnreachable: string;
  sshErrorPublicKey: string;
  sshErrorPassword: string;
  sshErrorHostKey: string;
  sshErrorTooManyAttempts: string;
  sshErrorConnectionReset: string;
  sshErrorSshpassMissing: string;
  sshKeys: string;
  sshKeysDescription: string;
  sshKeysEmpty: string;
  sshKeyGenerate: string;
  sshKeyGenerated: (name: string) => string;
  sshKeyGenerateFailed: string;
  sshKeyNamePlaceholder: string;
  sshKeyCommentPlaceholder: string;
  sshKeyCopyPublic: string;
  sshKeyCopied: (name: string) => string;
  sshKeyCopyFailed: string;
  sshKeyLoadFailed: string;
  snippets: string;
  snippetsDescription: string;
  newSnippet: string;
  editSnippet: string;
  snippetName: string;
  snippetContent: string;
  snippetContentPlaceholder: string;
  snippetHost: string;
  snippetAnyHost: string;
  snippetDangerous: string;
  snippetDangerousHint: string;
  snippetVariables: string;
  snippetRun: string;
  snippetPaste: string;
  snippetPasteHint: string;
  snippetEmpty: string;
  snippetEmptyDescription: string;
  snippetConfirmDelete: string;
  snippetConfirmRun: string;
  snippetSaved: string;
  snippetSaveFailed: string;
  snippetDeleted: string;
  snippetDeleteFailed: string;
  snippetNoTerminal: string;
  snippetSent: (name: string) => string;
  tmuxPersistence: string;
  tmuxPersistenceDescription: string;
  monitorDescription: string;
  monitorLoading: string;
  monitorLoadingDescription: string;
  monitorLoadFailed: string;
  openingMonitor: (name: string) => string;
  refreshingMonitor: (name: string) => string;
  monitorLoaded: (name: string) => string;
  closedMonitorTab: (title: string) => string;
  monitorHostname: string;
  monitorOperatingSystem: string;
  monitorUptime: string;
  monitorLoad: string;
  monitorCpuCores: string;
  monitorCpuUsage: string;
  monitorMemory: string;
  monitorMemoryPercent: string;
  monitorDisk: string;
  monitorDiskPercent: string;
  monitorNetwork: string;
  monitorTopProcesses: string;
  monitorNoProcesses: string;
  monitorPid: string;
  topFive: string;
  topTen: string;
  monitorUpdatedAt: string;
  refreshing: string;
  autoRefresh: string;
  serverInfo: string;
  monitorInfoCopied: string;
  copied: string;
  copyServerInfo: string;
  home: string;
  homeDescription: string;
  hosts: string;
  sftp: string;
  newTab: string;
  localTerminal: string;
  openingLocalTerminal: string;
  localTerminalOpened: string;
  localTerminalDefaultPath: string;
  localTerminalDefaultPathDescription: string;
  localTerminalDefaultPathPlaceholder: string;
  localTerminalPathSaved: string;
  localFiles: string;
  preview: string;
  openPreview: string;
  hidePreview: string;
  previewEmpty: string;
  previewLoading: string;
  previewUnsupported: string;
  previewTruncated: string;
  archiveEntries: string;
  failedLoadLocalPreview: string;
  formatCode: string;
  renderMarkdown: string;
  showRaw: string;
  fileNameColumn: string;
  fileModifiedDateColumn: string;
  fileSizeColumn: string;
  fileKindColumn: string;
  fileAddedDateColumn: string;
  folderKind: string;
  fileKindFallback: string;
  homeDirectory: string;
  chooseDirectory: string;
  projectPathPickFailed: string;
  recentProjects: string;
  openDefaultDirectory: string;
  noProjectPaths: string;
  searchProjectsPlaceholder: string;
  update: string;
  settings: string;
  searchPlaceholder: string;
  new: string;
  hostCount: (count: number) => string;
  edit: string;
  connect: string;
  noHostsFound: string;
  noHostsHint: string;
  defaultProject: string;
  backToProjects: string;
  openProject: string;
  addHost: string;
  noHostsInProject: string;
  noHostsInProjectDescription: string;
  createHost: string;
  newHost: string;
  editHost: string;
  createServerProfile: string;
  label: string;
  address: string;
  port: string;
  username: string;
  authType: string;
  authPassword: string;
  authKey: string;
  jumpHost: string;
  jumpHostNone: string;
  jumpHostVia: (name: string) => string;
  password: string;
  passwordStoredPlaceholder: string;
  privateKeyPath: string;
  working: string;
  testSsh: string;
  save: string;
  delete: string;
  confirmDeleteTitle: string;
  confirmDeleteLocalMessage: (path: string) => string;
  confirmDeleteRemoteMessage: (path: string) => string;
  deleteEntryFailed: (name: string) => string;
  disconnected: string;
  reconnect: string;
  sessionDisconnected: string;
  reconnecting: string;
  terminalSearchPlaceholder: string;
  showHiddenFiles: string;
  sftpDescription: string;
  sftpWelcomeTitle: string;
  sftpWelcomeDescription: string;
  sftpBackToServers: string;
  selectHost: string;
  selectHostPlaceholder: string;
  local: string;
  remote: string;
  noLocalFiles: string;
  noRemoteFiles: string;
  transfers: string;
  transferCount: (count: number) => string;
  transferUpload: string;
  transferDownload: string;
  clearTransfer: string;
  settingsDescription: string;
  general: string;
  projects: string;
  projectsDescription: string;
  addProject: string;
  noProjects: string;
  noProjectsDescription: string;
  projectName: string;
  projectNameDescription: string;
  projectNamespace: string;
  projectNamespaceDescription: string;
  projectPath: string;
  projectPathDescription: string;
  projectType: string;
  projectTypeDescription: string;
  localProject: string;
  serverProject: string;
  hybridProject: string;
  newProject: string;
  editProject: string;
  saveProject: string;
  projectNameRequired: string;
  projectAdded: (name: string) => string;
  projectUpdated: (name: string) => string;
  projectRemoved: (name: string) => string;
  cancel: string;
  appTheme: string;
  appThemeDescription: string;
  language: string;
  languageDescription: string;
  connection: string;
  sshDefaults: string;
  sshDefaultsDescription: string;
  sshConnectTimeout: string;
  sshConnectTimeoutDescription: string;
  sshKeepaliveInterval: string;
  sshKeepaliveIntervalDescription: string;
  secondsValue: (value: number) => string;
  appliedSshDefaults: (connectTimeout: number, keepaliveInterval: number) => string;
  terminal: string;
  terminalDescription: string;
  terminalFontSize: string;
  terminalFontSizeDescription: string;
  terminalCharset: string;
  terminalCharsetDescription: string;
  terminalTheme: string;
  selected: string;
  select: string;
  about: string;
  appDescription: string;
  softwareUpdate: string;
  softwareUpdateAvailable: (version: string) => string;
  softwareUpdateChecking: string;
  softwareUpdateDefault: string;
  viewUpdate: string;
  checkNow: string;
  dangerZone: string;
  clearLocalData: string;
  clearLocalDataDescription: string;
  clearing: string;
  clearData: string;
  quickConnect: string;
  commandPalettePlaceholder: string;
  commandPaletteNoResults: string;
  commandPaletteRecent: string;
  commandPaletteHosts: string;
  commandPaletteActions: string;
  commandPaletteQuickConnect: string;
  commandPaletteTemporary: string;
  commandPaletteOpenSftp: string;
  commandPaletteTestConnection: string;
  commandPaletteEditHost: string;
  commandPaletteFooter: string;
  editHostDetails: string;
  collaborate: string;
  moveTo: string;
  copyTo: string;
  duplicate: string;
  copyLink: string;
  remove: string;
  upload: string;
  download: string;
  updateAvailable: string;
  currentVersionToNewVersion: (currentVersion: string, nextVersion: string) => string;
  updateSummary: string;
  whatsNew: string;
  noReleaseNotes: string;
  status: string;
  updateInstalledRestart: string;
  downloadingAndInstalling: string;
  readyToDownloadUpdate: string;
  preparingDownload: string;
  later: string;
  downloading: string;
  downloadedState: string;
  restart: string;
};

export const messagesByLanguage: Record<AppLanguage, Messages> = {
  en: {
    light: "Light",
    dark: "Dark",
    untitledHost: "Untitled Host",
    ready: "Ready",
    refresh: "Refresh",
    up: "Up",
    loading: "Loading...",
    updaterDesktopOnly: "Updater is only available in the desktop app.",
    checkingForUpdates: "Checking for updates...",
    updateAvailableStatus: (version) => `Update ${version} is available`,
    latestVersion: "You are already on the latest version.",
    updateCheckFailed: "Update check failed",
    failedLoadLocalDirectory: "Failed to load local directory",
    failedLoadRemoteDirectory: "Failed to load remote directory",
    connected: "Connected",
    failedSubscribeTerminalEvents: "Failed to subscribe terminal output events",
    downloadUpdateStatus: (version) => `Downloading update ${version}...`,
    updateReadyStatus: (version) => `Update ${version} is ready to restart`,
    updateDownloadFailed: "Update download failed",
    restartingToApplyUpdate: "Restarting to apply update...",
    restartFailed: "Restart failed",
    clearDataSuccess: "Cleared local app data",
    clearDataFailed: "Clear data failed",
    appliedTerminalTheme: (themeName) => `Applied terminal theme ${themeName}`,
    appliedAppTheme: (themeName) => `Applied ${themeName} app theme`,
    appliedLanguage: (languageName) => `Language switched to ${languageName}`,
    appliedTerminalFontSize: (fontSize) => `Applied terminal font size ${fontSize}px`,
    appliedTerminalCharset: (charset) => `Applied terminal charset ${charset}`,
    uploadingTo: (path) => `Uploading to ${path}`,
    uploaded: (name) => `Uploaded ${name}`,
    uploadedTo: (path) => `Uploaded to ${path}`,
    uploadCancelled: (name) => `Cancelled upload for ${name}`,
    uploadFailed: (name) => `Upload failed for ${name}`,
    downloadingTo: (path) => `Downloading to ${path}`,
    downloaded: (name) => `Downloaded ${name}`,
    downloadedTo: (path) => `Downloaded to ${path}`,
    downloadFailed: (name) => `Download failed for ${name}`,
    deletedLocal: (name) => `Deleted local ${name}`,
    deletedRemote: (name) => `Deleted remote ${name}`,
    addressRequired: "Address is required",
    savedHost: (name) => `Saved host ${name}`,
    saveFailed: "Save failed",
    deletedHost: (name) => `Deleted host ${name}`,
    deleteFailed: "Delete failed",
    removedHost: (name) => `Removed host ${name}`,
    removeFailed: "Remove failed",
    hostCopySuffix: "Copy",
    duplicatedHost: (name) => `Duplicated host ${name}`,
    duplicateFailed: "Duplicate failed",
    copiedLink: (name) => `Copied link for ${name}`,
    copyLinkFailed: "Copy link failed",
    notWiredYet: (label) => `${label} is not wired yet`,
    selectOrFillHostFirst: "Select or fill a host first",
    testingHost: (username, address, port) => `Testing ${username}@${address}:${port} ...`,
    connectionTestFailed: "Connection test failed",
    passwordRequired: "Password auth requires a password",
    keyPathRequired: "Key auth requires a private key path",
    connectingToHost: (username, address, port) => `Connecting to ${username}@${address}:${port}...`,
    terminalSessionOpened: (username, address) => `Terminal session opened for ${username}@${address}`,
    terminalOpenFailed: "Terminal open failed",
    closedTerminalTab: (title) => `Closed terminal tab ${title}`,
    monitor: "Monitor",
    forwards: "Port Forwards",
    forwardsDescription: "Reusable tunnels that reach remote services from this Mac.",
    newForward: "New forward",
    editForward: "Edit forward",
    forwardLabel: "Name",
    forwardKind: "Type",
    forwardKindLocal: "Local (-L)",
    forwardKindRemote: "Remote (-R)",
    forwardKindDynamic: "Dynamic SOCKS (-D)",
    forwardHost: "Through host",
    forwardBindHost: "Bind address",
    forwardBindPort: "Bind port",
    forwardTargetHost: "Target host",
    forwardTargetPort: "Target port",
    forwardAutoStart: "Auto start",
    forwardAutoStartDescription: "Open this tunnel when ServerDeck launches.",
    forwardStart: "Start",
    forwardStop: "Stop",
    forwardsEmpty: "No port forwards yet",
    forwardsEmptyDescription: "Create a tunnel to reach a remote database, web UI, or anything else behind a firewall.",
    forwardsHostMissing: "Host missing",
    forwardsLoadFailed: "Failed to load port forwards",
    forwardsSaved: "Port forward saved",
    forwardsSaveFailed: "Failed to save port forward",
    forwardsStarted: (name: string) => `Tunnel started: ${name}`,
    forwardsStopped: (name: string) => `Tunnel stopped: ${name}`,
    forwardsToggleFailed: "Failed to toggle tunnel",
    forwardsDeleted: "Port forward deleted",
    forwardsConfirmDelete: "Confirm delete",
    sshConfig: "SSH Config",
    sshConfigDescription: "Sync hosts from ~/.ssh/config. It stays a live source, so later edits can be synced again.",
    sshConfigFile: "File",
    sshConfigMissing: "~/.ssh/config was not found on this Mac.",
    sshConfigEmpty: "No concrete hosts found in ~/.ssh/config.",
    sshConfigSelectAll: "Select all",
    sshConfigClearAll: "Clear",
    sshConfigImport: "Import / sync",
    sshConfigStateNew: "New",
    sshConfigStateUpdated: "Changed",
    sshConfigStateUnchanged: "Unchanged",
    sshConfigViaJump: "via",
    sshConfigNoSelection: "Nothing selected",
    sshConfigLoadFailed: "Failed to read ~/.ssh/config",
    sshConfigImported: (imported: number, updated: number) => `Imported ${imported} hosts, updated ${updated}`,
    sshConfigImportFailed: "Failed to import ~/.ssh/config",
    sshSettings: "SSH & Known Hosts",
    sshSettingsDescription: "Host key trust and connection troubleshooting.",
    knownHosts: "Known Hosts",
    knownHostsDescription: "Servers whose host keys have been accepted on this Mac.",
    knownHostsEmpty: "No known hosts recorded yet",
    knownHostsRefresh: "Refresh",
    knownHostsRemoved: (host: string) => `Removed ${host} from known_hosts`,
    knownHostsLoadFailed: "Failed to read known_hosts",
    knownHostsRemoveFailed: "Failed to remove the known host",
    sshErrorDns: "Host name cannot be resolved — check the address or DNS",
    sshErrorRefused: "Connection refused — is sshd running on that port?",
    sshErrorTimeout: "Connection timed out — unreachable network or firewall",
    sshErrorUnreachable: "No route to host — the network cannot reach this address",
    sshErrorPublicKey: "Public key rejected — check the key and authorized_keys",
    sshErrorPassword: "Password rejected — re-enter it in the host settings",
    sshErrorHostKey: "Host key changed or unverified — verify the fingerprint before trusting it",
    sshErrorTooManyAttempts: "Too many authentication attempts — narrow the keys ssh offers",
    sshErrorConnectionReset: "Connection reset by the remote side",
    sshErrorSshpassMissing: "sshpass is missing on this Mac — install it or switch to key auth",
    sshKeys: "SSH Keys",
    sshKeysDescription: "Keys found in ~/.ssh. Pick one in a host instead of typing a path, and generate new ed25519 keys without a passphrase.",
    sshKeysEmpty: "No SSH keys found in ~/.ssh",
    sshKeyGenerate: "Generate",
    sshKeyGenerated: (name: string) => `Generated key ${name}`,
    sshKeyGenerateFailed: "Failed to generate the SSH key",
    sshKeyNamePlaceholder: "Key name, e.g. id_ed25519_work",
    sshKeyCommentPlaceholder: "Comment (optional)",
    sshKeyCopyPublic: "Copy public key",
    sshKeyCopied: (name: string) => `Public key copied: ${name}`,
    sshKeyCopyFailed: "Failed to copy the public key",
    sshKeyLoadFailed: "Failed to read SSH keys",
    snippets: "Snippets",
    snippetsDescription: "Reusable commands with {{host}} / {{user}} / {{port}} variables. Run executes immediately, Paste only types the command.",
    newSnippet: "New snippet",
    editSnippet: "Edit snippet",
    snippetName: "Name",
    snippetContent: "Command",
    snippetContentPlaceholder: "systemctl status nginx\nlog tail: tail -n 200 /var/log/nginx/error.log",
    snippetHost: "Bind to host",
    snippetAnyHost: "Any host (uses the active terminal)",
    snippetDangerous: "Dangerous",
    snippetDangerousHint: "Destructive commands (rm -rf, drop table, reboot…) are flagged and need a second click before running.",
    snippetVariables: "Variables: ",
    snippetRun: "Run",
    snippetPaste: "Paste",
    snippetPasteHint: "Type the command into the terminal without pressing enter",
    snippetEmpty: "No snippets yet",
    snippetEmptyDescription: "Save the commands you retype most often — deploy, tail logs, clear caches.",
    snippetConfirmDelete: "Confirm delete",
    snippetConfirmRun: "Confirm run",
    snippetSaved: "Snippet saved",
    snippetSaveFailed: "Failed to save the snippet",
    snippetDeleted: "Snippet deleted",
    snippetDeleteFailed: "Failed to delete the snippet",
    snippetNoTerminal: "Open a terminal first — snippets are sent to the last terminal you used",
    snippetSent: (name: string) => `Sent snippet: ${name}`,
    tmuxPersistence: "Reconnect inside tmux",
    tmuxPersistenceDescription: "Open every SSH terminal inside a per-host tmux session, so reconnects and app restarts land back in the same remote shell. Falls back to a normal login shell when tmux is unavailable.",
    monitorDescription: "Observe key server status and refresh it on demand.",
    monitorLoading: "Loading server observation",
    monitorLoadingDescription: "Collecting a quick status snapshot from the remote server.",
    monitorLoadFailed: "Server observation failed",
    openingMonitor: (name) => `Opening monitor for ${name}`,
    refreshingMonitor: (name) => `Refreshing monitor for ${name}`,
    monitorLoaded: (name) => `Loaded monitor for ${name}`,
    closedMonitorTab: (title) => `Closed monitor tab ${title}`,
    monitorHostname: "Hostname",
    monitorOperatingSystem: "Operating System",
    monitorUptime: "Uptime",
    monitorLoad: "Load Average",
    monitorCpuCores: "CPU Cores",
    monitorCpuUsage: "CPU Usage",
    monitorMemory: "Memory Usage",
    monitorMemoryPercent: "Memory Percent",
    monitorDisk: "Disk Usage",
    monitorDiskPercent: "Disk Percent",
    monitorNetwork: "Network",
    monitorTopProcesses: "Top Processes",
    monitorNoProcesses: "No process snapshot available",
    monitorPid: "PID",
    topFive: "Top 5",
    topTen: "Top 10",
    monitorUpdatedAt: "Updated At",
    refreshing: "Refreshing...",
    autoRefresh: "Auto refresh: 15s",
    serverInfo: "Server Info",
    monitorInfoCopied: "Server info copied",
    copied: "Copied",
    copyServerInfo: "Copy Server Info",
    home: "Home",
    homeDescription: "Start from one clear place, then jump into hosts, SFTP, agent, or a local terminal.",
    hosts: "Hosts",
    sftp: "SFTP",
    newTab: "New Tab",
    localTerminal: "Local Terminal",
    openingLocalTerminal: "Opening local terminal...",
    localTerminalOpened: "Local terminal opened",
    localTerminalDefaultPath: "Default Local Terminal Directory",
    localTerminalDefaultPathDescription: "Optional directory used when opening a local terminal tab.",
    localTerminalDefaultPathPlaceholder: "Use system default shell directory",
    localTerminalPathSaved: "Saved local terminal default directory",
    localFiles: "Local Files",
    preview: "Preview",
    openPreview: "Open Preview",
    hidePreview: "Hide Preview",
    previewEmpty: "Select a file to preview",
    previewLoading: "Loading preview...",
    previewUnsupported: "Preview is not supported for this file type",
    previewTruncated: "Preview truncated to keep the app responsive",
    archiveEntries: "Archive Entries",
    failedLoadLocalPreview: "Failed to load local preview",
    formatCode: "Format",
    renderMarkdown: "Markdown",
    showRaw: "Raw",
    fileNameColumn: "Name",
    fileModifiedDateColumn: "Modified",
    fileSizeColumn: "Size",
    fileKindColumn: "Kind",
    fileAddedDateColumn: "Added Date",
    folderKind: "Folder",
    fileKindFallback: "File",
    homeDirectory: "Home",
    chooseDirectory: "Choose Folder",
    projectPathPickFailed: "Failed to choose project directory",
    recentProjects: "Recent Projects",
    openDefaultDirectory: "Open Default Directory",
    noProjectPaths: "No projects with local paths yet",
    searchProjectsPlaceholder: "Search projects...",
    update: "Update",
    settings: "Settings",
    searchPlaceholder: "Find a host or ssh user@hostname...",
    new: "New",
    hostCount: (count) => `${count} available`,
    edit: "Edit",
    connect: "Connect",
    noHostsFound: "No hosts found",
    noHostsHint: "Try another keyword or create a new host.",
    defaultProject: "Default Project",
    backToProjects: "Back to Projects",
    openProject: "Open Project",
    addHost: "Add Host",
    noHostsInProject: "No hosts in this project",
    noHostsInProjectDescription: "Create a host in this project to start managing servers here.",
    createHost: "Create Host",
    newHost: "New Host",
    editHost: "Edit Host",
    createServerProfile: "Create server profile",
    label: "Label",
    address: "Address",
    port: "Port",
    username: "Username",
    authType: "Auth Type",
    authPassword: "Password",
    authKey: "Private Key",
    jumpHost: "Jump Host",
    jumpHostNone: "Direct connection",
    jumpHostVia: (name: string) => `via ${name}`,
    password: "Password",
    passwordStoredPlaceholder: "Saved in Keychain — leave blank to keep",
    privateKeyPath: "Private Key Path",
    working: "Working...",
    testSsh: "Test SSH",
    save: "Save",
    delete: "Delete",
    confirmDeleteTitle: "Confirm Delete",
    confirmDeleteLocalMessage: (path: string) => `Delete local file "${path}"? This cannot be undone.`,
    confirmDeleteRemoteMessage: (path: string) => `Delete remote file "${path}" on the server? This cannot be undone.`,
    deleteEntryFailed: (name: string) => `Failed to delete ${name}`,
    disconnected: "Disconnected",
    reconnect: "Reconnect",
    sessionDisconnected: "Session disconnected",
    reconnecting: "Reconnecting...",
    terminalSearchPlaceholder: "Find in terminal",
    showHiddenFiles: "Show hidden files",
    sftpDescription: "Choose a host before browsing remote files.",
    sftpWelcomeTitle: "Welcome to SFTP",
    sftpWelcomeDescription: "Pick a server below to connect. Authentication only starts after you choose one.",
    sftpBackToServers: "Back to servers",
    selectHost: "Select Host",
    selectHostPlaceholder: "Select host",
    local: "Local",
    remote: "Remote",
    noLocalFiles: "No local files",
    noRemoteFiles: "No remote files",
    transfers: "Transfers",
    transferCount: (count) => `${count} item(s)`,
    transferUpload: "Upload",
    transferDownload: "Download",
    clearTransfer: "Clear",
    settingsDescription: "Application preferences and connection defaults.",
    general: "General",
    projects: "Projects",
    projectsDescription: "Manage reusable project entries and local workspace paths.",
    addProject: "Add Project",
    noProjects: "No projects yet",
    noProjectsDescription: "Create a project entry to keep its name, namespace, and local path handy.",
    projectName: "Project Name",
    projectNameDescription: "Primary display name for this project.",
    projectNamespace: "Namespace / Owner",
    projectNamespaceDescription: "Optional owner, org, or workspace grouping.",
    projectPath: "Local Path",
    projectPathDescription: "Optional local workspace path for this project.",
    projectType: "Project Type",
    projectTypeDescription: "Choose whether this project is used for local work, server management, or both.",
    localProject: "Local Project",
    serverProject: "Server Project",
    hybridProject: "Hybrid Project",
    newProject: "New Project",
    editProject: "Edit Project",
    saveProject: "Save Project",
    projectNameRequired: "Project name is required",
    projectAdded: (name) => `Added project ${name}`,
    projectUpdated: (name) => `Updated project ${name}`,
    projectRemoved: (name) => `Removed project ${name}`,
    cancel: "Cancel",
    appTheme: "App Theme",
    appThemeDescription: "Choose the light or dark app appearance.",
    language: "Language",
    languageDescription: "Current interface language for the desktop app.",
    connection: "Connection",
    sshDefaults: "SSH Defaults",
    sshDefaultsDescription: "Default connect timeout and keepalive settings.",
    sshConnectTimeout: "Connect Timeout",
    sshConnectTimeoutDescription: "How long to wait before a new SSH connection times out.",
    sshKeepaliveInterval: "Keepalive Interval",
    sshKeepaliveIntervalDescription: "How often to send keepalive packets to the remote host.",
    secondsValue: (value) => `${value}s`,
    appliedSshDefaults: (connectTimeout, keepaliveInterval) => `Applied SSH defaults ${connectTimeout}s / ${keepaliveInterval}s`,
    terminal: "Terminal",
    terminalDescription: "Adjust the local shell and terminal appearance.",
    terminalFontSize: "Terminal Font Size",
    terminalFontSizeDescription: "Choose the font size used by terminal tabs.",
    terminalCharset: "Terminal Charset",
    terminalCharsetDescription: "Select how terminal output bytes are decoded, useful for Chinese servers.",
    terminalTheme: "Terminal Theme",
    selected: "Selected",
    select: "Select",
    about: "About",
    appDescription: "Remote server workbench for macOS.",
    softwareUpdate: "Software Update",
    softwareUpdateAvailable: (version) => `Version ${version} is ready to download.`,
    softwareUpdateChecking: "Checking GitHub release metadata...",
    softwareUpdateDefault: "Check whether a newer desktop build is available.",
    viewUpdate: "View Update",
    checkNow: "Check Now",
    dangerZone: "Danger Zone",
    clearLocalData: "Clear Local Data",
    clearLocalDataDescription: "Remove saved hosts and local settings from this Mac.",
    clearing: "Clearing...",
    clearData: "Clear Data",
    quickConnect: "Quick Connect",
    commandPalettePlaceholder: "Search hosts or type user@host:port…",
    commandPaletteNoResults: "No matching hosts",
    commandPaletteRecent: "Recent",
    commandPaletteHosts: "Hosts",
    commandPaletteActions: "Actions",
    commandPaletteQuickConnect: "Quick connect",
    commandPaletteTemporary: "Temporary connection, not saved",
    commandPaletteOpenSftp: "Open SFTP",
    commandPaletteTestConnection: "Test connection",
    commandPaletteEditHost: "Edit host",
    commandPaletteFooter: "↑↓ Navigate · ↵ Connect · Tab SFTP · Esc Close",
    editHostDetails: "Edit Host Details",
    collaborate: "Collaborate",
    moveTo: "Move to",
    copyTo: "Copy to",
    duplicate: "Duplicate",
    copyLink: "Copy Link",
    remove: "Remove",
    upload: "Upload",
    download: "Download",
    updateAvailable: "Update Available",
    currentVersionToNewVersion: (currentVersion, nextVersion) => `Current version ${currentVersion} → new version ${nextVersion}`,
    updateSummary: "Download installs the update quietly in the background. Restart switches the app to the new version.",
    whatsNew: "What's New",
    noReleaseNotes: "No release notes provided for this version.",
    status: "Status",
    updateInstalledRestart: "Update downloaded and installed. Restart to finish.",
    downloadingAndInstalling: "Downloading and installing update...",
    readyToDownloadUpdate: "Ready to download this update.",
    preparingDownload: "Preparing download...",
    later: "Later",
    downloading: "Downloading...",
    downloadedState: "Downloaded",
    restart: "Restart"
  },
  zh: {
    light: "浅色",
    dark: "深色",
    untitledHost: "未命名主机",
    ready: "就绪",
    refresh: "刷新",
    up: "上级",
    loading: "加载中...",
    updaterDesktopOnly: "仅桌面端应用支持更新器。",
    checkingForUpdates: "正在检查更新...",
    updateAvailableStatus: (version) => `发现新版本 ${version}`,
    latestVersion: "当前已是最新版本。",
    updateCheckFailed: "检查更新失败",
    failedLoadLocalDirectory: "加载本地目录失败",
    failedLoadRemoteDirectory: "加载远程目录失败",
    connected: "已连接",
    failedSubscribeTerminalEvents: "订阅终端输出事件失败",
    downloadUpdateStatus: (version) => `正在下载更新 ${version}...`,
    updateReadyStatus: (version) => `更新 ${version} 已可重启安装`,
    updateDownloadFailed: "下载更新失败",
    restartingToApplyUpdate: "正在重启并应用更新...",
    restartFailed: "重启失败",
    clearDataSuccess: "已清除本地应用数据",
    clearDataFailed: "清除数据失败",
    appliedTerminalTheme: (themeName) => `已应用终端主题 ${themeName}`,
    appliedAppTheme: (themeName) => `已应用${themeName}应用主题`,
    appliedLanguage: (languageName) => `语言已切换为 ${languageName}`,
    appliedTerminalFontSize: (fontSize) => `已应用终端字号 ${fontSize}px`,
    appliedTerminalCharset: (charset) => `已应用终端字符集 ${charset}`,
    uploadingTo: (path) => `正在上传到 ${path}`,
    uploaded: (name) => `已上传 ${name}`,
    uploadedTo: (path) => `已上传到 ${path}`,
    uploadCancelled: (name) => `已取消 ${name} 的上传`,
    uploadFailed: (name) => `${name} 上传失败`,
    downloadingTo: (path) => `正在下载到 ${path}`,
    downloaded: (name) => `已下载 ${name}`,
    downloadedTo: (path) => `已下载到 ${path}`,
    downloadFailed: (name) => `${name} 下载失败`,
    deletedLocal: (name) => `已删除本地文件 ${name}`,
    deletedRemote: (name) => `已删除远程文件 ${name}`,
    addressRequired: "地址不能为空",
    savedHost: (name) => `已保存主机 ${name}`,
    saveFailed: "保存失败",
    deletedHost: (name) => `已删除主机 ${name}`,
    deleteFailed: "删除失败",
    removedHost: (name) => `已移除主机 ${name}`,
    removeFailed: "移除失败",
    hostCopySuffix: "副本",
    duplicatedHost: (name) => `已复制主机 ${name}`,
    duplicateFailed: "复制失败",
    copiedLink: (name) => `已复制 ${name} 的链接`,
    copyLinkFailed: "复制链接失败",
    notWiredYet: (label) => `${label} 功能暂未接入`,
    selectOrFillHostFirst: "请先选择或填写主机信息",
    testingHost: (username, address, port) => `正在测试 ${username}@${address}:${port} ...`,
    connectionTestFailed: "连接测试失败",
    passwordRequired: "密码认证需要填写密码",
    keyPathRequired: "密钥认证需要填写私钥路径",
    connectingToHost: (username, address, port) => `正在连接 ${username}@${address}:${port}...`,
    terminalSessionOpened: (username, address) => `已为 ${username}@${address} 打开终端会话`,
    terminalOpenFailed: "打开终端失败",
    closedTerminalTab: (title) => `已关闭终端标签 ${title}`,
    monitor: "监控",
    forwards: "端口转发",
    forwardsDescription: "可复用的隧道，用这台 Mac 访问远端服务。",
    newForward: "新建转发",
    editForward: "编辑转发",
    forwardLabel: "名称",
    forwardKind: "类型",
    forwardKindLocal: "本地 (-L)",
    forwardKindRemote: "远程 (-R)",
    forwardKindDynamic: "动态 SOCKS (-D)",
    forwardHost: "经由主机",
    forwardBindHost: "监听地址",
    forwardBindPort: "监听端口",
    forwardTargetHost: "目标地址",
    forwardTargetPort: "目标端口",
    forwardAutoStart: "自动启动",
    forwardAutoStartDescription: "ServerDeck 启动时自动打开该隧道。",
    forwardStart: "启动",
    forwardStop: "停止",
    forwardsEmpty: "还没有端口转发",
    forwardsEmptyDescription: "创建隧道来访问远端数据库、Web 后台，或任何被防火墙挡住的服务。",
    forwardsHostMissing: "主机已不存在",
    forwardsLoadFailed: "加载端口转发失败",
    forwardsSaved: "端口转发已保存",
    forwardsSaveFailed: "保存端口转发失败",
    forwardsStarted: (name: string) => `隧道已启动：${name}`,
    forwardsStopped: (name: string) => `隧道已停止：${name}`,
    forwardsToggleFailed: "切换隧道失败",
    forwardsDeleted: "端口转发已删除",
    forwardsConfirmDelete: "确认删除",
    sshConfig: "SSH 配置",
    sshConfigDescription: "从 ~/.ssh/config 同步主机。该文件持续作为数据源，之后的修改还能再次同步。",
    sshConfigFile: "文件",
    sshConfigMissing: "这台 Mac 上没有找到 ~/.ssh/config。",
    sshConfigEmpty: "~/.ssh/config 里没有可导入的具体主机。",
    sshConfigSelectAll: "全选",
    sshConfigClearAll: "清空",
    sshConfigImport: "导入 / 同步",
    sshConfigStateNew: "新增",
    sshConfigStateUpdated: "有变更",
    sshConfigStateUnchanged: "无变化",
    sshConfigViaJump: "经",
    sshConfigNoSelection: "未选择任何主机",
    sshConfigLoadFailed: "读取 ~/.ssh/config 失败",
    sshConfigImported: (imported: number, updated: number) => `已导入 ${imported} 台主机，更新 ${updated} 台`,
    sshConfigImportFailed: "导入 ~/.ssh/config 失败",
    sshSettings: "SSH 与 Known Hosts",
    sshSettingsDescription: "主机指纹信任与连接排障。",
    knownHosts: "已知主机",
    knownHostsDescription: "这台 Mac 上已接受过主机密钥的服务器。",
    knownHostsEmpty: "还没有记录任何已知主机",
    knownHostsRefresh: "刷新",
    knownHostsRemoved: (host: string) => `已从 known_hosts 移除 ${host}`,
    knownHostsLoadFailed: "读取 known_hosts 失败",
    knownHostsRemoveFailed: "移除已知主机失败",
    sshErrorDns: "域名无法解析 —— 检查地址或 DNS",
    sshErrorRefused: "连接被拒绝 —— 该端口上的 sshd 是否在运行？",
    sshErrorTimeout: "连接超时 —— 网络不可达或被防火墙拦截",
    sshErrorUnreachable: "无法路由到主机 —— 当前网络到不了该地址",
    sshErrorPublicKey: "公钥认证被拒 —— 检查密钥与 authorized_keys",
    sshErrorPassword: "密码被拒 —— 请在主机设置里重新输入",
    sshErrorHostKey: "主机指纹变更或未验证 —— 先确认指纹再信任",
    sshErrorTooManyAttempts: "认证尝试次数过多 —— 精简 ssh 提供的密钥",
    sshErrorConnectionReset: "连接被远端重置",
    sshErrorSshpassMissing: "这台 Mac 缺少 sshpass —— 安装它或改用密钥认证",
    sshKeys: "SSH 密钥",
    sshKeysDescription: "~/.ssh 下已有的密钥。主机里可直接选择而不用手填路径，也能新建免密码的 ed25519 密钥。",
    sshKeysEmpty: "~/.ssh 下还没有密钥",
    sshKeyGenerate: "生成",
    sshKeyGenerated: (name: string) => `已生成密钥 ${name}`,
    sshKeyGenerateFailed: "生成 SSH 密钥失败",
    sshKeyNamePlaceholder: "密钥名，例如 id_ed25519_work",
    sshKeyCommentPlaceholder: "备注（可选）",
    sshKeyCopyPublic: "复制公钥",
    sshKeyCopied: (name: string) => `已复制公钥：${name}`,
    sshKeyCopyFailed: "复制公钥失败",
    sshKeyLoadFailed: "读取 SSH 密钥失败",
    snippets: "命令片段",
    snippetsDescription: "可复用命令，支持 {{host}} / {{user}} / {{port}} 变量。「执行」直接回车运行，「粘贴」只输入不回车。",
    newSnippet: "新建片段",
    editSnippet: "编辑片段",
    snippetName: "名称",
    snippetContent: "命令内容",
    snippetContentPlaceholder: "systemctl status nginx\n看日志：tail -n 200 /var/log/nginx/error.log",
    snippetHost: "绑定主机",
    snippetAnyHost: "任意主机（使用当前终端）",
    snippetDangerous: "危险",
    snippetDangerousHint: "破坏性命令（rm -rf、drop table、reboot…）会被标记，执行前需要二次确认。",
    snippetVariables: "变量：",
    snippetRun: "执行",
    snippetPaste: "粘贴",
    snippetPasteHint: "只把命令输入终端，不自动回车",
    snippetEmpty: "还没有命令片段",
    snippetEmptyDescription: "把每天重复敲的命令存下来——部署、看日志、清缓存。",
    snippetConfirmDelete: "确认删除",
    snippetConfirmRun: "确认执行",
    snippetSaved: "片段已保存",
    snippetSaveFailed: "保存片段失败",
    snippetDeleted: "片段已删除",
    snippetDeleteFailed: "删除片段失败",
    snippetNoTerminal: "请先打开一个终端 —— 片段会发送到最近使用的终端",
    snippetSent: (name: string) => `已发送片段：${name}`,
    tmuxPersistence: "使用 tmux 恢复会话",
    tmuxPersistenceDescription: "每台主机的 SSH 终端都开在专属 tmux 会话里，断线重连或重启应用后能回到原来的远端 shell；远端没有 tmux 时自动回退到普通登录 shell。",
    monitorDescription: "观测服务器关键状态，并支持手动刷新。",
    monitorLoading: "正在加载服务器观测数据",
    monitorLoadingDescription: "正在从远程服务器采集一份快速状态快照。",
    monitorLoadFailed: "服务器观测失败",
    openingMonitor: (name) => `正在打开 ${name} 的监控`,
    refreshingMonitor: (name) => `正在刷新 ${name} 的监控`,
    monitorLoaded: (name) => `已加载 ${name} 的监控`,
    closedMonitorTab: (title) => `已关闭监控标签 ${title}`,
    monitorHostname: "主机名",
    monitorOperatingSystem: "操作系统",
    monitorUptime: "运行时长",
    monitorLoad: "负载均值",
    monitorCpuCores: "CPU 核心数",
    monitorCpuUsage: "CPU 使用率",
    monitorMemory: "内存使用",
    monitorMemoryPercent: "内存占用率",
    monitorDisk: "磁盘使用",
    monitorDiskPercent: "磁盘占用率",
    monitorNetwork: "网络",
    monitorTopProcesses: "高占用进程",
    monitorNoProcesses: "暂无进程快照",
    monitorPid: "PID",
    topFive: "前 5",
    topTen: "前 10",
    monitorUpdatedAt: "更新时间",
    refreshing: "刷新中...",
    autoRefresh: "自动刷新：15 秒",
    serverInfo: "服务器信息",
    monitorInfoCopied: "已复制服务器信息",
    copied: "已复制",
    copyServerInfo: "一键复制配置信息",
    home: "首页",
    homeDescription: "先从一个清晰入口开始，再进入主机、SFTP、Agent 或本地终端。",
    hosts: "主机",
    sftp: "SFTP",
    newTab: "新标签页",
    localTerminal: "本地终端",
    openingLocalTerminal: "正在打开本地终端...",
    localTerminalOpened: "已打开本地终端",
    localTerminalDefaultPath: "本地终端默认目录",
    localTerminalDefaultPathDescription: "打开本地终端标签页时使用的默认目录，可选。",
    localTerminalDefaultPathPlaceholder: "使用系统默认 shell 目录",
    localTerminalPathSaved: "已保存本地终端默认目录",
    localFiles: "本地文件",
    preview: "预览",
    openPreview: "打开预览",
    hidePreview: "关闭预览",
    previewEmpty: "选择一个文件进行预览",
    previewLoading: "正在加载预览...",
    previewUnsupported: "暂不支持预览该文件类型",
    previewTruncated: "为保证响应速度，预览内容已截断",
    archiveEntries: "压缩包文件列表",
    failedLoadLocalPreview: "加载本地预览失败",
    formatCode: "格式化",
    renderMarkdown: "Markdown",
    showRaw: "原文",
    fileNameColumn: "名称",
    fileModifiedDateColumn: "修改日期",
    fileSizeColumn: "大小",
    fileKindColumn: "种类",
    fileAddedDateColumn: "添加日期",
    folderKind: "文件夹",
    fileKindFallback: "文件",
    homeDirectory: "家目录",
    chooseDirectory: "选择目录",
    projectPathPickFailed: "选择项目目录失败",
    recentProjects: "最近项目",
    openDefaultDirectory: "打开默认目录",
    noProjectPaths: "还没有配置本地路径的项目",
    searchProjectsPlaceholder: "搜索项目...",
    update: "更新",
    settings: "设置",
    searchPlaceholder: "搜索主机或输入 ssh user@hostname...",
    new: "新建",
    hostCount: (count) => `共 ${count} 个`,
    edit: "编辑",
    connect: "连接",
    noHostsFound: "未找到主机",
    noHostsHint: "试试其他关键词，或新建一个主机。",
    defaultProject: "默认项目",
    backToProjects: "返回项目",
    openProject: "打开项目",
    addHost: "新增主机",
    noHostsInProject: "这个项目里还没有主机",
    noHostsInProjectDescription: "先在这个项目下创建一台主机，后续就可以在这里集中管理。",
    createHost: "新建主机",
    newHost: "新建主机",
    editHost: "编辑主机",
    createServerProfile: "创建服务器配置",
    label: "名称",
    address: "地址",
    port: "端口",
    username: "用户名",
    authType: "认证方式",
    authPassword: "密码",
    authKey: "私钥",
    jumpHost: "跳板机",
    jumpHostNone: "直连（无跳板）",
    jumpHostVia: (name: string) => `经 ${name}`,
    password: "密码",
    passwordStoredPlaceholder: "已存入钥匙串,留空表示不修改",
    privateKeyPath: "私钥路径",
    working: "处理中...",
    testSsh: "测试 SSH",
    save: "保存",
    delete: "删除",
    confirmDeleteTitle: "删除确认",
    confirmDeleteLocalMessage: (path: string) => `确定要删除本地文件「${path}」吗?此操作不可恢复。`,
    confirmDeleteRemoteMessage: (path: string) => `确定要删除服务器上的「${path}」吗?此操作不可恢复。`,
    deleteEntryFailed: (name: string) => `删除 ${name} 失败`,
    disconnected: "已断开",
    reconnect: "重新连接",
    sessionDisconnected: "会话已断开",
    reconnecting: "正在重新连接...",
    terminalSearchPlaceholder: "在终端中搜索",
    showHiddenFiles: "显示隐藏文件",
    sftpDescription: "浏览远程文件前请先选择一台主机。",
    sftpWelcomeTitle: "欢迎使用 SFTP",
    sftpWelcomeDescription: "选择下面的一台服务器开始连接，认证只会在你选择之后进行。",
    sftpBackToServers: "返回服务器列表",
    selectHost: "选择主机",
    selectHostPlaceholder: "请选择主机",
    local: "本地",
    remote: "远程",
    noLocalFiles: "没有本地文件",
    noRemoteFiles: "没有远程文件",
    transfers: "传输任务",
    transferCount: (count) => `${count} 项`,
    transferUpload: "上传",
    transferDownload: "下载",
    clearTransfer: "清除",
    settingsDescription: "应用偏好与连接默认配置。",
    general: "通用",
    projects: "项目",
    projectsDescription: "管理可复用的项目条目和本地工作区路径。",
    addProject: "添加项目",
    noProjects: "还没有项目",
    noProjectsDescription: "创建一个项目条目，保存名称、命名空间和本地路径。",
    projectName: "项目名称",
    projectNameDescription: "这个项目的主要显示名称。",
    projectNamespace: "命名空间 / 归属",
    projectNamespaceDescription: "可选的 owner、组织或工作区分组。",
    projectPath: "本地路径",
    projectPathDescription: "该项目对应的本地工作区路径（可选）。",
    projectType: "项目类型",
    projectTypeDescription: "选择这个项目用于本地工作、服务器管理，或两者都用。",
    localProject: "本地项目",
    serverProject: "服务器项目",
    hybridProject: "混合项目",
    newProject: "新建项目",
    editProject: "编辑项目",
    saveProject: "保存项目",
    projectNameRequired: "项目名称不能为空",
    projectAdded: (name) => `已添加项目 ${name}`,
    projectUpdated: (name) => `已更新项目 ${name}`,
    projectRemoved: (name) => `已删除项目 ${name}`,
    cancel: "取消",
    appTheme: "应用主题",
    appThemeDescription: "选择浅色或深色外观。",
    language: "语言",
    languageDescription: "桌面应用当前使用的界面语言。",
    connection: "连接",
    sshDefaults: "SSH 默认值",
    sshDefaultsDescription: "默认连接超时与 keepalive 设置。",
    sshConnectTimeout: "连接超时",
    sshConnectTimeoutDescription: "新建 SSH 连接在超时前最多等待多久。",
    sshKeepaliveInterval: "保活间隔",
    sshKeepaliveIntervalDescription: "向远端发送 keepalive 包的时间间隔。",
    secondsValue: (value) => `${value} 秒`,
    appliedSshDefaults: (connectTimeout, keepaliveInterval) => `已应用 SSH 默认值 ${connectTimeout} 秒 / ${keepaliveInterval} 秒`,
    terminal: "终端",
    terminalDescription: "调整本地 shell 与终端外观。",
    terminalFontSize: "终端字号",
    terminalFontSizeDescription: "选择终端标签页使用的字号。",
    terminalCharset: "终端字符集",
    terminalCharsetDescription: "选择终端输出字节的解码方式，中文服务器场景下尤其有用。",
    terminalTheme: "终端主题",
    selected: "已选择",
    select: "选择",
    about: "关于",
    appDescription: "面向 macOS 的远程服务器工作台。",
    softwareUpdate: "软件更新",
    softwareUpdateAvailable: (version) => `版本 ${version} 已可下载。`,
    softwareUpdateChecking: "正在检查 GitHub 发布元数据...",
    softwareUpdateDefault: "检查是否有可用的新桌面版本。",
    viewUpdate: "查看更新",
    checkNow: "立即检查",
    dangerZone: "危险操作",
    clearLocalData: "清除本地数据",
    clearLocalDataDescription: "删除这台 Mac 上保存的主机和本地设置。",
    clearing: "清除中...",
    clearData: "清除数据",
    quickConnect: "快速连接",
    commandPalettePlaceholder: "搜索主机，或直接输入 user@host:port…",
    commandPaletteNoResults: "没有匹配的主机",
    commandPaletteRecent: "最近连接",
    commandPaletteHosts: "主机",
    commandPaletteActions: "操作",
    commandPaletteQuickConnect: "快速连接",
    commandPaletteTemporary: "临时连接，不会保存",
    commandPaletteOpenSftp: "打开 SFTP",
    commandPaletteTestConnection: "测试连接",
    commandPaletteEditHost: "编辑主机",
    commandPaletteFooter: "↑↓ 选择 · ↵ 连接 · Tab 打开 SFTP · Esc 关闭",
    editHostDetails: "编辑主机信息",
    collaborate: "协作",
    moveTo: "移动到",
    copyTo: "复制到",
    duplicate: "复制",
    copyLink: "复制链接",
    remove: "移除",
    upload: "上传",
    download: "下载",
    updateAvailable: "发现新版本",
    currentVersionToNewVersion: (currentVersion, nextVersion) => `当前版本 ${currentVersion} → 新版本 ${nextVersion}`,
    updateSummary: "下载会在后台静默安装更新，重启后即可切换到新版本。",
    whatsNew: "更新内容",
    noReleaseNotes: "此版本未提供更新说明。",
    status: "状态",
    updateInstalledRestart: "更新已下载并安装完成，重启即可生效。",
    downloadingAndInstalling: "正在下载并安装更新...",
    readyToDownloadUpdate: "可以开始下载此更新。",
    preparingDownload: "正在准备下载...",
    later: "稍后",
    downloading: "下载中...",
    downloadedState: "已下载",
    restart: "重启"
  },
  ja: {
    light: "ライト",
    dark: "ダーク",
    untitledHost: "無題のホスト",
    ready: "準備完了",
    refresh: "更新",
    up: "上へ",
    loading: "読み込み中...",
    updaterDesktopOnly: "アップデーターはデスクトップアプリでのみ利用できます。",
    checkingForUpdates: "アップデートを確認中...",
    updateAvailableStatus: (version) => `アップデート ${version} を利用できます`,
    latestVersion: "すでに最新バージョンです。",
    updateCheckFailed: "アップデート確認に失敗しました",
    failedLoadLocalDirectory: "ローカルディレクトリの読み込みに失敗しました",
    failedLoadRemoteDirectory: "リモートディレクトリの読み込みに失敗しました",
    connected: "接続済み",
    failedSubscribeTerminalEvents: "ターミナル出力イベントの購読に失敗しました",
    downloadUpdateStatus: (version) => `アップデート ${version} をダウンロード中...`,
    updateReadyStatus: (version) => `アップデート ${version} を再起動して適用できます`,
    updateDownloadFailed: "アップデートのダウンロードに失敗しました",
    restartingToApplyUpdate: "アップデート適用のため再起動しています...",
    restartFailed: "再起動に失敗しました",
    clearDataSuccess: "ローカルアプリデータを削除しました",
    clearDataFailed: "データの削除に失敗しました",
    appliedTerminalTheme: (themeName) => `ターミナルテーマ ${themeName} を適用しました`,
    appliedAppTheme: (themeName) => `${themeName} テーマを適用しました`,
    appliedLanguage: (languageName) => `言語を ${languageName} に変更しました`,
    appliedTerminalFontSize: (fontSize) => `ターミナルフォントサイズを ${fontSize}px に変更しました`,
    appliedTerminalCharset: (charset) => `ターミナル文字コードを ${charset} に設定しました`,
    uploadingTo: (path) => `${path} にアップロード中`,
    uploaded: (name) => `${name} をアップロードしました`,
    uploadedTo: (path) => `${path} にアップロードしました`,
    uploadCancelled: (name) => `${name} のアップロードをキャンセルしました`,
    uploadFailed: (name) => `${name} のアップロードに失敗しました`,
    downloadingTo: (path) => `${path} にダウンロード中`,
    downloaded: (name) => `${name} をダウンロードしました`,
    downloadedTo: (path) => `${path} にダウンロードしました`,
    downloadFailed: (name) => `${name} のダウンロードに失敗しました`,
    deletedLocal: (name) => `ローカルの ${name} を削除しました`,
    deletedRemote: (name) => `リモートの ${name} を削除しました`,
    addressRequired: "アドレスは必須です",
    savedHost: (name) => `ホスト ${name} を保存しました`,
    saveFailed: "保存に失敗しました",
    deletedHost: (name) => `ホスト ${name} を削除しました`,
    deleteFailed: "削除に失敗しました",
    removedHost: (name) => `ホスト ${name} を一覧から削除しました`,
    removeFailed: "削除に失敗しました",
    hostCopySuffix: "コピー",
    duplicatedHost: (name) => `ホスト ${name} を複製しました`,
    duplicateFailed: "複製に失敗しました",
    copiedLink: (name) => `${name} のリンクをコピーしました`,
    copyLinkFailed: "リンクのコピーに失敗しました",
    notWiredYet: (label) => `${label} はまだ未実装です`,
    selectOrFillHostFirst: "先にホストを選択するか入力してください",
    testingHost: (username, address, port) => `${username}@${address}:${port} をテスト中 ...`,
    connectionTestFailed: "接続テストに失敗しました",
    passwordRequired: "パスワード認証にはパスワードが必要です",
    keyPathRequired: "鍵認証には秘密鍵パスが必要です",
    connectingToHost: (username, address, port) => `${username}@${address}:${port} に接続中...`,
    terminalSessionOpened: (username, address) => `${username}@${address} のターミナルセッションを開きました`,
    terminalOpenFailed: "ターミナルを開けませんでした",
    closedTerminalTab: (title) => `ターミナルタブ ${title} を閉じました`,
    monitor: "監視",
    forwards: "ポートフォワード",
    forwardsDescription: "この Mac からリモートサービスへ接続するための再利用可能なトンネル。",
    newForward: "新規フォワード",
    editForward: "フォワードを編集",
    forwardLabel: "名前",
    forwardKind: "種類",
    forwardKindLocal: "ローカル (-L)",
    forwardKindRemote: "リモート (-R)",
    forwardKindDynamic: "ダイナミック SOCKS (-D)",
    forwardHost: "経由ホスト",
    forwardBindHost: "バインドアドレス",
    forwardBindPort: "バインドポート",
    forwardTargetHost: "ターゲットホスト",
    forwardTargetPort: "ターゲットポート",
    forwardAutoStart: "自動起動",
    forwardAutoStartDescription: "ServerDeck の起動時にこのトンネルを開きます。",
    forwardStart: "開始",
    forwardStop: "停止",
    forwardsEmpty: "ポートフォワードがありません",
    forwardsEmptyDescription: "ファイアウォールの内側にあるデータベースや Web UI に接続するトンネルを作成します。",
    forwardsHostMissing: "ホストが見つかりません",
    forwardsLoadFailed: "ポートフォワードの読み込みに失敗しました",
    forwardsSaved: "ポートフォワードを保存しました",
    forwardsSaveFailed: "ポートフォワードの保存に失敗しました",
    forwardsStarted: (name: string) => `トンネルを開始しました: ${name}`,
    forwardsStopped: (name: string) => `トンネルを停止しました: ${name}`,
    forwardsToggleFailed: "トンネルの切り替えに失敗しました",
    forwardsDeleted: "ポートフォワードを削除しました",
    forwardsConfirmDelete: "削除を確認",
    sshConfig: "SSH 設定",
    sshConfigDescription: "~/.ssh/config からホストを同期します。ファイルは継続的なデータソースとして扱われ、後から編集しても再同期できます。",
    sshConfigFile: "ファイル",
    sshConfigMissing: "この Mac に ~/.ssh/config が見つかりません。",
    sshConfigEmpty: "~/.ssh/config に取り込める具体的なホストがありません。",
    sshConfigSelectAll: "すべて選択",
    sshConfigClearAll: "クリア",
    sshConfigImport: "インポート / 同期",
    sshConfigStateNew: "新規",
    sshConfigStateUpdated: "変更あり",
    sshConfigStateUnchanged: "変更なし",
    sshConfigViaJump: "経由",
    sshConfigNoSelection: "選択されていません",
    sshConfigLoadFailed: "~/.ssh/config の読み込みに失敗しました",
    sshConfigImported: (imported: number, updated: number) => `${imported} 件をインポートし、${updated} 件を更新しました`,
    sshConfigImportFailed: "~/.ssh/config のインポートに失敗しました",
    sshSettings: "SSH と known_hosts",
    sshSettingsDescription: "ホスト鍵の信頼と接続のトラブルシューティング。",
    knownHosts: "known_hosts",
    knownHostsDescription: "この Mac でホスト鍵を受け入れたサーバー。",
    knownHostsEmpty: "known_hosts の記録はまだありません",
    knownHostsRefresh: "更新",
    knownHostsRemoved: (host: string) => `${host} を known_hosts から削除しました`,
    knownHostsLoadFailed: "known_hosts の読み込みに失敗しました",
    knownHostsRemoveFailed: "known_hosts の削除に失敗しました",
    sshErrorDns: "ホスト名を解決できません — アドレスまたは DNS を確認してください",
    sshErrorRefused: "接続が拒否されました — そのポートで sshd が動作していますか",
    sshErrorTimeout: "接続がタイムアウトしました — ネットワーク到達不可かファイアウォール",
    sshErrorUnreachable: "ホストへの経路がありません — このアドレスに到達できません",
    sshErrorPublicKey: "公開鍵が拒否されました — 鍵と authorized_keys を確認してください",
    sshErrorPassword: "パスワードが拒否されました — ホスト設定で再入力してください",
    sshErrorHostKey: "ホスト鍵が変更または未検証です — フィンガープリントを確認してください",
    sshErrorTooManyAttempts: "認証の試行回数が多すぎます — 提示する鍵を絞ってください",
    sshErrorConnectionReset: "接続がリモート側でリセットされました",
    sshErrorSshpassMissing: "この Mac に sshpass がありません — インストールするか鍵認証に切り替えてください",
    sshKeys: "SSH 鍵",
    sshKeysDescription: "~/.ssh にある鍵。ホストでパスを手入力せずに選択でき、パスフレーズなしの ed25519 鍵も生成できます。",
    sshKeysEmpty: "~/.ssh に鍵がありません",
    sshKeyGenerate: "生成",
    sshKeyGenerated: (name: string) => `鍵 ${name} を生成しました`,
    sshKeyGenerateFailed: "SSH 鍵の生成に失敗しました",
    sshKeyNamePlaceholder: "鍵の名前（例: id_ed25519_work）",
    sshKeyCommentPlaceholder: "コメント（任意）",
    sshKeyCopyPublic: "公開鍵をコピー",
    sshKeyCopied: (name: string) => `公開鍵をコピーしました: ${name}`,
    sshKeyCopyFailed: "公開鍵のコピーに失敗しました",
    sshKeyLoadFailed: "SSH 鍵の読み込みに失敗しました",
    snippets: "スニペット",
    snippetsDescription: "{{host}} / {{user}} / {{port}} 変数が使える再利用コマンド。「実行」は即実行、「貼り付け」は入力のみ。",
    newSnippet: "新規スニペット",
    editSnippet: "スニペットを編集",
    snippetName: "名前",
    snippetContent: "コマンド",
    snippetContentPlaceholder: "systemctl status nginx\nログ確認: tail -n 200 /var/log/nginx/error.log",
    snippetHost: "ホストに紐付け",
    snippetAnyHost: "任意のホスト（現在のターミナルを使用）",
    snippetDangerous: "危険",
    snippetDangerousHint: "破壊的なコマンド（rm -rf、drop table、reboot など）は警告され、実行前に再確認が必要です。",
    snippetVariables: "変数: ",
    snippetRun: "実行",
    snippetPaste: "貼り付け",
    snippetPasteHint: "Enter を押さずにターミナルへ入力します",
    snippetEmpty: "スニペットがありません",
    snippetEmptyDescription: "毎回打ち直すコマンドを保存しましょう — デプロイ、ログ確認、キャッシュ削除など。",
    snippetConfirmDelete: "削除を確認",
    snippetConfirmRun: "実行を確認",
    snippetSaved: "スニペットを保存しました",
    snippetSaveFailed: "スニペットの保存に失敗しました",
    snippetDeleted: "スニペットを削除しました",
    snippetDeleteFailed: "スニペットの削除に失敗しました",
    snippetNoTerminal: "先にターミナルを開いてください — 最後に使ったターミナルへ送信します",
    snippetSent: (name: string) => `スニペットを送信しました: ${name}`,
    tmuxPersistence: "tmux で再接続",
    tmuxPersistenceDescription: "SSH ターミナルをホストごとの tmux セッション内で開きます。再接続やアプリ再起動後も同じリモートシェルに戻れます。tmux がない場合は通常のログインシェルに戻ります。",
    monitorDescription: "サーバーの主要な状態を確認し、必要に応じて手動更新します。",
    monitorLoading: "サーバー監視情報を読み込み中",
    monitorLoadingDescription: "リモートサーバーから簡易ステータスを収集中です。",
    monitorLoadFailed: "サーバー監視の取得に失敗しました",
    openingMonitor: (name) => `${name} の監視を開いています`,
    refreshingMonitor: (name) => `${name} の監視を更新しています`,
    monitorLoaded: (name) => `${name} の監視を読み込みました`,
    closedMonitorTab: (title) => `監視タブ ${title} を閉じました`,
    monitorHostname: "ホスト名",
    monitorOperatingSystem: "OS",
    monitorUptime: "稼働時間",
    monitorLoad: "ロードアベレージ",
    monitorCpuCores: "CPU コア数",
    monitorCpuUsage: "CPU 使用率",
    monitorMemory: "メモリ使用量",
    monitorMemoryPercent: "メモリ使用率",
    monitorDisk: "ディスク使用量",
    monitorDiskPercent: "ディスク使用率",
    monitorNetwork: "ネットワーク",
    monitorTopProcesses: "上位プロセス",
    monitorNoProcesses: "プロセススナップショットはありません",
    monitorPid: "PID",
    topFive: "上位5件",
    topTen: "上位10件",
    monitorUpdatedAt: "更新時刻",
    refreshing: "更新中...",
    autoRefresh: "自動更新: 15秒",
    serverInfo: "サーバー情報",
    monitorInfoCopied: "サーバー情報をコピーしました",
    copied: "コピー済み",
    copyServerInfo: "設定情報をコピー",
    home: "ホーム",
    homeDescription: "まずは分かりやすい入口から始めて、そこから Hosts、SFTP、Agent、ローカルターミナルへ進みます。",
    hosts: "ホスト",
    sftp: "SFTP",
    newTab: "新しいタブ",
    localTerminal: "ローカルターミナル",
    openingLocalTerminal: "ローカルターミナルを開いています...",
    localTerminalOpened: "ローカルターミナルを開きました",
    localTerminalDefaultPath: "ローカルターミナルの既定ディレクトリ",
    localTerminalDefaultPathDescription: "ローカルターミナルタブを開くときに使う既定ディレクトリです。任意です。",
    localTerminalDefaultPathPlaceholder: "システム既定の shell ディレクトリを使用",
    localTerminalPathSaved: "ローカルターミナルの既定ディレクトリを保存しました",
    localFiles: "ローカルファイル",
    preview: "プレビュー",
    openPreview: "プレビューを開く",
    hidePreview: "プレビューを閉じる",
    previewEmpty: "プレビューするファイルを選択してください",
    previewLoading: "プレビューを読み込み中...",
    previewUnsupported: "このファイル形式のプレビューは未対応です",
    previewTruncated: "アプリの応答性を保つため、プレビューは一部のみ表示しています",
    archiveEntries: "アーカイブ内ファイル一覧",
    failedLoadLocalPreview: "ローカルプレビューの読み込みに失敗しました",
    formatCode: "整形",
    renderMarkdown: "Markdown",
    showRaw: "原文",
    fileNameColumn: "名前",
    fileModifiedDateColumn: "更新日時",
    fileSizeColumn: "サイズ",
    fileKindColumn: "種類",
    fileAddedDateColumn: "追加日",
    folderKind: "フォルダ",
    fileKindFallback: "ファイル",
    homeDirectory: "ホーム",
    chooseDirectory: "フォルダを選択",
    projectPathPickFailed: "プロジェクトディレクトリの選択に失敗しました",
    recentProjects: "最近のプロジェクト",
    openDefaultDirectory: "既定ディレクトリで開く",
    noProjectPaths: "ローカルパス付きのプロジェクトはまだありません",
    searchProjectsPlaceholder: "プロジェクトを検索...",
    update: "更新",
    settings: "設定",
    searchPlaceholder: "ホストを検索、または ssh user@hostname... を入力",
    new: "新規",
    hostCount: (count) => `${count} 件`,
    edit: "編集",
    connect: "接続",
    noHostsFound: "ホストが見つかりません",
    noHostsHint: "別のキーワードを試すか、新しいホストを作成してください。",
    defaultProject: "デフォルトプロジェクト",
    backToProjects: "プロジェクト一覧へ戻る",
    openProject: "プロジェクトを開く",
    addHost: "ホストを追加",
    noHostsInProject: "このプロジェクトにはまだホストがありません",
    noHostsInProjectDescription: "このプロジェクト用のホストを作成すると、ここでまとめて管理できます。",
    createHost: "ホストを作成",
    newHost: "新規ホスト",
    editHost: "ホストを編集",
    createServerProfile: "サーバープロファイルを作成",
    label: "ラベル",
    address: "アドレス",
    port: "ポート",
    username: "ユーザー名",
    authType: "認証方式",
    authPassword: "パスワード",
    authKey: "秘密鍵",
    jumpHost: "ジャンプホスト",
    jumpHostNone: "直接接続",
    jumpHostVia: (name: string) => `${name} 経由`,
    password: "パスワード",
    passwordStoredPlaceholder: "キーチェーンに保存済み。変更しない場合は空欄",
    privateKeyPath: "秘密鍵パス",
    working: "処理中...",
    testSsh: "SSH をテスト",
    save: "保存",
    delete: "削除",
    confirmDeleteTitle: "削除の確認",
    confirmDeleteLocalMessage: (path: string) => `ローカルファイル「${path}」を削除しますか?この操作は元に戻せません。`,
    confirmDeleteRemoteMessage: (path: string) => `サーバー上の「${path}」を削除しますか?この操作は元に戻せません。`,
    deleteEntryFailed: (name: string) => `${name} の削除に失敗しました`,
    disconnected: "切断されました",
    reconnect: "再接続",
    sessionDisconnected: "セッションが切断されました",
    reconnecting: "再接続しています...",
    terminalSearchPlaceholder: "ターミナル内を検索",
    showHiddenFiles: "隠しファイルを表示",
    sftpDescription: "リモートファイルを閲覧する前にホストを選択してください。",
    sftpWelcomeTitle: "SFTPへようこそ",
    sftpWelcomeDescription: "下のサーバーを選んで接続します。認証は選択後にのみ開始されます。",
    sftpBackToServers: "サーバー一覧へ戻る",
    selectHost: "ホストを選択",
    selectHostPlaceholder: "ホストを選択",
    local: "ローカル",
    remote: "リモート",
    noLocalFiles: "ローカルファイルがありません",
    noRemoteFiles: "リモートファイルがありません",
    transfers: "転送",
    transferCount: (count) => `${count} 件`,
    transferUpload: "アップロード",
    transferDownload: "ダウンロード",
    clearTransfer: "クリア",
    settingsDescription: "アプリ設定と接続のデフォルト値。",
    general: "一般",
    projects: "プロジェクト",
    projectsDescription: "再利用できるプロジェクト項目とローカルワークスペースのパスを管理します。",
    addProject: "プロジェクトを追加",
    noProjects: "まだプロジェクトがありません",
    noProjectsDescription: "プロジェクト名、名前空間、ローカルパスを保存する項目を作成します。",
    projectName: "プロジェクト名",
    projectNameDescription: "このプロジェクトの表示名です。",
    projectNamespace: "名前空間 / オーナー",
    projectNamespaceDescription: "任意の owner、組織、またはワークスペースの分類です。",
    projectPath: "ローカルパス",
    projectPathDescription: "このプロジェクトに対応するローカルワークスペースのパス（任意）。",
    projectType: "プロジェクト種別",
    projectTypeDescription: "このプロジェクトをローカル作業用、サーバー管理用、または両方に使うか選択します。",
    localProject: "ローカルプロジェクト",
    serverProject: "サーバープロジェクト",
    hybridProject: "ハイブリッドプロジェクト",
    newProject: "新規プロジェクト",
    editProject: "プロジェクトを編集",
    saveProject: "プロジェクトを保存",
    projectNameRequired: "プロジェクト名は必須です",
    projectAdded: (name) => `プロジェクト ${name} を追加しました`,
    projectUpdated: (name) => `プロジェクト ${name} を更新しました`,
    projectRemoved: (name) => `プロジェクト ${name} を削除しました`,
    cancel: "キャンセル",
    appTheme: "アプリテーマ",
    appThemeDescription: "ライトまたはダークの外観を選択します。",
    language: "言語",
    languageDescription: "デスクトップアプリの表示言語です。",
    connection: "接続",
    sshDefaults: "SSH デフォルト",
    sshDefaultsDescription: "接続タイムアウトと keepalive のデフォルト設定。",
    sshConnectTimeout: "接続タイムアウト",
    sshConnectTimeoutDescription: "新しい SSH 接続がタイムアウトするまでの待機時間です。",
    sshKeepaliveInterval: "キープアライブ間隔",
    sshKeepaliveIntervalDescription: "リモートホストへ keepalive パケットを送る間隔です。",
    secondsValue: (value) => `${value} 秒`,
    appliedSshDefaults: (connectTimeout, keepaliveInterval) => `SSH デフォルトを ${connectTimeout} 秒 / ${keepaliveInterval} 秒に設定しました`,
    terminal: "ターミナル",
    terminalDescription: "ローカルシェルとターミナル表示を調整します。",
    terminalFontSize: "ターミナルフォントサイズ",
    terminalFontSizeDescription: "ターミナルタブで使うフォントサイズを選択します。",
    terminalCharset: "ターミナル文字コード",
    terminalCharsetDescription: "ターミナル出力バイト列のデコード方式を選択します。中国語サーバーで特に有効です。",
    terminalTheme: "ターミナルテーマ",
    selected: "選択中",
    select: "選択",
    about: "情報",
    appDescription: "macOS 向けのリモートサーバーワークベンチ。",
    softwareUpdate: "ソフトウェア更新",
    softwareUpdateAvailable: (version) => `バージョン ${version} をダウンロードできます。`,
    softwareUpdateChecking: "GitHub リリース情報を確認中...",
    softwareUpdateDefault: "新しいデスクトップ版があるか確認します。",
    viewUpdate: "更新を見る",
    checkNow: "今すぐ確認",
    dangerZone: "危険ゾーン",
    clearLocalData: "ローカルデータを削除",
    clearLocalDataDescription: "この Mac に保存されたホストと設定を削除します。",
    clearing: "削除中...",
    clearData: "データを削除",
    quickConnect: "クイック接続",
    commandPalettePlaceholder: "ホストを検索、または user@host:port を入力…",
    commandPaletteNoResults: "一致するホストがありません",
    commandPaletteRecent: "最近の接続",
    commandPaletteHosts: "ホスト",
    commandPaletteActions: "アクション",
    commandPaletteQuickConnect: "クイック接続",
    commandPaletteTemporary: "一時接続（保存されません）",
    commandPaletteOpenSftp: "SFTP を開く",
    commandPaletteTestConnection: "接続テスト",
    commandPaletteEditHost: "ホストを編集",
    commandPaletteFooter: "↑↓ 移動 · ↵ 接続 · Tab SFTP · Esc 閉じる",
    editHostDetails: "ホスト詳細を編集",
    collaborate: "共同作業",
    moveTo: "移動先",
    copyTo: "コピー先",
    duplicate: "複製",
    copyLink: "リンクをコピー",
    remove: "削除",
    upload: "アップロード",
    download: "ダウンロード",
    updateAvailable: "アップデートがあります",
    currentVersionToNewVersion: (currentVersion, nextVersion) => `現在のバージョン ${currentVersion} → 新しいバージョン ${nextVersion}`,
    updateSummary: "ダウンロードするとバックグラウンドで静かにインストールされます。再起動すると新しいバージョンに切り替わります。",
    whatsNew: "更新内容",
    noReleaseNotes: "このバージョンのリリースノートはありません。",
    status: "状態",
    updateInstalledRestart: "アップデートのダウンロードとインストールが完了しました。再起動して完了します。",
    downloadingAndInstalling: "アップデートをダウンロードしてインストール中...",
    readyToDownloadUpdate: "このアップデートをダウンロードできます。",
    preparingDownload: "ダウンロードを準備中...",
    later: "あとで",
    downloading: "ダウンロード中...",
    downloadedState: "ダウンロード済み",
    restart: "再起動"
  }
};

export function getDocumentLanguageTag(language: AppLanguage) {
  if (language === "zh") return "zh-CN";
  if (language === "ja") return "ja";
  return "en";
}
