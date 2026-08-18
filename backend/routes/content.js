const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { ContentItem, Submission, User, Course } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { uploadFileToDrive } = require('../utils/drive');
const { createCertificatePDF } = require('../utils/pdf');
const multer = require('multer');

// Ensure uploads/media directory exists
const uploadDir = path.join(__dirname, '../uploads/media');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Disk storage for streaming video / PDF uploads (zero JS heap memory)
const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '';
        cb(null, 'media-' + uniqueSuffix + ext);
    }
});

const diskUpload = multer({
    storage: diskStorage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB limit per file
});

const memoryUpload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/v1/content/upload
 * Binary disk upload for large videos, PDFs, and notes (prevents memory crash)
 */
router.post('/upload', authMiddleware, diskUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ detail: "No file uploaded" });
        }
        const fileUrl = `/uploads/media/${req.file.filename}`;
        res.json({
            fileUrl,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        });
    } catch (err) {
        console.error("Content file upload error:", err);
        res.status(500).json({ detail: "Failed to upload file" });
    }
});

/**
 * POST /api/v1/content
 * Create content item
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const contentValue = req.body.url || req.body.data_url || req.body.content || "";
        const new_content = await ContentItem.create({
            title: req.body.title,
            type: req.body.type,
            module_id: req.body.module_id,
            duration: req.body.duration || 0,
            is_mandatory: req.body.is_mandatory || false,
            instructions: req.body.instructions || null,
            test_config: req.body.test_config || null,
            content: contentValue,
            order: req.body.order || 0
        });
        res.json({ message: "Content added", id: new_content.id, content: new_content });
    } catch (error) {
        console.error("Create content error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

/**
 * GET /api/v1/content/media/:id
 * Stream content (supports both disk-stored files and legacy base64 data)
 */
router.get('/media/:id', async (req, res) => {
    try {
        const item = await ContentItem.findByPk(req.params.id);
        if (!item || !item.content) return res.status(404).json({ detail: "Media not found" });

        // Case 1: Disk file stored in /uploads/media
        if (item.content.startsWith('/uploads/') || item.content.startsWith('uploads/')) {
            const relativePath = item.content.startsWith('/') ? item.content.substring(1) : item.content;
            const filePath = path.join(__dirname, '..', relativePath);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ detail: "File not found on server disk" });
            }

            const stat = fs.statSync(filePath);
            const fileSize = stat.size;
            const range = req.headers.range;

            let contentType = 'application/octet-stream';
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.mp4') contentType = 'video/mp4';
            else if (ext === '.webm') contentType = 'video/webm';
            else if (ext === '.pdf') contentType = 'application/pdf';
            else if (ext === '.png') contentType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(filePath, { start, end });

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': contentType,
                    'Content-Disposition': 'inline'
                });
                file.pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': contentType,
                    'Accept-Ranges': 'bytes',
                    'Content-Disposition': 'inline'
                });
                fs.createReadStream(filePath).pipe(res);
            }
            return;
        }

        // Case 2: Base64 data URI
        if (item.content.startsWith('data:')) {
            const parts = item.content.split(',');
            const match = parts[0].match(/:(.*?);/);
            const mimeType = match ? match[1] : 'application/octet-stream';
            const base64Data = parts[1];
            
            const buffer = Buffer.from(base64Data, 'base64');
            const totalLength = buffer.length;
            
            const range = req.headers.range;
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
                
                const chunksize = (end - start) + 1;
                const file = buffer.slice(start, end + 1);
                
                res.status(206).set({
                    'Content-Range': `bytes ${start}-${end}/${totalLength}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': mimeType,
                    'Content-Disposition': 'inline'
                }).send(file);
            } else {
                res.status(200).set({
                    'Content-Length': totalLength,
                    'Content-Type': mimeType,
                    'Accept-Ranges': 'bytes',
                    'Content-Disposition': 'inline'
                }).send(buffer);
            }
            return;
        }

        // Case 3: External URL redirect
        if (item.content.startsWith('http://') || item.content.startsWith('https://')) {
            return res.redirect(item.content);
        }

        res.status(200).set({ 'Content-Type': 'text/plain; charset=utf-8' }).send(item.content);
    } catch (error) {
        console.error("Media streaming error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.post('/assignment-upload', authMiddleware, memoryUpload.single('file'), async (req, res) => {
    try {
        const { folder_link, lesson_id } = req.body;
        if (!req.file) return res.status(400).json({ detail: "No file uploaded" });

        const fileId = await uploadFileToDrive(req.file.buffer, req.file.originalname, folder_link, req.file.mimetype);
        if (!fileId) return res.status(500).json({ detail: "Failed to upload to Google Drive" });

        const drive_link = `https://drive.google.com/file/d/${fileId}/view`;

        await Submission.create({
            user_id: req.user.id,
            content_item_id: lesson_id,
            drive_link: drive_link,
            status: "Pending"
        });

        res.json({ message: "Assignment uploaded successfully!", link: drive_link });
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/certificate/:course_id', authMiddleware, async (req, res) => {
    try {
        const course = await Course.findByPk(req.params.course_id);
        if (!course) return res.status(404).json({ detail: "Course not found" });

        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
        
        const pdfBuffer = await createCertificatePDF(req.user.full_name.toUpperCase(), course.title.toUpperCase(), dateStr);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${req.user.full_name}_Certificate.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const item = await ContentItem.findByPk(req.params.id);
        if (!item) return res.status(404).json({ detail: "Not found" });
        
        const updatedContent = req.body.url !== undefined ? req.body.url : (req.body.content !== undefined ? req.body.content : item.content);
        await item.update({
            title: req.body.title || item.title,
            content: updatedContent,
            duration: req.body.duration !== undefined ? req.body.duration : item.duration,
            is_mandatory: req.body.is_mandatory !== undefined ? req.body.is_mandatory : item.is_mandatory,
            instructions: req.body.instructions !== undefined ? req.body.instructions : item.instructions
        });
        res.json({ message: "Updated" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const item = await ContentItem.findByPk(req.params.id);
        if (!item) return res.status(404).json({ detail: "Not found" });
        
        // If it's a disk file, clean it up from disk
        if (item.content && (item.content.startsWith('/uploads/') || item.content.startsWith('uploads/'))) {
            const relPath = item.content.startsWith('/') ? item.content.substring(1) : item.content;
            const fullPath = path.join(__dirname, '..', relPath);
            if (fs.existsSync(fullPath)) {
                try { fs.unlinkSync(fullPath); } catch (e) {}
            }
        }

        await item.destroy();
        res.json({ message: "Deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
