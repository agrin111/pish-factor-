/**
 * ابزارهای کمکی بررسی نسخه و جایگزینی امن فایل اجرایی در ویندوز
 */

const GITHUB_OWNER = 'agrin111';
const GITHUB_REPO = 'pish-factor-';
const GITHUB_LATEST_YML_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/latest.yml`;
const GITHUB_LATEST_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

/**
 * تجزیه نسخه سمنتیک (مثلاً 1.0.8 یا v1.0.8-beta.1)
 * @param {string} raw
 */
function parseSemver(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    normalized: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}${match[4] ? `-${match[4]}` : ''}`,
  };
}

/**
 * مقایسه دو نسخه سمنتیک:
 * خروجی > 0 یعنی a جدیدتر از b است
 * خروجی < 0 یعنی a قدیمی‌تر از b است
 * خروجی === 0 یعنی برابرند
 * @param {string} a
 * @param {string} b
 */
function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;

  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0;
  if (pa.prerelease.length === 0) return 1;
  if (pb.prerelease.length === 0) return -1;

  const len = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < len; i++) {
    const segA = pa.prerelease[i];
    const segB = pb.prerelease[i];
    if (segA === undefined) return -1;
    if (segB === undefined) return 1;
    const numA = /^\d+$/.test(segA) ? Number(segA) : null;
    const numB = /^\d+$/.test(segB) ? Number(segB) : null;
    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA - numB;
    } else if (numA !== null) {
      return -1;
    } else if (numB !== null) {
      return 1;
    } else if (segA !== segB) {
      return segA < segB ? -1 : 1;
    }
  }
  return 0;
}

/**
 * استخراج شماره نسخه از فایل latest.yml
 * @param {string} yamlText
 */
function parseLatestYmlVersion(yamlText) {
  if (typeof yamlText !== 'string') return null;
  const match = yamlText.match(/^\s*version\s*:\s*['"]?([^\r\n'"]+)['"]?\s*$/m);
  if (!match) return null;
  const parsed = parseSemver(match[1]);
  return parsed ? parsed.normalized : null;
}

/**
 * ساخت آدرس دانلود فایل اجرایی پرتابل برای یک نسخه مشخص
 * @param {string} version
 */
