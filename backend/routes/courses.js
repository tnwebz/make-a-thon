const express = require('express');
const router = express.Router();
const { Course, Module, ContentItem, Enrollment, LessonProgress, SchoolClass, CourseBatch, User } = require('../models');
const { authMiddleware, getPasswordHash } = require('../middleware/auth');

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
        const { title, description, price, school_class_id } = req.body;
        const new_course = await Course.create({ 
            title, 
            description, 
            price, 
            school_class_id: school_class_id !== "none" ? school_class_id : null,
            instructor_id: req.user.id 
        });
        res.json(new_course);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/:course_id/player', authMiddleware, async (req, res) => {
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

        // Format for frontend
        const responseData = {
            id: course.id,
            title: course.title,
            description: course.description,
            price: course.price,
            image_url: course.image_url,
            is_published: course.is_published,
            is_finalized: course.is_finalized,
            modules: course.Modules ? course.Modules.map(m => ({
                id: m.id,
                title: m.title,
                order: m.order,
                lessons: m.items ? m.items.map(i => ({
                    id: i.id,
                    title: i.title,
                    type: i.type,
                    content: i.content,
                    duration: i.duration,
                    is_mandatory: i.is_mandatory,
                    order: i.order
                })) : []
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
