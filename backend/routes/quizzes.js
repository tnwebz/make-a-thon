const express = require('express');
const router = express.Router();
const axios = require('axios');
const { 
    Quiz, 
    QuizQuestion, 
    QuizOption, 
    QuizQuestionTranslation, 
    QuizOptionTranslation, 
    QuizResult, 
    ContentItem, 
    Module, 
    Course, 
    CourseVersion,
    LessonProgress 
} = require('../models');
const { authMiddleware } = require('../middleware/auth');

const LANGUAGE_SERVICE_URL = process.env.LANGUAGE_SERVICE_URL || 'http://127.0.0.1:8001';

/**
 * 🌐 Helper function to translate a Quiz into Hindi or Tamil
 */
async function translateQuizToLanguage(quizId, targetLang) {
    const quiz = await Quiz.findOne({
        where: { id: quizId },
        include: [{
            model: QuizQuestion,
            as: 'questions',
            include: [{ model: QuizOption, as: 'options' }]
        }]
    });

    if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        return { success: false, detail: "Quiz has no questions" };
    }

    const tgtCode = targetLang === 'hi' ? 'hin_Deva' : (targetLang === 'ta' ? 'tam_Taml' : targetLang);
    const srcCode = 'eng_Latn';

    // Collect all texts to translate in one batch call
    const textsToTranslate = [];
    const mapping = [];

    quiz.questions.forEach(q => {
        const qTextIdx = textsToTranslate.length;
        textsToTranslate.push(q.question_text || "");

        const optMap = [];
        const sortedOptions = (q.options || []).sort((a, b) => a.option_index - b.option_index);
        sortedOptions.forEach(opt => {
            const optTextIdx = textsToTranslate.length;
            textsToTranslate.push(opt.option_text || "");
            optMap.push({
                option_id: opt.id,
                option_index: opt.option_index,
                text_idx: optTextIdx
            });
        });

        mapping.push({
            question_id: q.id,
            q_text_idx: qTextIdx,
            options: optMap
        });
    });

    try {
        const res = await axios.post(`${LANGUAGE_SERVICE_URL}/api/translate/text`, {
            texts: textsToTranslate,
            src_lang: srcCode,
            tgt_lang: tgtCode
        }, { timeout: 60000 });

        const translatedTexts = res.data.translations || [];

        // Save translations in DB
        for (const item of mapping) {
            const transQText = translatedTexts[item.q_text_idx] || "";
            if (transQText) {
                const [qTrans] = await QuizQuestionTranslation.findOrCreate({
                    where: { question_id: item.question_id, language_code: targetLang },
                    defaults: { translated_text: transQText }
                });
                qTrans.translated_text = transQText;
                await qTrans.save();
            }

            for (const opt of item.options) {
                const transOptText = translatedTexts[opt.text_idx] || "";
                if (transOptText) {
                    const [optTrans] = await QuizOptionTranslation.findOrCreate({
                        where: { option_id: opt.option_id, language_code: targetLang },
                        defaults: { translated_text: transOptText }
                    });
                    optTrans.translated_text = transOptText;
                    await optTrans.save();
                }
            }
        }

        return { success: true, translated_count: textsToTranslate.length };
    } catch (err) {
        console.error(`[QuizTranslation Error] Quiz ${quizId} to ${targetLang}:`, err.message);
        return { success: false, detail: err.message };
    }
}

