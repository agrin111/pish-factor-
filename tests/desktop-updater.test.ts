import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  compareSemver,
  parseLatestYmlVersion,
  buildPortableAssetUrl,
  isValidPeHeader,
  buildPortableReplaceScript,
} = require('../desktop/update-utils.cjs');
const { AutoUpdater } = require('../desktop/auto-updater.cjs');

describe('بررسی نسخه در پس‌زمینه و جایگزینی فایل اجرایی', () => {
  it('نسخه‌های سمنتیک را به‌درستی مقایسه می‌کند تا از بازگشت به نسخه قدیمی جلوگیری شود', () => {
    expect(compareSemver('1.0.8', '1.0.6')).toBeGreaterThan(0);
    expect(compareSemver('1.0.10', '1.0.9')).toBeGreaterThan(0);
    expect(compareSemver('v1.1.0', '1.0.99')).toBeGreaterThan(0);
    expect(compareSemver('1.0.8', '1.0.8')).toBe(0);
    expect(compareSemver('1.0.6', '1.0.8')).toBeLessThan(0);
    expect(compareSemver('1.0.8-beta.1', '1.0.8')).toBeLessThan(0);
  });

  it('شماره نسخه را از محتوای latest.yml استخراج می‌کند', () => {
    const sampleYml = `
version: 1.0.8
files:
  - url: AghrinPishFactor-Setup-1.0.8.exe
    sha512: abc
    size: 12345
path: AghrinPishFactor-Setup-1.0.8.exe
`;
    expect(parseLatestYmlVersion(sampleYml)).toBe('1.0.8');
    expect(parseLatestYmlVersion("version: 'v1.2.3'\n")).toBe('1.2.3');
    expect(parseLatestYmlVersion('invalid yaml without version')).toBeNull();
  });

  it('آدرس فایل اجرایی پرتابل و هدر PE ویندوز را درست بررسی می‌کند', () => {
    expect(buildPortableAssetUrl('1.0.8')).toBe(
      'https://github.com/agrin111/pish-factor-/releases/download/v1.0.8/AghrinPishFactor-Portable-1.0.8.exe',
    );
    expect(isValidPeHeader(Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]))).toBe(true);
    expect(isValidPeHeader(Buffer.from('<!DOCTYPE html>'))).toBe(false);
  });

  it('اسکریپت جایگزینی فایل اجرایی دارای انتظار خروج، پشتیبان‌گیری و بازگشت خودکار در خطا است', () => {
    const script = buildPortableReplaceScript();
    expect(script).toContain('$env:AGHRIN_OLD_PID');
    expect(script).toContain('$env:AGHRIN_TARGET_EXE');
    expect(script).toContain('$env:AGHRIN_NEW_EXE');
    expect(script).toContain('$env:AGHRIN_BACKUP_EXE');
    expect(script).toContain('Get-Process -Id $oldPid');
    expect(script).toContain('Start-Process -FilePath $targetExe');
    expect(script).toContain('Remove-Item -LiteralPath $PSCommandPath');
  });

  it('سرویس AutoUpdater در پس‌زمینه فقط متادیتا را چک می‌کند و منتظر تأیید کاربر می‌ماند', async () => {
    const states: Array<Record<string, unknown>> = [];
    const sent: Array<{ channel: string; payload: { status?: string } }> = [];
    const fakeSession = {
      fromPartition: () => ({
        fetch: async () => ({
          ok: true,
          text: async () => 'version: 1.2.0\n',
        }),
      }),
    };
    const updater = new AutoUpdater({
      app: {
        isPackaged: true,
        getVersion: () => '1.0.8',
        getPath: () => '/tmp',
      },
      dialog: {
        showMessageBox: async () => ({ response: 1 }),
        showErrorBox: () => {},
      },
      shell: {
        openPath: async () => '',
        showItemInFolder: () => {},
      },
      session: fakeSession,
      getMainWindow: () => ({
        isDestroyed: () => false,
        webContents: {
          send: (channel: string, payload: { status?: string }) => sent.push({ channel, payload }),
        },
      }),
      shutdown: async () => {},
      onExitApp: () => {},
      onStateChange: (s: Record<string, unknown>) => states.push(s),
    });

    updater.isPortable = true;
    updater.canReplacePortableExe = true;
    updater.controller = updater.initPortableController();

    const finalState = await updater.checkForUpdates(false);
    expect(finalState.status).toBe('available');
    expect(finalState.availableVersion).toBe('1.2.0');
    expect(updater.isDownloading).toBe(false);
    expect(states.length).toBeGreaterThan(0);
    expect(
      sent.some((item) => item.channel === 'updater:state-changed' && item.payload.status === 'available'),
    ).toBe(true);
  });
});
