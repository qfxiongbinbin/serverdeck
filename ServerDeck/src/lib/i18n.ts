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
  showRaw: string;
  fileNameColumn: string;
  fileSizeColumn: string;
  fileKindColumn: string;
  fileAddedDateColumn: string;
  folderKind: string;
  fileKindFallback: string;
  homeDirectory: string;
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
  password: string;
  privateKeyPath: string;
  working: string;
  testSsh: string;
  save: string;
  delete: string;
  sftpDescription: string;
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
    showRaw: "Raw",
    fileNameColumn: "Name",
    fileSizeColumn: "Size",
    fileKindColumn: "Kind",
    fileAddedDateColumn: "Added Date",
    folderKind: "Folder",
    fileKindFallback: "File",
    homeDirectory: "Home",
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
    password: "Password",
    privateKeyPath: "Private Key Path",
    working: "Working...",
    testSsh: "Test SSH",
    save: "Save",
    delete: "Delete",
    sftpDescription: "Choose a host before browsing remote files.",
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
    showRaw: "原文",
    fileNameColumn: "名称",
    fileSizeColumn: "大小",
    fileKindColumn: "种类",
    fileAddedDateColumn: "添加日期",
    folderKind: "文件夹",
    fileKindFallback: "文件",
    homeDirectory: "家目录",
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
    password: "密码",
    privateKeyPath: "私钥路径",
    working: "处理中...",
    testSsh: "测试 SSH",
    save: "保存",
    delete: "删除",
    sftpDescription: "浏览远程文件前请先选择一台主机。",
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
    showRaw: "原文",
    fileNameColumn: "名前",
    fileSizeColumn: "サイズ",
    fileKindColumn: "種類",
    fileAddedDateColumn: "追加日",
    folderKind: "フォルダ",
    fileKindFallback: "ファイル",
    homeDirectory: "ホーム",
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
    password: "パスワード",
    privateKeyPath: "秘密鍵パス",
    working: "処理中...",
    testSsh: "SSH をテスト",
    save: "保存",
    delete: "削除",
    sftpDescription: "リモートファイルを閲覧する前にホストを選択してください。",
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
