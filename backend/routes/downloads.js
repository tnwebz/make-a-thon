const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { findClient } = require('./share_sessions');

const DOWNLOADS_DIR = path.join(__dirname, '..', 'public', 'downloads');

/**
 * Helper to stream a file with live progress tracking on the client
 */
function streamFileWithProgress(filePath, fileName, contentType, req, res) {
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ detail: `File ${fileName} not found on server.` });
    }

    const stat = fs.statSync(filePath);
    const totalBytes = stat.size;

    const shareCode = req.query.shareCode;
    const clientId = req.query.clientId;
    const client = typeof findClient === 'function' ? findClient(shareCode, clientId) : null;

    if (client) {
        client.downloadProgress = {
            fileName,
            bytesTransferred: 0,
            totalBytes,
            percent: 0,
            status: 'DOWNLOADING',
            speed: '0 MB/s',
            startedAt: Date.now(),
            updatedAt: new Date().toISOString()
        };
    }

    res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': totalBytes
    });

    let bytesSent = 0;
    let lastUpdate = Date.now();
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
        bytesSent += chunk.length;
        const now = Date.now();
        if (client && (now - lastUpdate > 150 || bytesSent >= totalBytes)) {
            lastUpdate = now;
            const percent = totalBytes > 0 
                ? Math.min(99, Math.round((bytesSent / totalBytes) * 100)) 
                : 50;
            const elapsedSec = (now - (client.downloadProgress?.startedAt || now)) / 1000;
            const speed = elapsedSec > 0 ? (bytesSent / (1024 * 1024 * elapsedSec)).toFixed(1) + ' MB/s' : '0 MB/s';

            client.downloadProgress = {
                ...client.downloadProgress,
                bytesTransferred: bytesSent,
                totalBytes,
                percent,
                speed,
                status: 'DOWNLOADING',
                updatedAt: new Date().toISOString()
            };
        }
    });

    res.on('finish', () => {
        if (client) {
            const elapsedSec = (Date.now() - (client.downloadProgress?.startedAt || Date.now())) / 1000;
            const avgSpeed = elapsedSec > 0 ? (bytesSent / (1024 * 1024 * elapsedSec)).toFixed(1) + ' MB/s' : '';
            client.downloadProgress = {
                ...client.downloadProgress,
                bytesTransferred: totalBytes,
                totalBytes,
                percent: 100,
                status: 'COMPLETED',
                speed: avgSpeed,
                completedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
    });

    req.on('close', () => {
        if (client && client.downloadProgress?.status === 'DOWNLOADING') {
            client.downloadProgress.status = 'CANCELLED';
            client.downloadProgress.updatedAt = new Date().toISOString();
        }
    });

    stream.pipe(res);
}

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
 * Direct 1-click download of the native Android APK over HTTP LAN with progress tracking
 */
router.get('/android-apk', (req, res) => {
    const apkPath = path.join(DOWNLOADS_DIR, 'SkillForge-Offline.apk');
    streamFileWithProgress(apkPath, 'SkillForge-Offline.apk', 'application/vnd.android.package-archive', req, res);
});

/**
 * GET /api/v1/downloads/windows-app
 * Direct 1-click download of the native Windows Installer over HTTP LAN with progress tracking
 */
router.get('/windows-app', (req, res) => {
    const exePath = path.join(DOWNLOADS_DIR, 'SkillForge-Offline-Setup.exe');
    const portablePath = path.join(DOWNLOADS_DIR, 'SkillForge-Offline.exe');
    const targetFile = fs.existsSync(exePath) ? exePath : fs.existsSync(portablePath) ? portablePath : null;

    if (targetFile) {
        streamFileWithProgress(targetFile, path.basename(targetFile), 'application/octet-stream', req, res);
    } else {
        res.status(404).json({ detail: 'Windows Desktop installer not found. Please compile the native app.' });
    }
});

module.exports = router;
