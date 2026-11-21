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

export interface PishfactorDesktopBridge {
  isDesktop: true;
  getUpdateState: () => Promise<DesktopUpdateState>;
  checkForUpdates: () => Promise<DesktopUpdateState>;
  installUpdate: () => Promise<void>;
  openReleasesPage: () => Promise<void>;
  onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
}

declare global {
  interface Window {
    pishfactorDesktop?: PishfactorDesktopBridge;
  }
}