/**
 * POST /api/v1/quizzes
 * Create or update a manual quiz with 4 options per question and correct answer
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { 
            id, // Quiz ID if editing
            course_id, 
            module_id, 
            content_item_id, 
            title, 
            description, 
            duration_minutes, 
            is_mandatory, 
            questions 
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ detail: "Quiz title is required." });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ detail: "A manual quiz must contain at least 1 question." });
        }

        // Validate each question
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.question_text || !q.question_text.trim()) {
                return res.status(400).json({ detail: `Question ${i + 1} text cannot be empty.` });
            }
            if (!Array.isArray(q.options) || q.options.length !== 4) {
                return res.status(400).json({ detail: `Question ${i + 1} must have exactly 4 options.` });
            }
            for (let j = 0; j < 4; j++) {
                if (!q.options[j].option_text || !q.options[j].option_text.trim()) {
                    return res.status(400).json({ detail: `Question ${i + 1}, Option ${String.fromCharCode(65 + j)} cannot be empty.` });
                }
            }
            if (typeof q.correct_option_index !== 'number' || q.correct_option_index < 0 || q.correct_option_index > 3) {
                return res.status(400).json({ detail: `Question ${i + 1} must have a valid correct option selected (A, B, C, or D).` });
            }
        }

        let contentItem = null;
        if (content_item_id) {
            contentItem = await ContentItem.findByPk(content_item_id);
            if (contentItem) {
                contentItem.title = title.trim();
                contentItem.duration = parseInt(duration_minutes) || 15;
                contentItem.is_mandatory = !!is_mandatory;
                contentItem.instructions = description || null;
                await contentItem.save();
            }
        } else if (module_id) {
            const maxOrder = await ContentItem.max('order', { where: { module_id } }) || 0;
            contentItem = await ContentItem.create({
                title: title.trim(),
                type: 'quiz',
                duration: parseInt(duration_minutes) || 15,
                is_mandatory: !!is_mandatory,
                order: maxOrder + 1,
                instructions: description || null,
                module_id: parseInt(module_id)
            });
        }

        if (!contentItem) {
            return res.status(400).json({ detail: "Content item or Module ID is required." });
        }

        // Upsert Quiz
        let [quiz] = await Quiz.findOrCreate({
            where: { content_item_id: contentItem.id },
            defaults: {
                course_id: parseInt(course_id),
                title: title.trim(),
                description: description || null,
                quiz_type: 'manual',
                duration_minutes: parseInt(duration_minutes) || 15,
                is_mandatory: !!is_mandatory,
                created_by: req.user.id
            }
        });

        quiz.title = title.trim();
        quiz.description = description || null;
        quiz.duration_minutes = parseInt(duration_minutes) || 15;
        quiz.is_mandatory = !!is_mandatory;
        quiz.course_id = parseInt(course_id);
        await quiz.save();

        // Clear existing questions if replacing/updating
        const existingQuestions = await QuizQuestion.findAll({ where: { quiz_id: quiz.id } });
        const existingQIds = existingQuestions.map(q => q.id);
        if (existingQIds.length > 0) {
            await QuizOption.destroy({ where: { question_id: existingQIds } });
            await QuizQuestion.destroy({ where: { quiz_id: quiz.id } });
        }

        // Insert new questions and 4 options each
        for (let i = 0; i < questions.length; i++) {
            const qData = questions[i];
            const newQ = await QuizQuestion.create({
                quiz_id: quiz.id,
                question_text: qData.question_text.trim(),
                order_index: i + 1,
                correct_option_index: qData.correct_option_index
            });

            for (let j = 0; j < 4; j++) {
                await QuizOption.create({
                    question_id: newQ.id,
                    option_text: qData.options[j].option_text.trim(),
                    option_index: j
                });
            }
        }

        // Trigger automatic Hindi & Tamil translation in background for active course versions
        const readyVersions = await CourseVersion.findAll({
            where: { course_id: parseInt(course_id), status: 'READY' }
        });
        readyVersions.forEach(v => {
            if (v.language_code === 'hi' || v.language_code === 'ta') {
                translateQuizToLanguage(quiz.id, v.language_code).catch(e => {
                    console.warn(`[Auto Quiz Translation] ${v.language_code} background error:`, e.message);
                });
            }
        });

        const fullQuiz = await Quiz.findOne({
            where: { id: quiz.id },
            include: [{
                model: QuizQuestion,
                as: 'questions',
                include: [{ model: QuizOption, as: 'options' }]
            }]
        });

        res.json({
            message: "Manual Quiz saved successfully",
            quiz: fullQuiz,
            content_item: contentItem
        });
    } catch (error) {
        console.error("Save Manual Quiz error:", error);
        res.status(500).json({ detail: "Failed to save quiz: " + error.message });
    }
});

/**
 * GET /api/v1/quizzes/content-item/:contentItemId
 * Fetch manual quiz data with language translations (for Student / CoursePlayer)
 */
