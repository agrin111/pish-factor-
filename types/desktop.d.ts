export type DesktopUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'portable-available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'
  | 'unsupported';

export interface DesktopUpdateState {
  status: DesktopUpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  percent?: number;
  message?: string;
  isPortable?: boolean;
}

export interface DesktopPrintResult {
  ok: boolean;
  canceled?: boolean;
  error?: string;
}

export interface DesktopSavePdfResult {
  ok: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface PishfactorDesktopBridge {
  isDesktop: true;
  getUpdateState: () => Promise<DesktopUpdateState>;
  checkForUpdates: () => Promise<DesktopUpdateState>;
  installUpdate: () => Promise<void>;
  openReleasesPage: () => Promise<void>;
  printDocument?: (pageSize: 'A4' | 'A5') => Promise<DesktopPrintResult>;
  savePdf?: (bytes: Uint8Array, defaultFileName: string) => Promise<DesktopSavePdfResult>;
  openFilePath?: (filePath: string) => Promise<boolean>;
  saveSharePdf?: (bytes: Uint8Array, defaultFileName: string) => Promise<DesktopSavePdfResult>;
  showItemInFolder?: (filePath: string) => Promise<boolean>;
  openExternal?: (url: string) => Promise<boolean>;
  writeClipboard?: (text: string) => Promise<boolean>;
  onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
}

declare global {
  interface Window {
    pishfactorDesktop?: PishfactorDesktopBridge;
  }
}
