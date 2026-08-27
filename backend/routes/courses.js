const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { 
    Course, 
    Module, 
    ContentItem, 
    CourseVersion, 
    ContentItemTranslation, 
    VideoSubtitle, 
    VideoDubbedAsset,
    Quiz,
    QuizQuestion,
    QuizOption,
    QuizQuestionTranslation,
    QuizOptionTranslation,
    Enrollment, 
    LessonProgress, 
    SchoolClass, 
    CourseBatch, 
    User 
} = require('../models');
const { authMiddleware, getPasswordHash } = require('../middleware/auth');
const { translateQuizToLanguage } = require('./quizzes');

const LANGUAGE_SERVICE_URL = process.env.LANGUAGE_SERVICE_URL || 'http://127.0.0.1:8001';

// ============================================
// 🌐 MULTILINGUAL / LANGUAGE CONVERSION ROUTES
// ============================================

/**
 * GET /api/v1/courses/:course_id/languages
 * Get all available language versions and video subtitle stats for this course (with dynamic real-time auditing)
 */
router.get('/:course_id/languages', authMiddleware, async (req, res) => {
    try {
        const course = await Course.findOne({
            where: { id: req.params.course_id },
            include: [
                {
                    model: Module,
                    include: [{ model: ContentItem, as: 'items' }]
                }
            ]
        });
        if (!course) return res.status(404).json({ detail: "Course not found" });

        // Collect all active item IDs and categorize
        const activeItemIds = [];
        const activeNoteItems = [];
        const activeVideoItems = [];

        if (course.Modules) {
            course.Modules.forEach(m => {
                if (m.items) {
                    m.items.forEach(i => {
                        activeItemIds.push(i.id);
                        if (i.type === 'note' || (typeof i.content === 'string' && i.content.endsWith('.pdf'))) {
                            activeNoteItems.push(i);
                        }
                        if (i.type === 'video' || (typeof i.content === 'string' && (i.content.endsWith('.mp4') || i.content.endsWith('.webm')))) {
                            activeVideoItems.push(i);
                        }
                    });
                }
            });
        }

        const totalNotes = activeNoteItems.length;
        const totalVideos = activeVideoItems.length;
        const activeNoteIds = activeNoteItems.map(i => i.id);
        const activeVideoIds = activeVideoItems.map(i => i.id);

        // Clean up any orphaned translations whose content item was deleted
        const allCourseItemIds = [];
        if (course.Modules) {
            course.Modules.forEach(m => m.items && m.items.forEach(i => allCourseItemIds.push(i.id)));
        }

        // Subtitles and Dubbed video count
        const readySubtitles = await VideoSubtitle.findAll({
            where: { content_item_id: activeVideoIds, status: 'READY' }
        });
        const hindiSubsCount = readySubtitles.filter(s => s.language_code === 'hi').length;
        const tamilSubsCount = readySubtitles.filter(s => s.language_code === 'ta').length;

        const readyDubbed = await VideoDubbedAsset.findAll({
            where: { content_item_id: activeVideoIds, status: 'READY' }
        });
        const hindiDubbedCount = readyDubbed.filter(d => d.language_code === 'hi').length;
        const tamilDubbedCount = readyDubbed.filter(d => d.language_code === 'ta').length;

        // Process each target language
        const targetLangs = ['hi', 'ta'];
        const langData = {};

        for (const lang of targetLangs) {
            const [version] = await CourseVersion.findOrCreate({
                where: { course_id: course.id, language_code: lang },
                defaults: {
                    title: course.title,
                    status: 'NOT_GENERATED',
                    progress: 0,
                    total_files: totalNotes,
                    completed_files: 0
                }
            });

            // Find how many valid translations exist for CURRENT active note items
            let completedNotes = 0;
            if (activeNoteIds.length > 0) {
                const translations = await ContentItemTranslation.findAll({
                    where: {
                        content_item_id: activeNoteIds,
                        language_code: lang,
                        status: 'READY'
                    }
                });
                completedNotes = translations.length;
            }

            let computedStatus = version.status;
            let computedProgress = version.progress;
            let currentFile = version.current_file;

            if (totalNotes === 0) {
                // No notes in course
                const subsReady = lang === 'hi' ? hindiSubsCount : tamilSubsCount;
                if (totalVideos > 0 && subsReady > 0) {
                    computedStatus = 'READY';
                    computedProgress = 100;
                } else if (version.status === 'GENERATING') {
                    computedStatus = 'READY';
                    computedProgress = 100;
                } else if (version.status === 'READY') {
                    computedStatus = 'READY';
                    computedProgress = 100;
                } else {
                    computedStatus = 'NOT_GENERATED';
                    computedProgress = 0;
                }
                currentFile = null;
            } else {
                // There are notes in the course
                if (completedNotes === totalNotes) {
                    computedStatus = 'READY';
                    computedProgress = 100;
                    currentFile = null;
                } else if (version.status === 'GENERATING') {
                    // Check if generation job is stale (> 3 minutes without update)
                    const lastUpdated = new Date(version.updatedAt).getTime();
                    const now = Date.now();
                    if (now - lastUpdated > 180000) {
                        computedStatus = completedNotes > 0 ? 'READY' : 'NOT_GENERATED';
                        computedProgress = Math.round((completedNotes / totalNotes) * 100);
                        currentFile = null;
                    }
                } else {
                    computedStatus = completedNotes > 0 ? 'READY' : 'NOT_GENERATED';
                    computedProgress = Math.round((completedNotes / totalNotes) * 100);
                    currentFile = null;
                }
            }

            // Sync database record
            version.total_files = totalNotes;
            version.completed_files = completedNotes;
            version.status = computedStatus;
            version.progress = computedProgress;
            version.current_file = currentFile;
            await version.save();

            langData[lang] = {
                status: computedStatus,
                progress: computedProgress,
                total_files: totalNotes,
                completed_files: completedNotes,
                current_file: currentFile,
                error_message: version.error_message,
                updated_at: version.updatedAt
            };
        }

        const languages = [
            {
                language_code: 'en',
                name: 'English',
                nativeName: 'English',
                flag: '🇬🇧',
                status: 'READY',
                is_original: true,
                progress: 100,
                total_videos: totalVideos,
                subtitles_ready: totalVideos,
                voice_dubbed_ready: totalVideos
            },
            {
                language_code: 'hi',
                name: 'Hindi',
                nativeName: 'हिन्दी',
                flag: '🇮🇳',
                status: langData['hi'].status,
                is_original: false,
                progress: langData['hi'].progress,
                total_files: langData['hi'].total_files,
                completed_files: langData['hi'].completed_files,
                current_file: langData['hi'].current_file,
                error_message: langData['hi'].error_message,
                updated_at: langData['hi'].updated_at,
                total_videos: totalVideos,
                subtitles_ready: hindiSubsCount,
                voice_dubbed_ready: hindiDubbedCount
            },
            {
                language_code: 'ta',
                name: 'Tamil',
                nativeName: 'தமிழ்',
                flag: '🇮🇳',
                status: langData['ta'].status,
                is_original: false,
                progress: langData['ta'].progress,
                total_files: langData['ta'].total_files,
                completed_files: langData['ta'].completed_files,
                current_file: langData['ta'].current_file,
                error_message: langData['ta'].error_message,
                updated_at: langData['ta'].updated_at,
                total_videos: totalVideos,
                subtitles_ready: tamilSubsCount,
                voice_dubbed_ready: tamilDubbedCount
            }
        ];

        res.json({
            course_id: course.id,
            languages,
            video_summary: {
                total_videos: totalVideos,
                hindi_subtitles_ready: hindiSubsCount,
                tamil_subtitles_ready: tamilSubsCount,
                hindi_voice_dubbed_ready: hindiDubbedCount,
                tamil_voice_dubbed_ready: tamilDubbedCount
            }
        });
    } catch (error) {
        console.error("Fetch course languages error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});


/**
 * Helper to trigger language translation job (PDFs + Video Subtitles)
 */
async function triggerLanguageGeneration(req, res, targetLang) {
    try {
        const course = await Course.findOne({
            where: { id: req.params.course_id, instructor_id: req.user.id },
            include: [
                {
                    model: Module,
                    include: [{ model: ContentItem, as: 'items' }]
                }
            ]
        });

        if (!course) {
            return res.status(404).json({ detail: "Course not found or unauthorized" });
        }

        // Collect all PDF note assets and MP4 video assets
        const pdfAssets = [];
        const videoAssets = [];

        if (course.Modules) {
            course.Modules.forEach(mod => {
                if (mod.items) {
                    mod.items.forEach(item => {
                        const isDiskFile = typeof item.content === 'string' && (item.content.startsWith('/uploads/') || item.content.startsWith('uploads/'));
                        const isPdf = typeof item.content === 'string' && (
                            item.content.toLowerCase().endsWith('.pdf') || 
                            item.content.startsWith('data:application/pdf') ||
                            (item.type === 'note' && isDiskFile)
                        );
                        const isVideo = (
                            item.type === 'video' || 
                            (typeof item.content === 'string' && (item.content.toLowerCase().endsWith('.mp4') || item.content.toLowerCase().endsWith('.webm')))
                        ) && isDiskFile;

                        if (isPdf && isDiskFile) {
                            pdfAssets.push({
                                content_item_id: item.id,
                                title: item.title,
                                source_url: item.content,
                                module_title: mod.title
                            });
                        }

                        if (isVideo) {
                            videoAssets.push({
                                content_item_id: item.id,
                                title: item.title,
                                source_url: item.content,
                                module_title: mod.title
                            });
                        }
                    });
                }
            });
        }

        const totalTasks = pdfAssets.length + videoAssets.length;

        // Upsert CourseVersion record
        let [version] = await CourseVersion.findOrCreate({
            where: { course_id: course.id, language_code: targetLang },
            defaults: {
                status: 'GENERATING',
                progress: 5,
                total_files: totalTasks,
                completed_files: 0
            }
        });

        version.status = 'GENERATING';
        version.progress = 5;
        version.total_files = totalTasks;
        version.completed_files = 0;
        version.error_message = null;
        await version.save();

        console.log(`🚀 [${targetLang.toUpperCase()} Generation] Dispatched for Course ${course.id} ("${course.title}"): ${pdfAssets.length} PDFs, ${videoAssets.length} Videos`);

        // 1. Dispatch PDF translation if any
        if (pdfAssets.length > 0) {
            const pdfCallbackUrl = `http://127.0.0.1:${process.env.PORT || 8000}/api/v1/courses/${course.id}/languages/${targetLang}/progress`;
            axios.post(`${LANGUAGE_SERVICE_URL}/api/courses/${course.id}/process`, {
                course_id: course.id,
                course_title: course.title,
                pdf_assets: pdfAssets,
                target_language: targetLang,
                callback_url: pdfCallbackUrl
            }).catch(err => {
                console.warn(`[LanguageService PDF] Background notice: ${err.message}`);
            });
        }

        // 2. Dispatch Video Subtitles generation if any
        if (videoAssets.length > 0) {
            const subCallbackUrl = `http://127.0.0.1:${process.env.PORT || 8000}/api/v1/courses/${course.id}/subtitles/${targetLang}/progress`;
            axios.post(`${LANGUAGE_SERVICE_URL}/api/courses/${course.id}/subtitles/process`, {
                course_id: course.id,
                course_title: course.title,
                video_assets: videoAssets,
                target_language: targetLang,
                callback_url: subCallbackUrl
            }).catch(err => {
                console.warn(`[LanguageService Subtitles] Background notice: ${err.message}`);
            });
        }

        // 3. Dispatch Manual Quiz translation if any
        const courseQuizzes = await Quiz.findAll({
            where: { course_id: course.id, quiz_type: 'manual' }
        });
        if (courseQuizzes.length > 0) {
            for (const q of courseQuizzes) {
                translateQuizToLanguage(q.id, targetLang).catch(err => {
                    console.warn(`[Auto Quiz Translation] Course ${course.id} Quiz ${q.id} error:`, err.message);
                });
            }
        }

        // If no assets to translate, mark READY immediately
        if (totalTasks === 0 && courseQuizzes.length === 0) {
            version.status = 'READY';
            version.progress = 100;
            await version.save();
        }

        res.json({
            message: `${targetLang.toUpperCase()} translation job started successfully`,
            status: (totalTasks === 0 && courseQuizzes.length === 0) ? "READY" : "GENERATING",
            course_id: course.id,
            language_code: targetLang,
            total_files: totalTasks,
            pdf_count: pdfAssets.length,
            video_count: videoAssets.length,
            quiz_count: courseQuizzes.length
        });

    } catch (error) {
        console.error(`Trigger ${targetLang} generation error:`, error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
}

/**
 * POST /api/v1/courses/:course_id/languages/:lang/generate
 */
router.post('/:course_id/languages/:lang/generate', authMiddleware, async (req, res) => {
    const lang = req.params.lang || 'hi';
    return triggerLanguageGeneration(req, res, lang);
});

/**
 * POST /api/v1/courses/:course_id/subtitles/:lang/generate
 * Dedicated trigger for generating only video subtitles
 */
router.post('/:course_id/subtitles/:lang/generate', authMiddleware, async (req, res) => {
    try {
        const targetLang = req.params.lang || 'hi';
        const course = await Course.findOne({
            where: { id: req.params.course_id, instructor_id: req.user.id },
            include: [
                {
                    model: Module,
                    include: [{ model: ContentItem, as: 'items' }]
                }
            ]
        });

        if (!course) return res.status(404).json({ detail: "Course not found or unauthorized" });

        const videoAssets = [];
        if (course.Modules) {
            course.Modules.forEach(mod => {
                if (mod.items) {
                    mod.items.forEach(item => {
                        const isDiskFile = typeof item.content === 'string' && (item.content.startsWith('/uploads/') || item.content.startsWith('uploads/'));
                        const isVideo = (
                            item.type === 'video' || 
                            (typeof item.content === 'string' && (item.content.toLowerCase().endsWith('.mp4') || item.content.toLowerCase().endsWith('.webm')))
                        ) && isDiskFile;

                        if (isVideo) {
                            videoAssets.push({
                                content_item_id: item.id,
                                title: item.title,
                                source_url: item.content,
                                module_title: mod.title
                            });
                        }
                    });
                }
            });
        }

        if (videoAssets.length === 0) {
            return res.json({ message: "No eligible disk MP4 video files found in this course", total_videos: 0 });
        }

        const subCallbackUrl = `http://127.0.0.1:${process.env.PORT || 8000}/api/v1/courses/${course.id}/subtitles/${targetLang}/progress`;
        axios.post(`${LANGUAGE_SERVICE_URL}/api/courses/${course.id}/subtitles/process`, {
            course_id: course.id,
            course_title: course.title,
            video_assets: videoAssets,
            target_language: targetLang,
            callback_url: subCallbackUrl
        }).catch(err => {
            console.warn(`[Subtitle Trigger] Background notice: ${err.message}`);
        });

        res.json({
            message: `${targetLang.toUpperCase()} video subtitle generation started`,
            course_id: course.id,
            language_code: targetLang,
            total_videos: videoAssets.length
        });
    } catch (error) {
        console.error("Trigger subtitles error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

/**
 * GET /api/v1/courses/:course_id/languages/:lang/status
 */
router.get('/:course_id/languages/:lang/status', authMiddleware, async (req, res) => {
    try {
        const lang = req.params.lang || 'hi';
        const course = await Course.findOne({
            where: { id: req.params.course_id },
            include: [
                {
                    model: Module,
                    include: [{ model: ContentItem, as: 'items' }]
                }
            ]
        });
        if (!course) return res.status(404).json({ detail: "Course not found" });

        // Count active notes
        const activeNoteIds = [];
        if (course.Modules) {
            course.Modules.forEach(m => {
                if (m.items) {
                    m.items.forEach(i => {
                        if (i.type === 'note' || (typeof i.content === 'string' && i.content.endsWith('.pdf'))) {
                            activeNoteIds.push(i.id);
                        }
                    });
                }
            });
        }
        const totalNotes = activeNoteIds.length;

        const version = await CourseVersion.findOne({
            where: { course_id: req.params.course_id, language_code: lang }
        });

        if (!version) {
            return res.json({
                language: lang,
                status: 'NOT_GENERATED',
                progress: 0,
                total_files: totalNotes,
                completed_files: 0,
                current_file: null
            });
        }

        let completedNotes = 0;
        if (activeNoteIds.length > 0) {
            const translations = await ContentItemTranslation.findAll({
                where: {
                    content_item_id: activeNoteIds,
                    language_code: lang,
                    status: 'READY'
                }
            });
            completedNotes = translations.length;
        }

        let computedStatus = version.status;
        let computedProgress = version.progress;
        let currentFile = version.current_file;

        if (totalNotes === 0) {
            computedStatus = 'READY';
            computedProgress = 100;
            currentFile = null;
        } else if (completedNotes === totalNotes) {
            computedStatus = 'READY';
            computedProgress = 100;
            currentFile = null;
        } else if (version.status === 'GENERATING') {
            const lastUpdated = new Date(version.updatedAt).getTime();
            if (Date.now() - lastUpdated > 180000) {
                computedStatus = completedNotes > 0 ? 'READY' : 'NOT_GENERATED';
                computedProgress = Math.round((completedNotes / totalNotes) * 100);
                currentFile = null;
            }
        }

        version.total_files = totalNotes;
        version.completed_files = completedNotes;
        version.status = computedStatus;
        version.progress = computedProgress;
        version.current_file = currentFile;
        await version.save();

        res.json({
            language: lang,
            status: computedStatus,
            progress: computedProgress,
            total_files: totalNotes,
            completed_files: completedNotes,
            current_file: currentFile,
            error_message: version.error_message,
            updated_at: version.updatedAt
        });
    } catch (error) {
        console.error("Fetch language status error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});


/**
 * POST /api/v1/courses/:course_id/languages/:lang/progress
 * Webhook/callback from Python Language Service to update PDF progress
 */
router.post('/:course_id/languages/:lang/progress', async (req, res) => {
    try {
        const targetLang = req.params.lang || req.body.language_code || 'hi';
        const { course_id, status, progress, total_files, completed_files, current_file, translated_title, results } = req.body;

        const version = await CourseVersion.findOne({
            where: { course_id: course_id, language_code: targetLang }
        });

        if (version) {
            if (status) version.status = status;
            if (progress !== undefined) version.progress = progress;
            if (total_files !== undefined) version.total_files = total_files;
            if (completed_files !== undefined) version.completed_files = completed_files;
            if (current_file !== undefined) version.current_file = current_file;
            if (translated_title) version.title = translated_title;
            await version.save();
        }

        // Save individual translated asset records
        if (Array.isArray(results)) {
            for (const r of results) {
                if (r.content_item_id && r.content) {
                    await ContentItemTranslation.upsert({
                        content_item_id: r.content_item_id,
                        language_code: targetLang,
                        title: r.title,
                        content: r.content,
                        status: r.status || 'READY'
                    });
                }
            }
        }

        console.log(`📊 [${targetLang.toUpperCase()} PDF Progress] Course ${course_id}: ${status} (${progress}%) - ${completed_files}/${total_files}`);
        res.json({ ok: true });
    } catch (error) {
        console.error("Update PDF progress webhook error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

/**
 * POST /api/v1/courses/:course_id/subtitles/:lang/progress
 * Webhook/callback from Python Subtitle Processor to update VideoSubtitle records
 */
router.post('/:course_id/subtitles/:lang/progress', async (req, res) => {
    try {
        const targetLang = req.params.lang || req.body.language_code || 'hi';
        const { course_id, status, progress, total_videos, completed_videos, current_file, results } = req.body;

        if (Array.isArray(results)) {
            for (const r of results) {
                if (r.content_item_id && r.vtt_path) {
                    const [sub] = await VideoSubtitle.findOrCreate({
                        where: {
                            content_item_id: r.content_item_id,
                            language_code: targetLang
                        },
                        defaults: {
                            vtt_path: r.vtt_path,
                            transcript_path: r.transcript_path,
                            status: r.status || 'READY',
                            segment_count: r.segment_count || 0,
                            duration_seconds: r.duration_seconds || 0
                        }
                    });

                    sub.vtt_path = r.vtt_path;
                    sub.transcript_path = r.transcript_path;
                    sub.status = r.status || 'READY';
                    sub.segment_count = r.segment_count || 0;
                    sub.duration_seconds = r.duration_seconds || 0;
                    await sub.save();
                }
            }
        }

        console.log(`🎬 [${targetLang.toUpperCase()} Subtitle Progress] Course ${course_id}: ${status} (${progress}%) - ${completed_videos}/${total_videos}`);
        res.json({ ok: true });
    } catch (error) {
        console.error("Update subtitle progress webhook error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// ============================================
// 🎙️ NATURAL TAMIL VOICE DUBBING ENDPOINTS
// ============================================

/**
 * POST /api/v1/courses/:course_id/items/:item_id/voice/reference
 * Extract or preview instructor reference voice (auto or manual timestamp selection)
 */
router.post('/:course_id/items/:item_id/voice/reference', authMiddleware, async (req, res) => {
    try {
        const { item_id } = req.params;
        const { mode = 'auto', start_time, end_time, custom_transcript } = req.body;

        const item = await ContentItem.findOne({ where: { id: item_id } });
        if (!item) return res.status(404).json({ detail: "Lesson item not found" });

        if (item.type !== 'video') {
            return res.status(400).json({ detail: "Reference voice can only be extracted from video lessons" });
        }

        // Locate video file on disk
        let videoRelative = item.content.startsWith('/') ? item.content.slice(1) : item.content;
        let videoDiskPath = path.resolve(__dirname, '..', videoRelative);

        if (!fs.existsSync(videoDiskPath)) {
            return res.status(404).json({ detail: `Video file not found at path: ${item.content}` });
        }

        // Fetch subtitle transcript if available to provide English segments
        let englishSegments = [];
        const stem = path.basename(videoDiskPath, path.extname(videoDiskPath));
        const engJsonPath = path.resolve(__dirname, '..', 'uploads', 'media', 'subtitles', `${stem}.json`);
        if (fs.existsSync(engJsonPath)) {
            try {
                const raw = JSON.parse(fs.readFileSync(engJsonPath, 'utf8'));
                englishSegments = raw.segments || [];
            } catch (e) {
                console.warn("Could not read English subtitle JSON:", e);
            }
        }

        // Call language service
        const response = await axios.post(`${LANGUAGE_SERVICE_URL}/api/voice/reference`, {
            source_media_path: videoDiskPath,
            mode,
            start_time: start_time ? parseFloat(start_time) : undefined,
            end_time: end_time ? parseFloat(end_time) : undefined,
            custom_transcript,
            english_segments: englishSegments.length > 0 ? englishSegments : undefined
        });

        // Save reference voice metadata to DB asset
        const [asset] = await VideoDubbedAsset.findOrCreate({
            where: { content_item_id: item.id, language_code: 'ta' },
            defaults: {
                course_id: item.course_id,
                status: 'NOT_GENERATED',
                reference_mode: mode
            }
        });

        if (response.data && response.data.reference_audio_path) {
            asset.reference_voice_path = response.data.reference_audio_path;
            asset.reference_transcript = response.data.reference_transcript;
            asset.reference_mode = mode;
            asset.ref_start_time = response.data.start_time;
            asset.ref_end_time = response.data.end_time;
            await asset.save();
        }

        res.json({
            ok: true,
            ...response.data
        });
    } catch (error) {
        console.error("Extract reference voice error:", error?.response?.data || error.message);
        res.status(500).json({ detail: error?.response?.data?.detail || "Failed to extract reference voice" });
    }
});

/**
 * POST /api/v1/courses/:course_id/items/:item_id/voice/generate
 * Trigger AI4Bharat IndicF5 speech generation and Tamil video dubbing
 */
router.post('/:course_id/items/:item_id/voice/generate', authMiddleware, async (req, res) => {
    try {
        const { course_id, item_id } = req.params;
        const { reference_voice_path, reference_transcript, mode = 'auto', start_time, end_time } = req.body;

        const item = await ContentItem.findOne({ where: { id: item_id } });
        if (!item) return res.status(404).json({ detail: "Lesson item not found" });

        let videoRelative = item.content.startsWith('/') ? item.content.slice(1) : item.content;
        let videoDiskPath = path.resolve(__dirname, '..', videoRelative);

        if (!fs.existsSync(videoDiskPath)) {
            return res.status(404).json({ detail: `Video file not found at path: ${item.content}` });
        }

        // Check for existing reference voice or auto-extract
        let refPath = reference_voice_path;
        let refText = reference_transcript;

        const stem = path.basename(videoDiskPath, path.extname(videoDiskPath));
        const defaultRefWav = path.resolve(__dirname, '..', 'uploads', 'media', 'ref_voices', `${stem}_ref.wav`);
        const defaultRefJson = path.resolve(__dirname, '..', 'uploads', 'media', 'ref_voices', `${stem}_ref.json`);

        if (!refPath && fs.existsSync(defaultRefWav)) {
            refPath = defaultRefWav;
            if (fs.existsSync(defaultRefJson)) {
                try {
                    const rData = JSON.parse(fs.readFileSync(defaultRefJson, 'utf8'));
                    refText = rData.reference_transcript || refText;
                } catch (e) {}
            }
        }

        if (!refPath || !fs.existsSync(refPath)) {
            // Auto extract reference voice first
            let englishSegments = [];
            const engJsonPath = path.resolve(__dirname, '..', 'uploads', 'media', 'subtitles', `${stem}.json`);
            if (fs.existsSync(engJsonPath)) {
                try {
                    const raw = JSON.parse(fs.readFileSync(engJsonPath, 'utf8'));
                    englishSegments = raw.segments || [];
                } catch (e) {}
            }

            const refResp = await axios.post(`${LANGUAGE_SERVICE_URL}/api/voice/reference`, {
                source_media_path: videoDiskPath,
                mode: mode || 'auto',
                start_time: start_time ? parseFloat(start_time) : undefined,
                end_time: end_time ? parseFloat(end_time) : undefined,
                english_segments: englishSegments.length > 0 ? englishSegments : undefined
            });
            refPath = refResp.data.reference_audio_path;
            refText = refResp.data.reference_transcript;
        }

        // Update database record to GENERATING
        const [asset] = await VideoDubbedAsset.findOrCreate({
            where: { content_item_id: item.id, language_code: target_language },
            defaults: {
                course_id: parseInt(course_id),
                status: 'GENERATING',
                progress: 5,
                reference_voice_path: refPath,
                reference_transcript: refText,
                reference_mode: mode
            }
        });

        asset.status = 'GENERATING';
        asset.progress = 5;
        asset.reference_voice_path = refPath;
        asset.reference_transcript = refText;
        asset.reference_mode = mode;
        if (start_time) asset.ref_start_time = parseFloat(start_time);
        if (end_time) asset.ref_end_time = parseFloat(end_time);
        await asset.save();

        const callbackUrl = `http://localhost:8000/api/v1/courses/${course_id}/items/${item_id}/voice/webhook`;

        // Dispatch background generation to Python service
        const genResp = await axios.post(`${LANGUAGE_SERVICE_URL}/api/voice/generate`, {
            source_video_path: videoDiskPath,
            target_language: target_language,
            reference_voice_path: refPath,
            reference_transcript: refText || "Computer science lecture presentation",
            course_id: parseInt(course_id),
            content_item_id: item.id,
            callback_url: callbackUrl
        });

        res.json({
            ok: true,
            message: `${target_language.toUpperCase()} voice dubbing generation started`,
            job_id: genResp.data?.job_id,
            target_language: target_language,
            status: "GENERATING",
            content_item_id: item.id
        });

    } catch (error) {
        console.error("Trigger voice dubbing error:", error?.response?.data || error.message);
        res.status(500).json({ detail: error?.response?.data?.detail || "Failed to start voice dubbing" });
    }
});

/**
 * POST /api/v1/courses/:course_id/items/:item_id/voice/preview
 * Generate a 20-30s preview of the natural Hindi/Tamil voice video
 */
router.post('/:course_id/items/:item_id/voice/preview', authMiddleware, async (req, res) => {
    try {
        const { course_id, item_id } = req.params;
        const { mode = 'auto', start_time, end_time, reference_voice_path, reference_transcript, target_language = 'ta' } = req.body;

        const item = await ContentItem.findOne({ where: { id: item_id } });
        if (!item || item.type !== 'video') {
            return res.status(404).json({ detail: "Video content item not found." });
        }

        let videoDiskPath = resolveDiskMedia(item.content);
        if (!fs.existsSync(videoDiskPath)) {
            return res.status(404).json({ detail: "Physical source video file not found." });
        }

        const stem = path.basename(videoDiskPath, path.extname(videoDiskPath));
        const defaultRefWav = path.resolve(__dirname, '..', 'uploads', 'media', 'ref_voices', `${stem}_ref.wav`);
        let refPath = reference_voice_path || (fs.existsSync(defaultRefWav) ? defaultRefWav : null);
        let refText = reference_transcript || "Computer science lecture presentation";

        const prevResp = await axios.post(`${LANGUAGE_SERVICE_URL}/api/voice/preview`, {
            source_video_path: videoDiskPath,
            target_language: target_language,
            reference_voice_path: refPath,
            reference_transcript: refText,
            course_id: parseInt(course_id),
            content_item_id: item.id
        });

        res.json(prevResp.data);
    } catch (error) {
        console.error("Voice dubbing preview error:", error?.response?.data || error.message);
        res.status(500).json({ detail: error?.response?.data?.detail || "Failed to generate voice preview" });
    }
});

/**
 * POST /api/v1/courses/:course_id/items/:item_id/voice/webhook
 * Webhook callback from Python Voice Dubbing pipeline
 */
router.post('/:course_id/items/:item_id/voice/webhook', async (req, res) => {
    try {
        const { course_id, item_id } = req.params;
        const { dubbed_video_url, voice_audio_url, status = 'COMPLETED', error, target_language = 'ta' } = req.body;

        const asset = await VideoDubbedAsset.findOne({
            where: { content_item_id: item_id, language_code: target_language }
        });

        if (asset) {
            if (status === 'COMPLETED' || dubbed_video_url) {
                asset.status = 'READY';
                asset.progress = 100;
                asset.dubbed_video_path = dubbed_video_url;
                asset.voice_audio_path = voice_audio_url;
                asset.error_message = null;
            } else {
                asset.status = 'FAILED';
                asset.error_message = error || 'Generation failed';
            }
            await asset.save();
        }

        console.log(`🎙️ [${target_language.toUpperCase()} Voice Webhook] Lesson ${item_id}: ${asset ? asset.status : 'Not found'} -> ${dubbed_video_url}`);
        res.json({ ok: true });
    } catch (error) {
        console.error("Voice dubbing webhook error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

/**
 * GET /api/v1/courses/:course_id/items/:item_id/voice/status
 * Check current dubbed voice status and progress for a video item
 */
router.get('/:course_id/items/:item_id/voice/status', authMiddleware, async (req, res) => {
    try {
        const { item_id } = req.params;
        const lang = req.query.lang || req.query.language || req.query.target_language || 'ta';
        const asset = await VideoDubbedAsset.findOne({
            where: { content_item_id: item_id, language_code: lang }
        });

        if (!asset) {
            return res.json({
                status: 'NOT_GENERATED',
                progress: 0,
                target_language: lang,
                dubbed_video_url: null,
                voice_audio_url: null,
                reference_voice_url: null
            });
        }

        res.json({
            status: asset.status,
            progress: asset.progress,
            target_language: asset.language_code || lang,
            dubbed_video_url: asset.dubbed_video_path,
            voice_audio_url: asset.voice_audio_path,
            reference_voice_url: asset.reference_voice_path ? `/uploads/media/ref_voices/${path.basename(asset.reference_voice_path)}` : null,
            reference_transcript: asset.reference_transcript,
            reference_mode: asset.reference_mode,
            ref_start_time: asset.ref_start_time,
            ref_end_time: asset.ref_end_time,
            error_message: asset.error_message
        });
    } catch (error) {
        console.error("Fetch voice status error:", error);
        res.status(500).json({ detail: "Failed to fetch voice dubbing status." });
    }
});

router.get('/:course_id/player', authMiddleware, async (req, res) => {
    try {
        const requestedLang = req.query.lang || 'en';
        const course = await Course.findOne({ 
            where: { id: req.params.course_id },
            include: [
                {
                    model: Module,
                    include: [
                        { model: ContentItem, as: 'items' }
                    ]
                }
            ]
        });
        if (!course) return res.status(404).json({ detail: "Course not found" });

        // Collect all content item IDs
        const itemIds = [];
        if (course.Modules) {
            course.Modules.forEach(m => {
                if (m.items) m.items.forEach(i => itemIds.push(i.id));
            });
        }

        // Fetch all ready VideoSubtitles for items in this course
        const allSubtitles = await VideoSubtitle.findAll({
            where: { content_item_id: itemIds, status: 'READY' }
        });
        const subtitleMap = {}; // { itemId: { hi: vtt_path, ta: vtt_path } }
        allSubtitles.forEach(s => {
            if (!subtitleMap[s.content_item_id]) subtitleMap[s.content_item_id] = {};
            subtitleMap[s.content_item_id][s.language_code] = s;
        });

        // Fetch all ready VideoDubbedAssets for items in this course
        const allDubbed = await VideoDubbedAsset.findAll({
            where: { content_item_id: itemIds, status: 'READY' }
        });
        const dubbedMap = {}; // { itemId: { ta: asset } }
        allDubbed.forEach(d => {
            if (!dubbedMap[d.content_item_id]) dubbedMap[d.content_item_id] = {};
            dubbedMap[d.content_item_id][d.language_code] = d;
        });

        // Check available ready languages
        const versions = await CourseVersion.findAll({
            where: { course_id: course.id, status: 'READY' }
        });
        const readyLangMap = {};
        versions.forEach(v => { readyLangMap[v.language_code] = v; });

        const availableLanguages = [
            { code: 'en', name: 'English', nativeName: 'English', ready: true }
        ];
        if (readyLangMap['hi'] || allSubtitles.some(s => s.language_code === 'hi')) {
            availableLanguages.push({ code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', ready: true });
        }
        if (readyLangMap['ta'] || allSubtitles.some(s => s.language_code === 'ta') || allDubbed.some(d => d.language_code === 'ta')) {
            availableLanguages.push({ code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', ready: true });
        }

        const isRequestedReady = requestedLang !== 'en' && (readyLangMap[requestedLang] || allSubtitles.some(s => s.language_code === requestedLang) || allDubbed.some(d => d.language_code === requestedLang));
        let translationMap = {};
        let activeTitle = course.title;
        let activeDescription = course.description;

        if (isRequestedReady) {
            const currentVer = readyLangMap[requestedLang];
            if (currentVer && currentVer.title) activeTitle = currentVer.title;
            if (currentVer && currentVer.description) activeDescription = currentVer.description;

            const translations = await ContentItemTranslation.findAll({
                where: { content_item_id: itemIds, language_code: requestedLang, status: 'READY' }
            });

            translations.forEach(t => {
                translationMap[t.content_item_id] = t;
            });
        }

        // Fetch all Quizzes for items in this course
        const allQuizzes = await Quiz.findAll({
            where: { content_item_id: itemIds },
            include: [{
                model: QuizQuestion,
                as: 'questions',
                include: [
                    { model: QuizOption, as: 'options' },
                    { model: QuizQuestionTranslation, as: 'translations' }
                ]
            }]
        });

        const quizMap = {};
        let optionTransMap = {};
        if (requestedLang !== 'en' && allQuizzes.length > 0) {
            const allOptIds = [];
            allQuizzes.forEach(qz => qz.questions?.forEach(q => q.options?.forEach(opt => allOptIds.push(opt.id))));
            if (allOptIds.length > 0) {
                const optTranslations = await QuizOptionTranslation.findAll({
                    where: { option_id: allOptIds, language_code: requestedLang }
                });
                optTranslations.forEach(ot => {
                    optionTransMap[ot.option_id] = ot.translated_text;
                });
            }
        }

        allQuizzes.forEach(qz => {
            const structuredQuestions = (qz.questions || []).sort((a, b) => a.order_index - b.order_index).map(q => {
                const qTrans = (q.translations || []).find(t => t.language_code === requestedLang);
                const sortedOptions = (q.options || []).sort((a, b) => a.option_index - b.option_index).map(opt => ({
                    id: opt.id,
                    option_index: opt.option_index,
                    option_text: opt.option_text,
                    translated_option_text: optionTransMap[opt.id] || null
                }));
                return {
                    id: q.id,
                    order_index: q.order_index,
                    question_text: q.question_text,
                    translated_question_text: qTrans ? qTrans.translated_text : null,
                    options: sortedOptions
                };
            });

            quizMap[qz.content_item_id] = {
                id: qz.id,
                title: qz.title,
                description: qz.description,
                quiz_type: qz.quiz_type,
                duration_minutes: qz.duration_minutes,
                is_mandatory: qz.is_mandatory,
                total_questions: structuredQuestions.length,
                questions: structuredQuestions
            };
        });

        // Format for frontend
        const responseData = {
            id: course.id,
            title: activeTitle,
            original_title: course.title,
            description: activeDescription,
            price: course.price,
            image_url: course.image_url,
            is_published: course.is_published,
            is_finalized: course.is_finalized,
            current_language: isRequestedReady ? requestedLang : 'en',
            available_languages: availableLanguages,
            modules: course.Modules ? course.Modules.map(m => ({
                id: m.id,
                title: m.title,
                order: m.order,
                lessons: m.items ? m.items.map(i => {
                    const isBase64 = typeof i.content === 'string' && i.content.startsWith('data:');
                    let contentValue = isBase64 ? `/api/v1/content/media/${i.id}` : i.content;
                    let lessonTitle = i.title;
                    let isTranslated = false;

                    if (isRequestedReady && translationMap[i.id]) {
                        contentValue = translationMap[i.id].content;
                        if (translationMap[i.id].title) lessonTitle = translationMap[i.id].title;
                        isTranslated = true;
                    }

                    // Attach subtitle metadata for video lessons
                    const itemSubs = subtitleMap[i.id] || {};
                    let activeSubtitleUrl = null;
                    let activeTranscriptUrl = null;

                    if (requestedLang !== 'en' && itemSubs[requestedLang]) {
                        activeSubtitleUrl = itemSubs[requestedLang].vtt_path;
                        activeTranscriptUrl = itemSubs[requestedLang].transcript_path;
                    }

                    const availableTracks = [];
                    if (itemSubs['hi']) {
                        availableTracks.push({
                            lang: 'hi',
                            label: 'हिन्दी',
                            src: itemSubs['hi'].vtt_path,
                            segments: itemSubs['hi'].segment_count
                        });
                    }
                    if (itemSubs['ta']) {
                        availableTracks.push({
                            lang: 'ta',
                            label: 'தமிழ்',
                            src: itemSubs['ta'].vtt_path,
                            segments: itemSubs['ta'].segment_count
                        });
                    }

                    // Attach Dubbed Video metadata (e.g. Tamil dubbed video)
                    const itemDubbed = dubbedMap[i.id] || {};
                    let activeDubbedVideoUrl = null;
                    let activeVoiceAudioUrl = null;

                    if (requestedLang !== 'en' && itemDubbed[requestedLang]) {
                        activeDubbedVideoUrl = itemDubbed[requestedLang].dubbed_video_path;
                        activeVoiceAudioUrl = itemDubbed[requestedLang].voice_audio_path;
                    }

                    return {
                        id: i.id,
                        title: lessonTitle,
                        type: i.type,
                        content: contentValue,
                        duration: i.duration,
                        is_mandatory: i.is_mandatory,
                        order: i.order,
                        instructions: i.instructions,
                        is_translated: isTranslated,
                        subtitle_url: activeSubtitleUrl,
                        transcript_url: activeTranscriptUrl,
                        subtitles: availableTracks,
                        dubbed_video_url: activeDubbedVideoUrl,
                        voice_audio_url: activeVoiceAudioUrl,
                        dubbed_assets: itemDubbed,
                        quiz_data: quizMap[i.id] || null
                    };
                }) : []
            })) : []
        };
        res.json(responseData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/:course_id/export', authMiddleware, async (req, res) => {
    try {
        const requestedLang = req.query.lang || 'en';
        const course = await Course.findOne({ 
            where: { id: req.params.course_id },
            include: [
                {
                    model: Module,
                    include: [
                        { model: ContentItem, as: 'items' }
                    ]
                }
            ]
        });
        if (!course) return res.status(404).json({ detail: "Course not found" });

        const itemIds = [];
        if (course.Modules) {
            course.Modules.forEach(m => {
                if (m.items) m.items.forEach(i => itemIds.push(i.id));
            });
        }

        const allSubtitles = await VideoSubtitle.findAll({
            where: { content_item_id: itemIds, status: 'READY' }
        });
        const subtitleMap = {};
        allSubtitles.forEach(s => {
            if (!subtitleMap[s.content_item_id]) subtitleMap[s.content_item_id] = {};
            subtitleMap[s.content_item_id][s.language_code] = s;
        });

        const versions = await CourseVersion.findAll({
            where: { course_id: course.id, status: 'READY' }
        });
        const readyLangMap = {};
        versions.forEach(v => { readyLangMap[v.language_code] = v; });

        const isRequestedReady = requestedLang !== 'en' && readyLangMap[requestedLang];
        let translationMap = {};
        let activeTitle = course.title;

        if (isRequestedReady) {
            const currentVer = readyLangMap[requestedLang];
            if (currentVer.title) activeTitle = currentVer.title;
            const translations = await ContentItemTranslation.findAll({
                where: { language_code: requestedLang, status: 'READY' }
            });
            translations.forEach(t => translationMap[t.content_item_id] = t);
        }

        // Build the complete skillforge export JSON with subtitle tracks
        const exportData = {
            metadata: {
                id: course.id.toString(),
                title: activeTitle,
                original_title: course.title,
                language: isRequestedReady ? requestedLang : 'en',
                description: course.description,
                price: course.price,
                image_url: course.image_url,
                instructor_id: course.instructor_id ? course.instructor_id.toString() : '',
                exported_at: new Date().toISOString()
            },
            modules: course.Modules ? course.Modules.map(m => ({
                id: m.id.toString(),
                title: m.title,
                order: m.order,
                lessons: m.items ? m.items.map(i => {
                    const isBase64 = typeof i.content === 'string' && i.content.startsWith('data:');
                    let contentValue = isBase64 ? '' : i.content;
                    let mediaUrl = isBase64 ? `/api/v1/content/media/${i.id}` : null;
                    let lessonTitle = i.title;

                    if (isRequestedReady && translationMap[i.id]) {
                        contentValue = translationMap[i.id].content;
                        if (translationMap[i.id].title) lessonTitle = translationMap[i.id].title;
                    }

                    const itemSubs = subtitleMap[i.id] || {};
                    const subsList = [];
                    if (itemSubs['hi']) {
                        subsList.push({ lang: 'hi', vtt_path: itemSubs['hi'].vtt_path });
                    }
                    if (itemSubs['ta']) {
                        subsList.push({ lang: 'ta', vtt_path: itemSubs['ta'].vtt_path });
                    }

                    return {
                        id: i.id.toString(),
                        title: lessonTitle,
                        type: i.type,
                        content: contentValue,
                        media_url: mediaUrl,
                        duration: i.duration,
                        instructions: i.instructions,
                        test_config: i.test_config,
                        is_mandatory: i.is_mandatory,
                        order: i.order,
                        subtitles: subsList
                    };
                }) : []
            })) : []
        };
        res.json(exportData);
    } catch (error) {
        console.error("Export error:", error);

        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/instructor/batches', authMiddleware, async (req, res) => {
    try {
        const courses = await Course.findAll({ where: { instructor_id: req.user.id } });
        const courseIds = courses.map(c => c.id);
        const batches = await CourseBatch.findAll({
            where: { course_id: courseIds },
            include: [{ model: Course, as: 'course' }, { model: SchoolClass, as: 'schoolClass' }]
        });
        
        const result = [];
        for (const b of batches) {
            const count = await Enrollment.count({ where: { batch_id: b.id } });
            result.push({ ...b.toJSON(), enrolled_count: count });
        }
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === "instructor") {
            const courses = await Course.findAll({ 
                where: { instructor_id: req.user.id },
                include: [{ model: SchoolClass, as: 'schoolClass' }, { model: CourseBatch, as: 'batches' }]
            });
            const result = [];
            for (const c of courses) {
                const student_count = await Enrollment.count({ where: { course_id: c.id } });
                result.push({
                    id: c.id,
                    title: c.title,
                    description: c.description,
                    price: c.price,
                    image_url: c.image_url,
                    is_published: c.is_published,
                    is_finalized: c.is_finalized,
                    school_class: c.schoolClass ? c.schoolClass.name : null,
                    school_class_id: c.school_class_id,
                    batches: c.batches ? c.batches.length : 0,
                    students: student_count,
                    rating: student_count > 0 ? Math.round((4.5 + (student_count % 5) * 0.1) * 10) / 10 : 0,
                });
            }
            return res.json(result);
        }
        const query = { is_published: true };
        if (req.user.school_class_id) query.school_class_id = req.user.school_class_id;
        const publishedCourses = await Course.findAll({ where: query });
        res.json(publishedCourses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, description, price, school_class_id, image_url } = req.body;
        const new_course = await Course.create({ 
            title, 
            description, 
            price, 
            image_url: image_url || null,
            school_class_id: school_class_id !== "none" ? school_class_id : null,
            instructor_id: req.user.id 
        });
        res.json(new_course);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/:course_id/export', authMiddleware, async (req, res) => {
    try {
        const course = await Course.findOne({ 
            where: { id: req.params.course_id },
            include: [
                {
                    model: Module,
                    include: [
                        { model: ContentItem, as: 'items' }
                    ]
                }
            ]
        });
        if (!course) return res.status(404).json({ detail: "Course not found" });

        // Build the complete skillforge export JSON
        const exportData = {
            metadata: {
                id: course.id.toString(),
                title: course.title,
                description: course.description,
                price: course.price,
                image_url: course.image_url,
                instructor_id: course.instructor_id ? course.instructor_id.toString() : '',
                exported_at: new Date().toISOString()
            },
            modules: course.Modules ? course.Modules.map(m => ({
                id: m.id.toString(),
                title: m.title,
                order: m.order,
                lessons: m.items ? m.items.map(i => {
                    const isBase64 = typeof i.content === 'string' && i.content.startsWith('data:');
                    return {
                        id: i.id.toString(),
                        title: i.title,
                        type: i.type,
                        content: isBase64 ? '' : i.content, // Don't crash mobile JSON parser
                        media_url: isBase64 ? `/api/v1/content/media/${i.id}` : null,
                        duration: i.duration,
                        instructions: i.instructions,
                        test_config: i.test_config,
                        is_mandatory: i.is_mandatory,
                        order: i.order
                    };
                }) : []
            })) : []
        };
        res.json(exportData);
    } catch (error) {
        console.error("Export error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.post('/:course_id/modules', authMiddleware, async (req, res) => {
    try {
        const new_module = await Module.create({ ...req.body, course_id: req.params.course_id });
        res.json(new_module);
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/:course_id/modules', authMiddleware, async (req, res) => {
    try {
        const modules = await Module.findAll({ 
            where: { course_id: req.params.course_id },
            order: [['order', 'ASC']]
        });
        res.json(modules);
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.patch('/:course_id/publish', authMiddleware, async (req, res) => {
    try {
        const course = await Course.findByPk(req.params.course_id);
        if (!course) return res.status(404).json({ detail: "Not found" });
        course.is_published = true;
        await course.save();
        res.json({ message: "Published" });
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.patch('/:course_id/finalize', authMiddleware, async (req, res) => {
    try {
        const course = await Course.findOne({ where: { id: req.params.course_id, instructor_id: req.user.id } });
        if (!course) return res.status(404).json({ detail: "Not found" });
        course.is_finalized = true;
        await course.save();
        res.json({ message: "Finalized" });
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Reorder modules inside a course
router.patch('/:course_id/modules/reorder', authMiddleware, async (req, res) => {
    try {
        const { module_ids } = req.body;
        if (!Array.isArray(module_ids)) {
            return res.status(400).json({ detail: "module_ids must be an array" });
        }
        
        const course = await Course.findOne({ where: { id: req.params.course_id, instructor_id: req.user.id } });
        if (!course) return res.status(404).json({ detail: "Course not found or unauthorized" });

        for (let i = 0; i < module_ids.length; i++) {
            await Module.update({ order: i }, { where: { id: module_ids[i], course_id: req.params.course_id } });
        }
        res.json({ message: "Modules reordered successfully" });
    } catch (error) {
        console.error("Reorder modules error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Reorder lessons across/inside modules of a course
router.patch('/:course_id/lessons/reorder', authMiddleware, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ detail: "items must be an array" });
        }

        const course = await Course.findOne({ where: { id: req.params.course_id, instructor_id: req.user.id } });
        if (!course) return res.status(404).json({ detail: "Course not found or unauthorized" });

        for (const item of items) {
            const { lesson_id, module_id, order } = item;
            await ContentItem.update({ module_id, order }, { where: { id: lesson_id } });
        }
        res.json({ message: "Lessons reordered successfully" });
    } catch (error) {
        console.error("Reorder lessons error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Update course settings
router.patch('/:course_id/settings', authMiddleware, async (req, res) => {
    try {
        const course = await Course.findOne({ where: { id: req.params.course_id, instructor_id: req.user.id } });
        if (!course) return res.status(404).json({ detail: "Course not found or unauthorized" });

        const { title, description, price, image_url } = req.body;
        if (title !== undefined) course.title = title;
        if (description !== undefined) course.description = description;
        if (price !== undefined) course.price = price;
        if (image_url !== undefined) course.image_url = image_url;

        await course.save();
        res.json({ message: "Course settings updated successfully", course });
    } catch (error) {
        console.error("Update course settings error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Delete a course
router.delete('/:course_id', authMiddleware, async (req, res) => {
    try {
        const course = await Course.findOne({ where: { id: req.params.course_id, instructor_id: req.user.id } });
        if (!course) return res.status(404).json({ detail: "Course not found or unauthorized" });
        
        await course.destroy();
        res.json({ message: "Course deleted successfully" });
    } catch (error) {
        console.error("Delete course error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// --- BATCH MANAGEMENT ROUTES ---

router.post('/:course_id/batches', authMiddleware, async (req, res) => {
    try {
        const course = await Course.findOne({ where: { id: req.params.course_id, instructor_id: req.user.id } });
        if (!course) return res.status(404).json({ detail: 'Course not found' });

        const { name, school_class_id, student_ids } = req.body;
        if (!school_class_id) {
            return res.status(400).json({ detail: 'Target School Class is required' });
        }

        const newBatch = await CourseBatch.create({
            name,
            section: 'Manual',
            course_id: course.id,
            school_class_id: school_class_id
        });
        
        if (student_ids && Array.isArray(student_ids)) {
            for (const uid of student_ids) {
                const existing = await Enrollment.findOne({ where: { user_id: uid, course_id: course.id } });
                if (!existing) {
                    await Enrollment.create({ user_id: uid, course_id: course.id, batch_id: newBatch.id, enrollment_type: 'batch_enrolled' });
                } else if (!existing.batch_id) {
                    existing.batch_id = newBatch.id;
                    await existing.save();
                }
            }
        }
        
        res.status(201).json(newBatch);
    } catch (error) {
        console.error('Create batch error:', error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

router.get('/:course_id/batches', authMiddleware, async (req, res) => {
    try {
        const batches = await CourseBatch.findAll({ 
            where: { course_id: req.params.course_id },
            include: [{ model: SchoolClass, as: 'schoolClass' }]
        });
        
        const result = [];
        for (const b of batches) {
            const count = await Enrollment.count({ where: { batch_id: b.id } });
            result.push({ ...b.toJSON(), enrolled_count: count });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

router.get('/batches/:batch_id/students', authMiddleware, async (req, res) => {
    try {
        const enrollments = await Enrollment.findAll({
            where: { batch_id: req.params.batch_id },
            include: [{ model: User, as: 'student' }]
        });
        res.json(enrollments.map(e => e.student).filter(u => u != null));
    } catch (error) {
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

router.post('/batches/:batch_id/students', authMiddleware, async (req, res) => {
    try {
        const batch = await CourseBatch.findByPk(req.params.batch_id);
        if (!batch) return res.status(404).json({ detail: 'Batch not found' });
        
        const { student_id } = req.body;
        const existing = await Enrollment.findOne({ where: { user_id: student_id, course_id: batch.course_id } });
        
        if (!existing) {
            await Enrollment.create({ user_id: student_id, course_id: batch.course_id, batch_id: batch.id, enrollment_type: 'batch_enrolled' });
        } else {
            existing.batch_id = batch.id;
            await existing.save();
        }
        res.json({ message: 'Student added to batch' });
    } catch (error) {
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

router.delete('/batches/:batch_id/students/:user_id', authMiddleware, async (req, res) => {
    try {
        await Enrollment.destroy({
            where: { batch_id: req.params.batch_id, user_id: req.params.user_id }
        });
        res.json({ message: 'Student removed from batch and course' });
    } catch (error) {
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

router.patch('/batches/students/:user_id/reset-password', authMiddleware, async (req, res) => {
    try {
        const student = await User.findByPk(req.params.user_id);
        if (!student) return res.status(404).json({ detail: 'Not found' });
        const { new_password } = req.body;
        student.hashed_password = await getPasswordHash(new_password);
        student.temp_password = new_password;
        await student.save();
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

router.patch('/batches/:batch_id', authMiddleware, async (req, res) => {
    try {
        const batch = await CourseBatch.findByPk(req.params.batch_id);
        if (!batch) return res.status(404).json({ detail: 'Batch not found' });
        
        const { name } = req.body;
        if (name) {
            batch.name = name;
            await batch.save();
        }
        res.json(batch);
    } catch (error) {
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

router.delete('/batches/:batch_id', authMiddleware, async (req, res) => {
    try {
        const batch = await CourseBatch.findByPk(req.params.batch_id);
        if (!batch) return res.status(404).json({ detail: 'Batch not found' });
        
        // Remove batch references in enrollments without deleting the enrollments completely?
        // Wait, if a batch is deleted, maybe enrollments just lose batch_id or get deleted.
        // Let's just nullify batch_id for all students in this batch, or delete their enrollments.
        // Usually deleting a batch deletes the students from the course if they were batch_enrolled.
        await Enrollment.destroy({ where: { batch_id: batch.id } });
        await batch.destroy();
        
        res.json({ message: 'Batch deleted' });
    } catch (error) {
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

router.get('/:course_id/analytics', authMiddleware, async (req, res) => {
    try {
        const course_id = req.params.course_id;
        
        const course = await Course.findOne({ 
            where: { id: course_id, instructor_id: req.user.id },
            include: [{ model: Module, include: [{ model: ContentItem, as: 'items' }] }]
        });
        if (!course) return res.status(404).json({ detail: 'Course not found' });

        const enrollments = await Enrollment.findAll({ where: { course_id } });
        const totalEnrollments = enrollments.length;

        let totalItems = 0;
        const itemIds = [];
        if (course.Modules) {
            course.Modules.forEach(m => {
                if (m.items) {
                    m.items.forEach(i => {
                        totalItems++;
                        itemIds.push(i.id);
                    });
                }
            });
        }

        const studentIds = enrollments.map(e => e.user_id);
        const progressRecords = await LessonProgress.findAll({ 
            where: { user_id: studentIds, content_item_id: itemIds } 
        });

        const progressByUser = {};
        studentIds.forEach(id => progressByUser[id] = 0);
        progressRecords.forEach(p => {
            if (progressByUser[p.user_id] !== undefined) {
                progressByUser[p.user_id]++;
            }
        });

        const funnel = { complete: 0, active: 0, started: 0, inactive: 0 };
        let activeLearners = 0;

        for (const uid of studentIds) {
            const completed = progressByUser[uid] || 0;
            if (completed > 0) activeLearners++;
            
            if (totalItems === 0) {
                funnel.inactive++;
                continue;
            }

            const pct = (completed / totalItems) * 100;
            if (pct === 100) funnel.complete++;
            else if (pct >= 50) funnel.active++;
            else if (pct > 0) funnel.started++;
            else funnel.inactive++;
        }

        const dailyEngagement = [0, 0, 0, 0, 0, 0, 0];
        const now = new Date();
        now.setHours(0, 0, 0, 0); // start of today
        
        progressRecords.forEach(p => {
            const date = new Date(p.completed_at);
            date.setHours(0, 0, 0, 0);
            const daysAgo = Math.round((now - date) / (1000 * 60 * 60 * 24));
            if (daysAgo >= 0 && daysAgo < 7) {
                dailyEngagement[6 - daysAgo]++;
            }
        });

        res.json({
            totalEnrollments,
            activeLearners,
            totalItems,
            funnel,
            dailyEngagement
        });
    } catch (error) {
        console.error("Course Analytics Error:", error);
        res.status(500).json({ detail: 'Internal Server Error' });
    }
});

module.exports = router;