router.get('/content-item/:contentItemId', authMiddleware, async (req, res) => {
    try {
        const lang = req.query.lang || 'en';
        const quiz = await Quiz.findOne({
            where: { content_item_id: req.params.contentItemId },
            include: [{
                model: QuizQuestion,
                as: 'questions',
                include: [
                    { model: QuizOption, as: 'options' },
                    { model: QuizQuestionTranslation, as: 'translations' }
                ]
            }]
        });

        if (!quiz) {
            return res.status(404).json({ detail: "Quiz not found" });
        }

        // Load option translations if language is not English
        let optionTranslationsMap = {};
        if (lang !== 'en') {
            const allOptIds = [];
            quiz.questions.forEach(q => q.options?.forEach(opt => allOptIds.push(opt.id)));
            if (allOptIds.length > 0) {
                const optTrans = await QuizOptionTranslation.findAll({
                    where: { option_id: allOptIds, language_code: lang }
                });
                optTrans.forEach(ot => {
                    optionTranslationsMap[ot.option_id] = ot.translated_text;
                });
            }
        }

        // Map structured questions
        const structuredQuestions = (quiz.questions || [])
            .sort((a, b) => a.order_index - b.order_index)
            .map(q => {
                const qTrans = (q.translations || []).find(t => t.language_code === lang);
                const sortedOptions = (q.options || [])
                    .sort((a, b) => a.option_index - b.option_index)
                    .map(opt => ({
                        id: opt.id,
                        option_index: opt.option_index,
                        option_text: opt.option_text, // English master
                        translated_option_text: optionTranslationsMap[opt.id] || null
                    }));

                return {
                    id: q.id,
                    order_index: q.order_index,
                    question_text: q.question_text, // English master
                    translated_question_text: qTrans ? qTrans.translated_text : null,
                    options: sortedOptions
                    // Note: correct_option_index is withheld during test taking for exam security
                };
            });

        // Check if student already completed this quiz
        const previousResult = await QuizResult.findOne({
            where: { quiz_id: quiz.id, user_id: req.user.id },
            order: [['createdAt', 'DESC']]
        });

        res.json({
            id: quiz.id,
            content_item_id: quiz.content_item_id,
            course_id: quiz.course_id,
            title: quiz.title,
            description: quiz.description,
            duration_minutes: quiz.duration_minutes,
            is_mandatory: quiz.is_mandatory,
            language: lang,
            total_questions: structuredQuestions.length,
            questions: structuredQuestions,
            previous_result: previousResult ? {
                score: previousResult.score,
                total_questions: previousResult.total_questions,
                percentage: previousResult.percentage,
                submitted_at: previousResult.submitted_at
            } : null
        });
    } catch (error) {
        console.error("Fetch Quiz error:", error);
        res.status(500).json({ detail: "Failed to fetch quiz" });
    }
});

/**
 * POST /api/v1/quizzes/:quizId/submit
 * Student online quiz submission with server-side evaluation & score computation
 */
router.post('/:quizId/submit', authMiddleware, async (req, res) => {
    try {
        const quizId = req.params.quizId;
        const { answers, language_code } = req.body; // answers: { [question_id]: selected_option_index }

        const quiz = await Quiz.findOne({
            where: { id: quizId },
            include: [{
                model: QuizQuestion,
                as: 'questions',
                include: [{ model: QuizOption, as: 'options' }]
            }]
        });

        if (!quiz) {
            return res.status(404).json({ detail: "Quiz not found" });
        }

        let correctCount = 0;
        const totalQuestions = quiz.questions.length;
        const questionResults = [];

        quiz.questions.forEach(q => {
            const selectedIdx = answers ? answers[q.id] : undefined;
            const isCorrect = typeof selectedIdx === 'number' && selectedIdx === q.correct_option_index;
            if (isCorrect) correctCount++;

            questionResults.push({
                question_id: q.id,
                question_text: q.question_text,
                selected_option_index: typeof selectedIdx === 'number' ? selectedIdx : null,
                correct_option_index: q.correct_option_index,
                is_correct: isCorrect
            });
        });

        const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
        const passed = percentage >= 60; // 60% standard pass mark

        // Save student result
        const result = await QuizResult.create({
            quiz_id: quiz.id,
            user_id: req.user.id,
            score: correctCount,
            total_questions: totalQuestions,
            percentage,
            selected_answers: JSON.stringify(answers || {}),
            language_code: language_code || 'en',
            status: 'COMPLETED'
        });

        // Mark lesson progress complete
        if (quiz.content_item_id) {
            await LessonProgress.findOrCreate({
                where: { user_id: req.user.id, content_item_id: quiz.content_item_id }
            });
        }

        res.json({
            message: "Quiz submitted successfully",
            result_id: result.id,
            score: correctCount,
            total_questions: totalQuestions,
            percentage,
            passed,
            question_results: questionResults
        });
    } catch (error) {
        console.error("Submit Quiz error:", error);
        res.status(500).json({ detail: "Failed to submit quiz" });
    }
});

/**
 * POST /api/v1/quizzes/:quizId/translate/:lang
 * Translate a specific quiz into target language ('hi' or 'ta')
 */
router.post('/:quizId/translate/:lang', authMiddleware, async (req, res) => {
    try {
        const { quizId, lang } = req.params;
        if (lang !== 'hi' && lang !== 'ta') {
            return res.status(400).json({ detail: "Supported languages are 'hi' and 'ta'" });
        }

        const result = await translateQuizToLanguage(quizId, lang);
        if (result.success) {
            res.json({ message: `Quiz translated to ${lang.toUpperCase()} successfully`, ...result });
        } else {
            res.status(500).json({ detail: result.detail || "Translation failed" });
        }
    } catch (error) {
        console.error("Manual translate quiz error:", error);
        res.status(500).json({ detail: error.message });
    }
});

module.exports = {
    router,
    translateQuizToLanguage
};
