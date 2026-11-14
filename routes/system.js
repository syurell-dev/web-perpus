const express = require('express');
const router = express.Router();
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const pkg = require('../package.json');

const REPO = 'syurell-dev/web-perpus';
const CURRENT_VERSION = pkg.version;

// Helper untuk download file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Gagal download: HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// GET /api/system/check-update
router.get('/check-update', (req, res) => {
  const url = `https://api.github.com/repos/${REPO}/releases/latest`;
  const options = { headers: { 'User-Agent': 'Web-Perpus-Updater' } };

  https.get(url, options, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      try {
        const release = JSON.parse(data);
        const latestVersion = release.tag_name.replace('v', '');
        
        if (latestVersion !== CURRENT_VERSION) {
          const isWindows = process.platform === 'win32';
          const assetName = isWindows ? `app-windows-v${latestVersion}.zip` : `app-linux-v${latestVersion}.zip`;
          const asset = release.assets.find(a => a.name === assetName);

          if (asset) {
            return res.json({ 
              status: 'ok', 
              hasUpdate: true, 
              current: CURRENT_VERSION, 
              latest: latestVersion,
              downloadUrl: asset.browser_download_url
            });
          }
        }
        res.json({ status: 'ok', hasUpdate: false, current: CURRENT_VERSION });
      } catch (err) {
        res.status(500).json({ status: 'error', message: 'Gagal memproses data dari GitHub' });
      }
    });
  }).on('error', () => res.status(500).json({ status: 'error', message: 'Gagal terhubung ke GitHub' }));
});

// POST /api/system/apply-update
router.post('/apply-update', async (req, res) => {
  const { downloadUrl, latestVersion } = req.body;
  if (!downloadUrl) return res.status(400).json({ status: 'error', message: 'URL tidak valid' });

  const isWindows = process.platform === 'win32';
  const rootDir = path.join(__dirname, '..');
  const tempZip = path.join(rootDir, 'update.zip');
  const tempDir = path.join(rootDir, 'update-temp');

  try {
    res.json({ status: 'ok', message: 'Update sedang diunduh. Server akan restart otomatis...' });

    // 1. Download ZIP
    await downloadFile(downloadUrl, tempZip);

    // 2. Buat script updater (BAT untuk Windows, SH untuk Linux)
    if (isWindows) {
      const batPath = path.join(rootDir, 'updater.bat');
      const batScript = `
@echo off
timeout /t 3 /nobreak >nul
powershell -command "Expand-Archive -Path 'update.zip' -DestinationPath 'update-temp' -Force"
xcopy /s /y /i "update-temp\\*" ".\\" /EXCLUDE:exclude.txt
rd /s /q update-temp
del update.zip
del exclude.txt
del updater.bat
start "" start.bat
exit
`;
      // Buat file exclude agar folder database tidak tertimpa
      fs.writeFileSync(path.join(rootDir, 'exclude.txt'), '\\database\\\n');
      fs.writeFileSync(batPath, batScript);
      
      // Jalankan script dan matikan server saat ini
      spawn('cmd.exe', ['/c', 'start', 'updater.bat'], { detached: true, stdio: 'ignore' }).unref();
    } else {
      // Logic untuk Linux
      const shPath = path.join(rootDir, 'updater.sh');
      const shScript = `
#!/bin/bash
sleep 3
unzip -o update.zip -d update-temp
rsync -a --exclude 'database/' update-temp/ ./
rm -rf update-temp update.zip updater.sh
./start.sh
`;
      fs.writeFileSync(shPath, shScript);
      fs.chmodSync(shPath, '755');
      spawn('bash', [shPath], { detached: true, stdio: 'ignore' }).unref();
    }

    // Beri jeda sedikit agar response HTTP terkirim ke frontend
    setTimeout(() => {
      process.exit(0);
    }, 1000);

  } catch (err) {
    if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
    res.status(500).json({ status: 'error', message: 'Gagal update: ' + err.message });
  }
});

module.exports = router;