const express = require('express');
const router = express.Router();
const { ContentItem, Submission, User, Course } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { uploadFileToDrive } = require('../utils/drive');
const { createCertificatePDF } = require('../utils/pdf');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', authMiddleware, async (req, res) => {
    try {
        const new_content = await ContentItem.create({
            ...req.body,
            content: req.body.data_url,
            order: 0
        });
        res.json({ message: "Content added", id: new_content.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.post('/assignment-upload', authMiddleware, upload.single('file'), async (req, res) => {
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
        
        await item.update({
            title: req.body.title || item.title,
            content: req.body.url || item.content,
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
        await item.destroy();
        res.json({ message: "Deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
