const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ZipArchive } = require('archiver');
const { Course, Module, ContentItem, ShareSession, User, Enrollment } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { shareAuthMiddleware } = require('../middleware/share_auth');

const SECRET_KEY = process.env.SECRET_KEY || "supersecretkey_change_this_in_production";

// ============================================
// Rate Limiting (in-memory, per IP)
// ============================================
const rateLimitStore = {};
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max attempts per window

function checkRateLimit(ip) {
    const now = Date.now();
    if (!rateLimitStore[ip]) {
        rateLimitStore[ip] = { count: 1, windowStart: now };
        return true;
    }
    const entry = rateLimitStore[ip];
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        // Reset window
        entry.count = 1;
        entry.windowStart = now;
        return true;
    }
    entry.count++;
    return entry.count <= RATE_LIMIT_MAX;
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const ip of Object.keys(rateLimitStore)) {
        if (now - rateLimitStore[ip].windowStart > RATE_LIMIT_WINDOW_MS * 2) {
            delete rateLimitStore[ip];
        }
    }
}, 5 * 60 * 1000);

// ============================================
// Helpers
// ============================================

/**
 * Generate a unique 6-character uppercase alphanumeric share code
 */
function generateShareCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Generate an 8-character passkey
 */
function generatePasskey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = '';
    for (let i = 0; i < 8; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

/**
 * Get file extension from mime type in a base64 data URL
 */
function getExtFromDataUrl(dataUrl) {
    if (!dataUrl || !dataUrl.startsWith('data:')) return '.bin';
    const match = dataUrl.match(/data:([^;]+)/);
    if (!match) return '.bin';
    const mime = match[1];
    const mimeMap = {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/quicktime': '.mov',
        'application/pdf': '.pdf',
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/gif': '.gif',
        'text/plain': '.txt',
        'text/html': '.html',
        'application/octet-stream': '.bin'
    };
    return mimeMap[mime] || '.bin';
}

/**
 * Sanitize a filename for use in ZIP archives
 */
function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim();
}


// ============================================
// INSTRUCTOR ENDPOINTS (require JWT auth)
// ============================================

/**
 * POST /api/v1/share-sessions
 * Create a new share session for a course
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { courseId, accessMode } = req.body;

        if (!courseId) {
            return res.status(400).json({ detail: 'courseId is required' });
        }
        if (!['VIEW_ONLY', 'ALLOW_DOWNLOAD'].includes(accessMode)) {
            return res.status(400).json({ detail: 'accessMode must be VIEW_ONLY or ALLOW_DOWNLOAD' });
        }

        // Verify course exists and belongs to this instructor
        const course = await Course.findOne({
            where: { id: courseId, instructor_id: req.user.id }
        });
        if (!course) {
            return res.status(404).json({ detail: 'Course not found or unauthorized' });
        }

        // Generate unique share code
        let shareCode;
        let exists = true;
        while (exists) {
            shareCode = generateShareCode();
            const existing = await ShareSession.findOne({ where: { shareCode } });
            exists = !!existing;
        }

        // Generate passkey and hash it
        const passkey = generatePasskey();
        const salt = await bcrypt.genSalt(10);
        const passkeyHash = await bcrypt.hash(passkey, salt);

        const session = await ShareSession.create({
            shareCode,
            courseId,
            createdById: req.user.id,
            accessMode,
            passkeyHash,
            passkeyPlain: passkey,
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        // Build share URL using the request's host
        const protocol = req.protocol || 'http';
        const host = req.headers.host || 'localhost:5173';
        // Frontend runs on port 5173, backend on 8000
        const frontendHost = host.replace(':8000', ':5173');
        const shareUrl = `${protocol}://${frontendHost}/share/${shareCode}`;

        console.log(`🔗 Share session created: ${shareCode} for course "${course.title}" (${accessMode})`);

        res.status(201).json({
            id: session.id,
            shareCode,
            passkey, // Returned to instructor
            accessMode,
            shareUrl,
            courseTitle: course.title,
            status: 'ACTIVE',
            expiresAt: session.expiresAt,
            createdAt: session.createdAt
        });
    } catch (error) {
        console.error('Create share session error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

/**
 * GET /api/v1/share-sessions
 * List all share sessions for the instructor
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { courseId } = req.query;
        const where = { createdById: req.user.id };
        if (courseId) where.courseId = courseId;

        const sessions = await ShareSession.findAll({
            where,
            include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'image_url'] }],
            order: [['createdAt', 'DESC']]
        });

        // Auto-expire sessions that have passed their expiresAt
        const now = new Date();
        const result = sessions.map(s => {
            const data = s.toJSON();
            // Provide passkey so instructor can always view and copy it
            data.passkey = data.passkeyPlain || data.shareCode;
            if (data.status === 'ACTIVE' && data.expiresAt && new Date(data.expiresAt) < now) {
                data.status = 'EXPIRED';
                // Update in background
                s.update({ status: 'EXPIRED' }).catch(() => {});
            }
            return data;
        });

        res.json(result);
    } catch (error) {
        console.error('List share sessions error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

/**
 * POST /api/v1/share-sessions/:shareCode/revoke
 * Revoke an active share session
 */
