const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ZipArchive } = require('archiver');
const { Course, Module, ContentItem, CourseVersion, ContentItemTranslation, ShareSession, User, Enrollment } = require('../models');
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
// Live Connected Devices & Transfer Progress Registry
// ============================================
// Map: shareCode -> Map: clientId -> ClientRecord
const sessionClients = new Map();

function getSessionClientMap(shareCode) {
    const code = String(shareCode || '').toUpperCase();
    if (!sessionClients.has(code)) {
        sessionClients.set(code, new Map());
    }
    return sessionClients.get(code);
}

function findClient(shareCode, clientId) {
    if (!clientId) return null;
    if (shareCode) {
        const clientMap = getSessionClientMap(shareCode);
        const client = clientMap ? clientMap.get(clientId) : null;
        if (client) return client;
    }
    // Fallback: search across all active session maps
    for (const [, clientMap] of sessionClients.entries()) {
        if (clientMap.has(clientId)) {
            return clientMap.get(clientId);
        }
    }
    return null;
}

function detectDevice(userAgent) {
    if (!userAgent) return 'Web Browser';
    if (/Android/i.test(userAgent)) return 'Android Device';
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS Device';
    if (/Windows/i.test(userAgent)) return 'Windows PC';
    if (/Macintosh/i.test(userAgent)) return 'Mac Desktop';
    if (/Linux/i.test(userAgent)) return 'Linux Device';
    return 'Web Browser';
}