function buildPortableAssetUrl(version) {
  const parsed = parseSemver(version);
  const clean = parsed ? parsed.normalized : String(version || '').trim().replace(/^v/i, '');
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${clean}/AghrinPishFactor-Portable-${clean}.exe`;
}

/**
 * بررسی هدر فایل اجرایی ویندوز (PE / MZ)
 * @param {Buffer | Uint8Array} headerBytes
 */
function isValidPeHeader(headerBytes) {
  if (!headerBytes || headerBytes.length < 2) return false;
  return headerBytes[0] === 0x4d && headerBytes[1] === 0x5a;
}

/**
 * تولید اسکریپت PowerShell برای جایگزینی اتمیک فایل اجرایی پس از خروج کامل برنامه.
 * مسیرها از طریق متغیرهای محیطی خوانده می‌شوند تا نام پوشه‌های فارسی یا دارای فاصله مشکل ایجاد نکند.
 */
function buildPortableReplaceScript() {
  return [
    '$ErrorActionPreference = "Stop"',
    '$oldPid = 0',
    '[void][int]::TryParse($env:AGHRIN_OLD_PID, [ref]$oldPid)',
    '$targetExe = $env:AGHRIN_TARGET_EXE',
    '$newExe = $env:AGHRIN_NEW_EXE',
    '$backupExe = $env:AGHRIN_BACKUP_EXE',
    '$stagedTarget = "$targetExe.new"',
    '',
    'function Show-UpdateFailure([string]$msg) {',
    '  try {',
    '    Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue',
    '    [System.Windows.Forms.MessageBox]::Show($msg, "Aghrin PishFactor", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null',
    '  } catch {}',
    '}',
    '',
    'try {',
    '  if ($oldPid -gt 0) {',
    '    for ($i = 0; $i -lt 60; $i++) {',
    '      $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue',
    '      if (-not $proc) { break }',
    '      Start-Sleep -Milliseconds 500',
    '    }',
    '  }',
    '  Start-Sleep -Milliseconds 500',
    '',
    '  if (-not (Test-Path -LiteralPath $newExe)) {',
    '    throw "New executable file not found."',
    '  }',
    '  $expectedSize = (Get-Item -LiteralPath $newExe).Length',
    '  if ($expectedSize -lt 10485760) {',
    '    throw "Downloaded executable is incomplete or invalid."',
    '  }',
    '',
    '  $replaced = $false',
    '  $lastError = $null',
    '  for ($attempt = 0; $attempt -lt 12; $attempt++) {',
    '    try {',
    '      if (Test-Path -LiteralPath $stagedTarget) { Remove-Item -LiteralPath $stagedTarget -Force -ErrorAction SilentlyContinue }',
    '      Copy-Item -LiteralPath $newExe -Destination $stagedTarget -Force',
    '      if ((Get-Item -LiteralPath $stagedTarget).Length -ne $expectedSize) {',
    '        throw "Staged executable size mismatch."',
    '      }',
    '      if (Test-Path -LiteralPath $targetExe) {',
    '        if (Test-Path -LiteralPath $backupExe) { Remove-Item -LiteralPath $backupExe -Force -ErrorAction SilentlyContinue }',
    '        Move-Item -LiteralPath $targetExe -Destination $backupExe -Force',
    '      }',
    '      Move-Item -LiteralPath $stagedTarget -Destination $targetExe -Force',
    '      if ((Get-Item -LiteralPath $targetExe).Length -ne $expectedSize) {',
    '        throw "Replaced executable size verification failed."',
    '      }',
    '      $replaced = $true',
    '      break',
    '    } catch {',
    '      $lastError = $_',
    '      if (-not (Test-Path -LiteralPath $targetExe) -and (Test-Path -LiteralPath $backupExe)) {',
    '        try { Move-Item -LiteralPath $backupExe -Destination $targetExe -Force } catch {}',
    '      }',
    '      Start-Sleep -Milliseconds 600',
    '    }',
    '  }',
    '',
    '  if (-not $replaced) {',
    '    if ($lastError) { throw $lastError }',
    '    throw "Could not replace executable."',
    '  }',
    '',
    '  if (Test-Path -LiteralPath $backupExe) { Remove-Item -LiteralPath $backupExe -Force -ErrorAction SilentlyContinue }',
    '  if (Test-Path -LiteralPath $newExe) { Remove-Item -LiteralPath $newExe -Force -ErrorAction SilentlyContinue }',
    '  $workDir = Split-Path -Parent $targetExe',
    '  Start-Process -FilePath $targetExe -WorkingDirectory $workDir',
    '} catch {',
    '  if (-not (Test-Path -LiteralPath $targetExe) -and (Test-Path -LiteralPath $backupExe)) {',
    '    try { Move-Item -LiteralPath $backupExe -Destination $targetExe -Force } catch {}',
    '  }',
    '  Show-UpdateFailure ("به‌روزرسانی فایل اجرایی انجام نشد و نسخه قبلی حفظ گردید.`r`n" + $_.Exception.Message)',
    '  if (Test-Path -LiteralPath $targetExe) {',
    '    $workDir = Split-Path -Parent $targetExe',
    '    try { Start-Process -FilePath $targetExe -WorkingDirectory $workDir } catch {}',
    '  }',
    '} finally {',
    '  try { Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue } catch {}',
    '}',
    '',
  ].join('\r\n');
}

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_LATEST_YML_URL,
  GITHUB_LATEST_API_URL,
  parseSemver,
  compareSemver,
  parseLatestYmlVersion,
  buildPortableAssetUrl,
  isValidPeHeader,
  buildPortableReplaceScript,
};