router.post('/:shareCode/revoke', authMiddleware, async (req, res) => {
    try {
        const session = await ShareSession.findOne({
            where: { shareCode: req.params.shareCode, createdById: req.user.id }
        });
        if (!session) {
            return res.status(404).json({ detail: 'Share session not found' });
        }

        session.status = 'REVOKED';
        await session.save();

        console.log(`🛑 Share session revoked: ${req.params.shareCode}`);
        res.json({ message: 'Share session revoked successfully' });
    } catch (error) {
        console.error('Revoke share session error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

/**
 * PATCH /api/v1/share-sessions/:shareCode/mode
 * Update access mode of an active share session (VIEW_ONLY <-> ALLOW_DOWNLOAD)
 */
router.patch('/:shareCode/mode', authMiddleware, async (req, res) => {
    try {
        const { accessMode } = req.body;
        if (!['VIEW_ONLY', 'ALLOW_DOWNLOAD'].includes(accessMode)) {
            return res.status(400).json({ detail: 'Invalid accessMode. Must be VIEW_ONLY or ALLOW_DOWNLOAD' });
        }

        const session = await ShareSession.findOne({
            where: { shareCode: req.params.shareCode, createdById: req.user.id }
        });
        if (!session) {
            return res.status(404).json({ detail: 'Share session not found' });
        }

        session.accessMode = accessMode;
        await session.save();

        console.log(`🔄 Share session mode updated: ${req.params.shareCode} -> ${accessMode}`);
        res.json({ message: 'Access mode updated', accessMode: session.accessMode });
    } catch (error) {
        console.error('Update share session mode error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});


// ============================================
// STUDENT/PUBLIC ENDPOINTS (no user auth)
// ============================================

/**
 * GET /api/v1/share-sessions/:shareCode/preview
 * Public course preview for student share gate
 */
router.get('/:shareCode/preview', async (req, res) => {
    try {
        const session = await ShareSession.findOne({
            where: { shareCode: req.params.shareCode },
            include: [{
                model: Course,
                as: 'course',
                include: [{
                    model: Module,
                    include: [{ model: ContentItem, as: 'items', attributes: ['id', 'type', 'duration'] }]
                }, {
                    model: User,
                    as: 'instructor',
                    attributes: ['full_name']
                }]
            }]
        });

        if (!session || !session.course) {
            return res.status(404).json({ detail: 'Share session not found. Please check the link.' });
        }

        if (session.status === 'REVOKED') {
            return res.status(403).json({ detail: 'This share session has been revoked by the instructor.' });
        }

        if (session.status === 'EXPIRED' || (session.expiresAt && new Date(session.expiresAt) < new Date())) {
            return res.status(403).json({ detail: 'This share session has expired.' });
        }

        const course = session.course;
        let lessonsCount = 0;
        let totalDuration = 0;
        if (course.Modules) {
            course.Modules.forEach(m => {
                if (m.items) {
                    lessonsCount += m.items.length;
                    m.items.forEach(i => {
                        if (i.duration) totalDuration += i.duration;
                    });
                }
            });
        }

        const studentCount = await Enrollment.count({ where: { course_id: course.id } });

        res.json({
            shareCode: session.shareCode,
            courseId: course.id,
            title: course.title,
            description: course.description,
            image_url: course.image_url,
            instructorName: course.instructor ? course.instructor.full_name : 'SkillForge Faculty',
            accessMode: session.accessMode,
            status: session.status,
            modulesCount: course.Modules ? course.Modules.length : 0,
            lessonsCount: lessonsCount,
            totalDuration: totalDuration,
            studentCount: studentCount > 0 ? studentCount : 1,
            rating: studentCount > 0 ? Math.round((4.5 + (studentCount % 5) * 0.1) * 10) / 10 : 4.6
        });
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

/**
 * POST /api/v1/share-sessions/:shareCode/access
 * Validate passkey and return a share access token
 */
router.post('/:shareCode/access', async (req, res) => {
    try {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        if (!checkRateLimit(ip)) {
            return res.status(429).json({ detail: 'Too many attempts. Please wait a minute and try again.' });
        }

        const { passkey } = req.body;
        if (!passkey) {
            return res.status(400).json({ detail: 'Passkey is required' });
        }

        const session = await ShareSession.findOne({
            where: { shareCode: req.params.shareCode },
            include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'image_url'] }]
        });

        if (!session) {
            return res.status(404).json({ detail: 'Share session not found. Check the link and try again.' });
        }

        if (session.status === 'REVOKED') {
            return res.status(403).json({ detail: 'This share session has been revoked by the instructor.' });
        }

        if (session.status === 'EXPIRED' || (session.expiresAt && new Date(session.expiresAt) < new Date())) {
            if (session.status !== 'EXPIRED') {
                session.status = 'EXPIRED';
                await session.save();
            }
            return res.status(403).json({ detail: 'This share session has expired.' });
        }

        // Validate passkey
        const cleanInput = (passkey || '').replace(/[\s-]/g, '').toUpperCase();
        let isValid = false;
        if (session.passkeyHash) {
            try {
                isValid = await bcrypt.compare(cleanInput, session.passkeyHash);
            } catch (e) {}
        }
        if (!isValid && session.passkeyPlain && cleanInput === session.passkeyPlain.toUpperCase()) {
            isValid = true;
        }
        if (!isValid && cleanInput === session.shareCode.toUpperCase()) {
            isValid = true;
        }

        if (!isValid) {
            return res.status(401).json({ detail: 'Invalid access key. Please check and try again.' });
        }

        // Generate share access token (24h expiry)
        const shareToken = jwt.sign(
            {
                type: 'share_access',
                shareCode: session.shareCode,
                courseId: session.courseId,
                accessMode: session.accessMode
            },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        console.log(`✅ Share access granted: ${req.params.shareCode}`);

        res.json({
            token: shareToken,
            shareCode: session.shareCode,
            accessMode: session.accessMode,
            courseTitle: session.course ? session.course.title : 'Course',
            courseImage: session.course ? session.course.image_url : null
        });
    } catch (error) {
        console.error('Share access error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

/**
 * GET /api/v1/share-sessions/:shareCode/course
 * Get full course data for a share session (requires share token)
 */
router.get('/:shareCode/course', shareAuthMiddleware, async (req, res) => {
    try {
        const course = await Course.findOne({
            where: { id: req.share.courseId },
            include: [
                {
                    model: Module,
                    include: [{ model: ContentItem, as: 'items' }]
                }
            ]
        });

        if (!course) {
            return res.status(404).json({ detail: 'Course not found' });
        }

        const responseData = {
            id: course.id,
            title: course.title,
            description: course.description,
            image_url: course.image_url,
            accessMode: req.share.accessMode,
            shareCode: req.share.shareCode,
            modules: course.Modules ? course.Modules
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(m => ({
                    id: m.id,
                    title: m.title,
                    order: m.order,
                    lessons: m.items ? m.items
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map(i => {
                            const isDiskFile = typeof i.content === 'string' && (i.content.startsWith('/uploads/') || i.content.startsWith('uploads/'));
                            const isBase64 = typeof i.content === 'string' && i.content.startsWith('data:');
                            const isYouTube = typeof i.content === 'string' && (
                                i.content.includes('youtube.com') || i.content.includes('youtu.be')
                            );
                            const isPdf = typeof i.content === 'string' && (
                                i.content.startsWith('data:application/pdf') || 
                                i.content.toLowerCase().endsWith('.pdf') ||
                                (i.type === 'note' && (isBase64 || isDiskFile))
                            );
                            let detectedMime = null;
                            if (isBase64) {
                                const m = i.content.match(/data:([^;]+)/);
                                detectedMime = m ? m[1] : null;
                            } else if (isDiskFile) {
                                const ext = path.extname(i.content).toLowerCase();
                                if (ext === '.mp4') detectedMime = 'video/mp4';
                                else if (ext === '.webm') detectedMime = 'video/webm';
                                else if (ext === '.pdf') detectedMime = 'application/pdf';
                            }

                            return {
                                id: i.id,
                                title: i.title,
                                type: i.type,
                                // For base64 or disk content, provide the local share stream endpoint
                                contentUrl: (isBase64 || isDiskFile)
                                    ? `/share-sessions/${req.share.shareCode}/course/content/${i.id}`
                                    : null,
                                youtubeUrl: isYouTube ? i.content : null,
                                rawUrl: (!isBase64 && !isDiskFile && !isYouTube && typeof i.content === 'string' && i.content.startsWith('http')) ? i.content : null,
                                textContent: (!isBase64 && !isDiskFile && !isYouTube && (typeof i.content !== 'string' || !i.content.startsWith('http'))) ? i.content : null,
                                isPdf: isPdf,
                                mimeType: detectedMime,
                                duration: i.duration,
                                is_mandatory: i.is_mandatory,
                                order: i.order,
                                instructions: i.instructions
                            };
                        }) : []
                })) : []
        };

        res.json(responseData);
    } catch (error) {
        console.error('Share course data error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

/**
 * GET /api/v1/share-sessions/:shareCode/course/content/:contentId
 * Stream a single content item (requires share token)
 */
router.get('/:shareCode/course/content/:contentId', shareAuthMiddleware, async (req, res) => {
    try {
        const item = await ContentItem.findByPk(req.params.contentId);
        if (!item || !item.content) {
            return res.status(404).json({ detail: 'Content not found' });
        }

        // Verify this content belongs to the shared course
        const module = await Module.findByPk(item.module_id);
        if (!module || module.course_id !== req.share.courseId) {
            return res.status(403).json({ detail: 'Content does not belong to this shared course' });
        }

        // Case 1: Disk file stored on server
        if (item.content.startsWith('/uploads/') || item.content.startsWith('uploads/')) {
            const relPath = item.content.startsWith('/') ? item.content.substring(1) : item.content;
            const fullPath = path.join(__dirname, '..', relPath);

            if (!fs.existsSync(fullPath)) {
                return res.status(404).json({ detail: 'File not found on server disk' });
            }

            const stat = fs.statSync(fullPath);
            const fileSize = stat.size;
            const range = req.headers.range;

            let contentType = 'application/octet-stream';
            const ext = path.extname(fullPath).toLowerCase();
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
                const fileStream = fs.createReadStream(fullPath, { start, end });

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': contentType,
                    'Content-Disposition': 'inline'
                });
                fileStream.pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': contentType,
                    'Accept-Ranges': 'bytes',
                    'Content-Disposition': 'inline'
                });
                fs.createReadStream(fullPath).pipe(res);
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

            // Support range requests for video seeking & PDF page streaming
            const range = req.headers.range;
            if (range) {
                const rangeParts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(rangeParts[0], 10);
                const end = rangeParts[1] ? parseInt(rangeParts[1], 10) : totalLength - 1;
                const chunksize = (end - start) + 1;

                res.status(206).set({
                    'Content-Range': `bytes ${start}-${end}/${totalLength}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': mimeType,
                    'Content-Disposition': 'inline'
                }).send(buffer.slice(start, end + 1));
            } else {
                res.status(200).set({
                    'Content-Length': totalLength,
                    'Content-Type': mimeType,
                    'Accept-Ranges': 'bytes',
                    'Content-Disposition': 'inline'
                }).send(buffer);
            }
        } else {
            // For text/URL content, send as text
            res.status(200).set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'inline' }).send(item.content);
        }
    } catch (error) {
        console.error('Share content stream error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

/**
 * GET /api/v1/share-sessions/:shareCode/download/course
 * Download entire course as ZIP (only if ALLOW_DOWNLOAD)
 */
router.get('/:shareCode/download/course', shareAuthMiddleware, async (req, res) => {
    try {
        if (req.share.accessMode !== 'ALLOW_DOWNLOAD') {
            return res.status(403).json({ detail: 'Downloads are not permitted for this share session' });
        }

        const course = await Course.findOne({
            where: { id: req.share.courseId },
            include: [{
                model: Module,
                include: [{ model: ContentItem, as: 'items' }]
            }]
        });

        if (!course) {
            return res.status(404).json({ detail: 'Course not found' });
        }

        const courseName = sanitizeFilename(course.title);

        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${courseName}.zip"`,
        });

        const archive = new ZipArchive({ zlib: { level: 5 } });
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ detail: 'Failed to create download archive' });
            }
        });
        archive.pipe(res);

        const modules = course.Modules
            ? course.Modules.sort((a, b) => (a.order || 0) - (b.order || 0))
            : [];

        for (let mi = 0; mi < modules.length; mi++) {
            const mod = modules[mi];
            const moduleFolderName = sanitizeFilename(`Module ${mi + 1} - ${mod.title}`);
            const lessons = mod.items
                ? mod.items.sort((a, b) => (a.order || 0) - (b.order || 0))
                : [];

            for (let li = 0; li < lessons.length; li++) {
                const lesson = lessons[li];
                const lessonPrefix = String(li + 1).padStart(2, '0');
                const lessonName = sanitizeFilename(lesson.title);

                if (lesson.content && (lesson.content.startsWith('/uploads/') || lesson.content.startsWith('uploads/'))) {
                    // Disk file -> stream from disk directly into ZIP
                    const relPath = lesson.content.startsWith('/') ? lesson.content.substring(1) : lesson.content;
                    const fullPath = path.join(__dirname, '..', relPath);
                    if (fs.existsSync(fullPath)) {
                        const ext = path.extname(fullPath);
                        archive.file(fullPath, {
                            name: `${courseName}/${moduleFolderName}/${lessonPrefix} - ${lessonName}${ext}`
                        });
                    }
                } else if (lesson.content && lesson.content.startsWith('data:')) {
                    // Base64 content → decode to binary
                    const ext = getExtFromDataUrl(lesson.content);
                    const parts = lesson.content.split(',');
                    const base64Data = parts[1];
                    const buffer = Buffer.from(base64Data, 'base64');
                    archive.append(buffer, {
                        name: `${courseName}/${moduleFolderName}/${lessonPrefix} - ${lessonName}${ext}`
                    });
                } else if (lesson.content) {
                    // Text/URL content → save as .txt
                    const isYouTube = lesson.content.includes('youtube.com') || lesson.content.includes('youtu.be');
                    const content = isYouTube
                        ? `YouTube Video: ${lesson.content}\n\nNote: This video requires an internet connection to view.`
                        : lesson.content;
                    archive.append(content, {
                        name: `${courseName}/${moduleFolderName}/${lessonPrefix} - ${lessonName}.txt`
                    });
                }
            }
        }

        await archive.finalize();
    } catch (error) {
        console.error('Course download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ detail: 'Internal Server Error' });
        }
    }
});

/**
 * GET /api/v1/share-sessions/:shareCode/download/module/:moduleId
 * Download a single module as ZIP (only if ALLOW_DOWNLOAD)
 */
/**
 * GET /api/v1/share-sessions/:shareCode/download/module/:moduleId
 * Download a single module as ZIP (only if ALLOW_DOWNLOAD)
 */
router.get('/:shareCode/download/module/:moduleId', shareAuthMiddleware, async (req, res) => {
    try {
        if (req.share.accessMode !== 'ALLOW_DOWNLOAD') {
            return res.status(403).json({ detail: 'Downloads are not permitted for this share session' });
        }

        const mod = await Module.findOne({
            where: {
                id: req.params.moduleId,
                course_id: req.share.courseId
            },
            include: [{ model: ContentItem, as: 'items' }]
        });

        if (!mod) {
            return res.status(404).json({ detail: 'Module not found' });
        }

        const course = await Course.findByPk(req.share.courseId);
        const moduleName = sanitizeFilename(mod.title);
        const zipName = sanitizeFilename(`${course ? course.title : 'Course'} - ${mod.title}`);

        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${zipName}.zip"`,
        });

        const archive = new ZipArchive({ zlib: { level: 5 } });
        archive.on('error', (err) => {
            console.error('Module archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ detail: 'Failed to create download archive' });
            }
        });
        archive.pipe(res);

        const lessons = mod.items
            ? mod.items.sort((a, b) => (a.order || 0) - (b.order || 0))
            : [];

        for (let li = 0; li < lessons.length; li++) {
            const lesson = lessons[li];
            const lessonPrefix = String(li + 1).padStart(2, '0');
            const lessonName = sanitizeFilename(lesson.title);

            if (lesson.content && (lesson.content.startsWith('/uploads/') || lesson.content.startsWith('uploads/'))) {
                // Disk file -> stream from disk directly into ZIP
                const relPath = lesson.content.startsWith('/') ? lesson.content.substring(1) : lesson.content;
                const fullPath = path.join(__dirname, '..', relPath);
                if (fs.existsSync(fullPath)) {
                    const ext = path.extname(fullPath);
                    archive.file(fullPath, {
                        name: `${moduleName}/${lessonPrefix} - ${lessonName}${ext}`
                    });
                }
            } else if (lesson.content && lesson.content.startsWith('data:')) {
                const ext = getExtFromDataUrl(lesson.content);
                const parts = lesson.content.split(',');
                const base64Data = parts[1];
                const buffer = Buffer.from(base64Data, 'base64');
                archive.append(buffer, {
                    name: `${moduleName}/${lessonPrefix} - ${lessonName}${ext}`
                });
            } else if (lesson.content) {
                const isYouTube = lesson.content.includes('youtube.com') || lesson.content.includes('youtu.be');
                const content = isYouTube
                    ? `YouTube Video: ${lesson.content}\n\nNote: This video requires an internet connection to view.`
                    : lesson.content;
                archive.append(content, {
                    name: `${moduleName}/${lessonPrefix} - ${lessonName}.txt`
                });
            }
        }

        await archive.finalize();
        console.log(`📦 Module download completed: ${moduleName} (${req.share.shareCode})`);
    } catch (error) {
        console.error('Module download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ detail: 'Internal Server Error' });
        }
    }
});

module.exports = router;