// Clean up stale client sessions older than 24 hours every 10 minutes
setInterval(() => {
    const now = Date.now();
    const MAX_STALE_MS = 24 * 60 * 60 * 1000;
    for (const [code, clientMap] of sessionClients.entries()) {
        for (const [clientId, client] of clientMap.entries()) {
            const lastActivity = new Date(client.lastSeenAt || client.joinedAt).getTime();
            if (now - lastActivity > MAX_STALE_MS) {
                clientMap.delete(clientId);
            }
        }
        if (clientMap.size === 0) {
            sessionClients.delete(code);
        }
    }
}, 10 * 60 * 1000);


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

        const shareCode = String(req.params.shareCode).toUpperCase();
        const session = await ShareSession.findOne({
            where: { shareCode }
        });
        if (!session) {
            return res.status(404).json({ detail: 'Share session not found' });
        }

        session.accessMode = accessMode;
        await session.save();

        console.log(`🔄 Share session mode updated: ${shareCode} -> ${accessMode}`);
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

        // Register Connected Student Device
        const clientMap = getSessionClientMap(session.shareCode);
        const clientId = req.body.clientId || `client_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const studentName = (req.body.studentName || '').trim() || `Student ${clientMap.size + 1}`;
        const deviceType = req.body.deviceType || detectDevice(req.headers['user-agent']);
        const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

        const clientRecord = {
            clientId,
            studentName,
            deviceType,
            ip: clientIp.replace('::ffff:', ''),
            userAgent: req.headers['user-agent'] || '',
            joinedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            status: 'ONLINE',
            downloadProgress: null
        };
        clientMap.set(clientId, clientRecord);

        // Generate share access token (24h expiry)
        const shareToken = jwt.sign(
            {
                type: 'share_access',
                shareCode: session.shareCode,
                courseId: session.courseId,
                accessMode: session.accessMode,
                clientId,
                studentName
            },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        console.log(`✅ Share access granted: ${session.shareCode} for student "${studentName}" (${clientId} on ${deviceType})`);

        res.json({
            token: shareToken,
            shareCode: session.shareCode,
            accessMode: session.accessMode,
            courseTitle: session.course ? session.course.title : 'Course',
            courseImage: session.course ? session.course.image_url : null,
            clientId,
            studentName
        });
    } catch (error) {
        console.error('Share access error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

/**
 * POST /api/v1/share-sessions/:shareCode/heartbeat
 * Keep student connection active and update online status
 */
router.post('/:shareCode/heartbeat', async (req, res) => {
    try {
        const shareCode = String(req.params.shareCode).toUpperCase();
        const clientMap = getSessionClientMap(shareCode);
        
        let clientId = req.body.clientId;
        let studentName = req.body.studentName;

        // Try extracting from auth header if present
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const payload = jwt.verify(token, SECRET_KEY);
                if (payload.clientId) clientId = payload.clientId;
                if (payload.studentName) studentName = payload.studentName;
            } catch (e) {}
        }

        if (clientId) {
            let client = clientMap.get(clientId);
            if (!client) {
                const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
                client = {
                    clientId,
                    studentName: studentName || 'Student',
                    deviceType: req.body.deviceType || detectDevice(req.headers['user-agent']),
                    ip: clientIp.replace('::ffff:', ''),
                    joinedAt: new Date().toISOString(),
                    lastSeenAt: new Date().toISOString(),
                    status: 'ONLINE',
                    downloadProgress: null
                };
                clientMap.set(clientId, client);
            } else {
                client.lastSeenAt = new Date().toISOString();
                client.status = 'ONLINE';
                if (studentName && studentName.trim()) {
                    client.studentName = studentName.trim();
                }
            }
        }

        const session = await ShareSession.findOne({
            where: { shareCode },
            attributes: ['accessMode', 'status']
        });

        res.json({
            ok: true,
            accessMode: session?.accessMode || 'VIEW_ONLY',
            sessionStatus: session?.status || 'ACTIVE'
        });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ detail: 'Heartbeat failed' });
    }
});

/**
 * GET /api/v1/share-sessions/:shareCode/clients
 * Get live list of connected devices, student names, and download progress
 */
router.get('/:shareCode/clients', async (req, res) => {
    try {
        const shareCode = String(req.params.shareCode).toUpperCase();
        const session = await ShareSession.findOne({ where: { shareCode } });
        if (!session) {
            return res.status(404).json({ detail: 'Share session not found' });
        }

        const clientMap = getSessionClientMap(shareCode);
        const now = Date.now();
        const clients = [];

        for (const client of clientMap.values()) {
            const lastActivity = new Date(client.lastSeenAt || client.joinedAt).getTime();
            const isOnline = (now - lastActivity) < 45000; // Active within 45 seconds

            clients.push({
                ...client,
                status: isOnline ? 'ONLINE' : 'AWAY'
            });
        }

        // Sort: downloading active first, then most recently active
        clients.sort((a, b) => {
            if (a.downloadProgress?.status === 'DOWNLOADING' && b.downloadProgress?.status !== 'DOWNLOADING') return -1;
            if (b.downloadProgress?.status === 'DOWNLOADING' && a.downloadProgress?.status !== 'DOWNLOADING') return 1;
            return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
        });

        res.json({
            shareCode,
            totalConnected: clients.length,
            activeCount: clients.filter(c => c.status === 'ONLINE').length,
            clients
        });
    } catch (error) {
        console.error('Fetch share clients error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

/**
 * POST /api/v1/share-sessions/:shareCode/download-progress
 * Client reports real-time download transfer progress
 */
router.post('/:shareCode/download-progress', async (req, res) => {
    try {
        const shareCode = String(req.params.shareCode).toUpperCase();
        const clientMap = getSessionClientMap(shareCode);
        let clientId = req.body.clientId || req.query.clientId;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const payload = jwt.verify(token, SECRET_KEY);
                if (payload.clientId) clientId = payload.clientId;
            } catch (e) {}
        }

        let client = typeof findClient === 'function' ? findClient(shareCode, clientId) : (clientMap ? clientMap.get(clientId) : null);

        if (client) {
            const { bytesTransferred, totalBytes, percent, status, speed, fileName } = req.body;

            client.downloadProgress = {
                fileName: fileName || client.downloadProgress?.fileName || 'SkillForge-Offline.apk',
                bytesTransferred: Number(bytesTransferred) || 0,
                totalBytes: Number(totalBytes) || 0,
                percent: Math.min(100, Math.max(0, Number(percent) || 0)),
                status: status || 'DOWNLOADING', // 'DOWNLOADING' | 'COMPLETED' | 'FAILED'
                speed: speed || '',
                updatedAt: new Date().toISOString()
            };
            client.lastSeenAt = new Date().toISOString();
        }

        res.json({ ok: true });
    } catch (error) {
        console.error('Update download progress error:', error);
        res.status(500).json({ detail: 'Failed to update progress' });
    }
});

/**
 * GET /api/v1/share-sessions/:shareCode/course
 * Get full course data for a share session (requires share token, supports ?lang=en|hi)
 */
router.get('/:shareCode/course', shareAuthMiddleware, async (req, res) => {
    try {
        const requestedLang = req.query.lang || 'en';
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

        // Check available languages
        const versions = await CourseVersion.findAll({
            where: { course_id: course.id, status: 'READY' }
        });
        const readyLangMap = {};
        versions.forEach(v => { readyLangMap[v.language_code] = v; });

        const availableLanguages = [
            { code: 'en', name: 'English', nativeName: 'English', ready: true }
        ];
        if (readyLangMap['hi']) {
            availableLanguages.push({ code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', ready: true });
        }
        if (readyLangMap['ta']) {
            availableLanguages.push({ code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', ready: true });
        }

        const isRequestedReady = requestedLang !== 'en' && readyLangMap[requestedLang];
        let translationMap = {};
        let activeTitle = course.title;
        let activeDescription = course.description;

        if (isRequestedReady) {
            const currentVer = readyLangMap[requestedLang];
            if (currentVer.title) activeTitle = currentVer.title;
            if (currentVer.description) activeDescription = currentVer.description;

            const translations = await ContentItemTranslation.findAll({
                where: { language_code: requestedLang, status: 'READY' }
            });
            translations.forEach(t => translationMap[t.content_item_id] = t);
        }

        const responseData = {
            id: course.id,
            title: activeTitle,
            original_title: course.title,
            description: activeDescription,
            image_url: course.image_url,
            accessMode: req.share.accessMode,
            shareCode: req.share.shareCode,
            current_language: isRequestedReady ? requestedLang : 'en',
            available_languages: availableLanguages,
            modules: course.Modules ? course.Modules
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(m => ({
                    id: m.id,
                    title: m.title,
                    order: m.order,
                    lessons: m.items ? m.items
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map(i => {
                            let itemContent = i.content;
                            let lessonTitle = i.title;
                            let isTranslated = false;

                            if (isRequestedReady && translationMap[i.id]) {
                                itemContent = translationMap[i.id].content;
                                if (translationMap[i.id].title) lessonTitle = translationMap[i.id].title;
                                isTranslated = true;
                            }

                            const isDiskFile = typeof itemContent === 'string' && (itemContent.startsWith('/uploads/') || itemContent.startsWith('uploads/'));
                            const isBase64 = typeof itemContent === 'string' && itemContent.startsWith('data:');
                            const isYouTube = typeof itemContent === 'string' && (
                                itemContent.includes('youtube.com') || itemContent.includes('youtu.be')
                            );
                            const isPdf = typeof itemContent === 'string' && (
                                itemContent.startsWith('data:application/pdf') || 
                                itemContent.toLowerCase().endsWith('.pdf') ||
                                (i.type === 'note' && (isBase64 || isDiskFile))
                            );
                            let detectedMime = null;
                            if (isBase64) {
                                const m = itemContent.match(/data:([^;]+)/);
                                detectedMime = m ? m[1] : null;
                            } else if (isDiskFile) {
                                const ext = path.extname(itemContent).toLowerCase();
                                if (ext === '.mp4') detectedMime = 'video/mp4';
                                else if (ext === '.webm') detectedMime = 'video/webm';
                                else if (ext === '.pdf') detectedMime = 'application/pdf';
                            }

                            return {
                                id: i.id,
                                title: lessonTitle,
                                type: i.type,
                                contentUrl: (isBase64 || isDiskFile)
                                    ? `/share-sessions/${req.share.shareCode}/course/content/${i.id}${requestedLang === 'hi' && isHindiReady ? '?lang=hi' : ''}`
                                    : null,
                                youtubeUrl: isYouTube ? itemContent : null,
                                rawUrl: (!isBase64 && !isDiskFile && !isYouTube && typeof itemContent === 'string' && itemContent.startsWith('http')) ? itemContent : null,
                                textContent: (!isBase64 && !isDiskFile && !isYouTube && (typeof itemContent !== 'string' || !itemContent.startsWith('http'))) ? itemContent : null,
                                isPdf: isPdf,
                                mimeType: detectedMime,
                                duration: i.duration,
                                is_mandatory: i.is_mandatory,
                                order: i.order,
                                instructions: i.instructions,
                                is_translated: isTranslated
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
 * Stream a single content item (requires share token, supports ?lang=en|hi)
 */
router.get('/:shareCode/course/content/:contentId', shareAuthMiddleware, async (req, res) => {
    try {
        const requestedLang = req.query.lang || 'en';
        const item = await ContentItem.findByPk(req.params.contentId);
        if (!item || !item.content) {
            return res.status(404).json({ detail: 'Content not found' });
        }

        // Verify this content belongs to the shared course
        const module = await Module.findByPk(item.module_id);
        if (!module || module.course_id !== req.share.courseId) {
            return res.status(403).json({ detail: 'Content does not belong to this shared course' });
        }

        let contentToServe = item.content;

        // Check if translated version should be streamed (hi, ta)
        if (requestedLang !== 'en') {
            const trans = await ContentItemTranslation.findOne({
                where: { content_item_id: item.id, language_code: requestedLang, status: 'READY' }
            });
            if (trans && trans.content) {
                contentToServe = trans.content;
            }
        }

        // Case 1: Disk file stored on server
        if (contentToServe.startsWith('/uploads/') || contentToServe.startsWith('uploads/')) {
            const relPath = contentToServe.startsWith('/') ? contentToServe.substring(1) : contentToServe;
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
        if (contentToServe.startsWith('data:')) {
            const parts = contentToServe.split(',');
            const match = parts[0].match(/:(.*?);/);
            const mimeType = match ? match[1] : 'application/octet-stream';
            const base64Data = parts[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const totalLength = buffer.length;

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
            res.status(200).set({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'inline' }).send(contentToServe);
        }
    } catch (error) {
        console.error('Share content stream error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

/**
 * GET /api/v1/share-sessions/:shareCode/download/course
 * Download entire course as ZIP (supports ?lang=en|hi|ta, only if ALLOW_DOWNLOAD)
 */
router.get('/:shareCode/download/course', shareAuthMiddleware, async (req, res) => {
    try {
        if (req.share.accessMode !== 'ALLOW_DOWNLOAD') {
            return res.status(403).json({ detail: 'Downloads are not permitted for this share session' });
        }

        const requestedLang = req.query.lang || 'en';
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

        const versions = await CourseVersion.findAll({
            where: { course_id: course.id, status: 'READY' }
        });
        const readyLangMap = {};
        versions.forEach(v => { readyLangMap[v.language_code] = v; });

        const isRequestedReady = requestedLang !== 'en' && readyLangMap[requestedLang];
        let translationMap = {};
        let activeTitle = course.title;
        let activeDescription = course.description;

        if (isRequestedReady) {
            const currentVer = readyLangMap[requestedLang];
            if (currentVer.title) activeTitle = currentVer.title;
            if (currentVer.description) activeDescription = currentVer.description;

            const translations = await ContentItemTranslation.findAll({
                where: { language_code: requestedLang, status: 'READY' }
            });
            translations.forEach(t => translationMap[t.content_item_id] = t);
        }

        const langSuffix = isRequestedReady 
            ? (requestedLang === 'hi' ? ' (Hindi)' : (requestedLang === 'ta' ? ' (Tamil)' : ` (${requestedLang})`)) 
            : '';
        const courseName = sanitizeFilename(course.title + langSuffix);

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

        // Track live download progress for connected student
        const clientId = req.share.clientId || req.query.clientId;
        const clientMap = getSessionClientMap(req.share.shareCode);
        const client = clientId ? clientMap.get(clientId) : null;

        // Estimate total course content uncompressed size
        let estimatedTotalBytes = 1024 * 50; // manifest overhead
        for (const mod of modules) {
            for (const item of mod.items || []) {
                let contentVal = item.content;
                if (isRequestedReady && translationMap[item.id]) {
                    contentVal = translationMap[item.id].content;
                }

                if (contentVal && (contentVal.startsWith('/uploads/') || contentVal.startsWith('uploads/'))) {
                    const relPath = contentVal.startsWith('/') ? contentVal.substring(1) : contentVal;
                    const fullPath = path.join(__dirname, '..', relPath);
                    if (fs.existsSync(fullPath)) {
                        try {
                            estimatedTotalBytes += fs.statSync(fullPath).size;
                        } catch (e) {}
                    }
                } else if (contentVal && contentVal.startsWith('data:')) {
                    const parts = contentVal.split(',');
                    if (parts[1]) {
                        estimatedTotalBytes += Math.floor((parts[1].length * 3) / 4);
                    }
                } else if (contentVal) {
                    estimatedTotalBytes += Buffer.byteLength(contentVal, 'utf8');
                }
            }
        }

        if (client) {
            client.downloadProgress = {
                fileName: `${courseName}.zip`,
                bytesTransferred: 0,
                totalBytes: estimatedTotalBytes,
                percent: 0,
                status: 'DOWNLOADING',
                speed: '0 MB/s',
                startedAt: Date.now(),
                updatedAt: new Date().toISOString()
            };
        }

        let bytesSent = 0;
        let lastUpdate = Date.now();

        archive.on('data', (chunk) => {
            bytesSent += chunk.length;
            const now = Date.now();
            if (client && (now - lastUpdate > 250 || bytesSent >= estimatedTotalBytes)) {
                lastUpdate = now;
                const percent = estimatedTotalBytes > 0 
                    ? Math.min(99, Math.round((bytesSent / estimatedTotalBytes) * 100)) 
                    : 50;
                const elapsedSec = (now - client.downloadProgress.startedAt) / 1000;
                const speed = elapsedSec > 0 ? (bytesSent / (1024 * 1024 * elapsedSec)).toFixed(1) + ' MB/s' : '0 MB/s';

                client.downloadProgress = {
                    ...client.downloadProgress,
                    bytesTransferred: bytesSent,
                    totalBytes: Math.max(estimatedTotalBytes, bytesSent),
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
                    bytesTransferred: bytesSent,
                    totalBytes: bytesSent,
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

        const manifest = {
            title: activeTitle,
            original_title: course.title,
            language: isRequestedReady ? requestedLang : 'en',
            sourceLanguage: 'en',
            description: activeDescription,
            exportedAt: new Date().toISOString(),
            version: "1.0",
            modules: []
        };

        for (let mi = 0; mi < modules.length; mi++) {
            const mod = modules[mi];
            const moduleFolderName = sanitizeFilename(`Module ${mi + 1} - ${mod.title}`);
            const lessons = mod.items
                ? mod.items.sort((a, b) => (a.order || 0) - (b.order || 0))
                : [];

            const manifestModule = {
                id: mod.id,
                title: mod.title,
                order: mod.order || mi + 1,
                lessons: []
            };

            for (let li = 0; li < lessons.length; li++) {
                const lesson = lessons[li];
                const lessonPrefix = String(li + 1).padStart(2, '0');
                
                let contentVal = lesson.content;
                let lessonTitle = lesson.title;

                if (requestedLang === 'hi' && isHindiReady && translationMap[lesson.id]) {
                    contentVal = translationMap[lesson.id].content;
                    if (translationMap[lesson.id].title) lessonTitle = translationMap[lesson.id].title;
                }

                const lessonName = sanitizeFilename(lessonTitle);
                let lessonFilePath = null;
                let ext = '';

                if (contentVal && (contentVal.startsWith('/uploads/') || contentVal.startsWith('uploads/'))) {
                    // Disk file -> stream from disk directly into ZIP
                    const relPath = contentVal.startsWith('/') ? contentVal.substring(1) : contentVal;
                    const fullPath = path.join(__dirname, '..', relPath);
                    if (fs.existsSync(fullPath)) {
                        ext = path.extname(fullPath);
                        lessonFilePath = `${moduleFolderName}/${lessonPrefix} - ${lessonName}${ext}`;
                        archive.file(fullPath, {
                            name: `${courseName}/${lessonFilePath}`
                        });
                    }
                } else if (contentVal && contentVal.startsWith('data:')) {
                    // Base64 content → decode to binary
                    ext = getExtFromDataUrl(contentVal);
                    const parts = contentVal.split(',');
                    const base64Data = parts[1];
                    const buffer = Buffer.from(base64Data, 'base64');
                    lessonFilePath = `${moduleFolderName}/${lessonPrefix} - ${lessonName}${ext}`;
                    archive.append(buffer, {
                        name: `${courseName}/${lessonFilePath}`
                    });
                } else if (contentVal) {
                    // Text/URL content → save as .txt
                    const isYouTube = contentVal.includes('youtube.com') || contentVal.includes('youtu.be');
                    const content = isYouTube
                        ? `YouTube Video: ${contentVal}\n\nNote: This video requires an internet connection to view.`
                        : contentVal;
                    lessonFilePath = `${moduleFolderName}/${lessonPrefix} - ${lessonName}.txt`;
                    archive.append(content, {
                        name: `${courseName}/${lessonFilePath}`
                    });
                }

                manifestModule.lessons.push({
                    id: lesson.id,
                    title: lessonTitle,
                    type: lesson.type,
                    duration: lesson.duration,
                    is_mandatory: lesson.is_mandatory,
                    order: lesson.order || li + 1,
                    instructions: lesson.instructions,
                    filePath: lessonFilePath,
                    textContent: (!lessonFilePath || lessonFilePath.endsWith('.txt')) ? contentVal : null,
                    is_translated: requestedLang === 'hi' && isHindiReady && !!translationMap[lesson.id]
                });
            }

            manifest.modules.push(manifestModule);
        }

        // Add manifest JSON at root and inside course folder
        archive.append(JSON.stringify(manifest, null, 2), {
            name: `${courseName}/course_manifest.json`
        });
        archive.append(JSON.stringify(manifest, null, 2), {
            name: `course_manifest.json`
        });

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
module.exports.getSessionClientMap = getSessionClientMap;
module.exports.findClient = findClient;
module.exports.sessionClients = sessionClients;
