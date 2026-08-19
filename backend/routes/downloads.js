const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DOWNLOADS_DIR = path.join(__dirname, '..', 'public', 'downloads');

/**
 * GET /api/v1/downloads/status
 * Returns availability of native client installers
 */
router.get('/status', (req, res) => {
    const apkPath = path.join(DOWNLOADS_DIR, 'SkillForge-Offline.apk');
    const exePath = path.join(DOWNLOADS_DIR, 'SkillForge-Offline-Setup.exe');

    res.json({
        android: fs.existsSync(apkPath),
        windows: fs.existsSync(exePath),
        apkSize: fs.existsSync(apkPath) ? fs.statSync(apkPath).size : 0,
        exeSize: fs.existsSync(exePath) ? fs.statSync(exePath).size : 0,
    });
});

/**
 * GET /api/v1/downloads/android-apk
 * Direct 1-click download of the native Android APK over HTTP LAN
 */
router.get('/android-apk', (req, res) => {
    const apkPath = path.join(DOWNLOADS_DIR, 'SkillForge-Offline.apk');
    if (fs.existsSync(apkPath)) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="SkillForge-Offline.apk"');
        res.download(apkPath, 'SkillForge-Offline.apk');
    } else {
        res.status(404).json({ detail: 'Android APK build not found. Please compile the native app.' });
    }
});

/**
 * GET /api/v1/downloads/windows-app
 * Direct 1-click download of the native Windows Installer over HTTP LAN
 */
router.get('/windows-app', (req, res) => {
    const exePath = path.join(DOWNLOADS_DIR, 'SkillForge-Offline-Setup.exe');
    const portablePath = path.join(DOWNLOADS_DIR, 'SkillForge-Offline.exe');
    const targetFile = fs.existsSync(exePath) ? exePath : fs.existsSync(portablePath) ? portablePath : null;

    if (targetFile) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(targetFile)}"`);
        res.download(targetFile, path.basename(targetFile));
    } else {
        res.status(404).json({ detail: 'Windows Desktop installer not found. Please compile the native app.' });
    }
});

module.exports = router;
