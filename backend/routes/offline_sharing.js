const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const ytdl = require('@distube/ytdl-core');
const { authMiddleware } = require('../middleware/auth');

const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads');

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Download a YouTube video at 720p
router.post('/download', authMiddleware, async (req, res) => {
    try {
        const { url, title } = req.body;
        if (!url || !title) {
            return res.status(400).json({ detail: 'URL and title are required' });
        }

        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ detail: 'Invalid YouTube URL' });
        }

        // Create a safe filename
        const safeTitle = title.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').substring(0, 50);
        const filename = `${safeTitle}_${Date.now()}.mp4`;
        const filepath = path.join(DOWNLOADS_DIR, filename);

        const youtubedl = require('youtube-dl-exec');
        
        let videoTitle = title || 'Course Video';
        let thumbnail = '';

        try {
            console.log(`Starting real download for: ${url}`);
            
            // First get the info for thumbnail and precise title
            const info = await youtubedl(url, {
                dumpJson: true,
                noCheckCertificates: true,
                noWarnings: true
            });
            
            videoTitle = info.title || title;
            thumbnail = info.thumbnail || 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg';
            
            // Then execute the download to the filepath (using pre-merged to avoid ffmpeg requirement)
            await youtubedl(url, {
                f: 'best[ext=mp4]',
                o: filepath,
                noCheckCertificates: true,
                noWarnings: true
            });

            const stats = fs.statSync(filepath);
            const meta = {
                filename,
                title: videoTitle,
                originalUrl: url,
                thumbnail,
                size: stats.size,
                downloadedAt: new Date().toISOString(),
                downloadedBy: req.user.id
            };
            
            fs.writeFileSync(filepath + '.meta.json', JSON.stringify(meta, null, 2));
            res.json(meta);

        } catch (e) {
            console.error('Real YouTube download failed:', e);
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
            res.status(500).json({ detail: 'Failed to download real video' });
        }

    } catch (error) {
        console.error('Download endpoint error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

// List all downloaded videos
router.get('/downloads', authMiddleware, async (req, res) => {
    try {
        if (!fs.existsSync(DOWNLOADS_DIR)) {
            return res.json([]);
        }

        const metaFiles = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.endsWith('.meta.json'));
        const videos = metaFiles.map(f => {
            try {
                const meta = JSON.parse(fs.readFileSync(path.join(DOWNLOADS_DIR, f), 'utf8'));
                // Verify the actual video file still exists
                if (fs.existsSync(path.join(DOWNLOADS_DIR, meta.filename))) {
                    return meta;
                }
                return null;
            } catch { return null; }
        }).filter(Boolean);

        res.json(videos);
    } catch (error) {
        console.error('List downloads error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

// Serve a downloaded video file
router.get('/downloads/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        // Security: prevent directory traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ detail: 'Invalid filename' });
        }
        const filepath = path.join(DOWNLOADS_DIR, filename);
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ detail: 'File not found' });
        }

        const stat = fs.statSync(filepath);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const readStream = fs.createReadStream(filepath);
        readStream.pipe(res);
    } catch (error) {
        console.error('Serve file error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

// Delete a downloaded video
router.delete('/downloads/:filename', authMiddleware, async (req, res) => {
    try {
        const filename = req.params.filename;
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ detail: 'Invalid filename' });
        }
        const filepath = path.join(DOWNLOADS_DIR, filename);
        const metapath = filepath + '.meta.json';

        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        if (fs.existsSync(metapath)) fs.unlinkSync(metapath);

        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

// Get the server's local IP address
router.get('/local-ip', (req, res) => {
    try {
        const interfaces = os.networkInterfaces();
        let localIp = '127.0.0.1';

        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    localIp = iface.address;
                }
            }
        }

        res.json({ ip: localIp });
    } catch (error) {
        res.json({ ip: '127.0.0.1' });
    }
});

module.exports = router;
