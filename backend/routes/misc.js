const express = require('express');
const router = express.Router();
const { User, Course, Enrollment, LessonProgress, ScheduledClass, CourseReview, ContentItem } = require('../models');
const { authMiddleware, getPasswordHash } = require('../middleware/auth');
const Razorpay = require('razorpay');
const { Op } = require('sequelize');
const { createCertificatePDF } = require('../utils/pdf');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_Ru8lDcv8KvAiC0",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "puZLB2DQS8FmH0Z7SNrJtOBb"
});

router.get('/my-courses', authMiddleware, async (req, res) => {
    try {
        const enrollments = await Enrollment.findAll({
            where: { user_id: req.user.id },
            include: [{ 
                model: Course, 
                as: 'course'
            }]
        });

        const response = [];
        for (const e of enrollments) {
            const course = e.course;
            if (!course) continue;
            let total_lessons = 0;
            // Counting total lessons (simplified for brevity, should ideally query ContentItem directly)
            const all_lessons = await ContentItem.findAll({ 
                include: [{ model: require('../models').Module, where: { course_id: course.id } }]
            });
            total_lessons = all_lessons.length;
            
            let progress = 0;
            if (total_lessons > 0) {
                const completed = await LessonProgress.count({
                    where: { 
                        user_id: req.user.id,
                        content_item_id: { [Op.in]: all_lessons.map(l => l.id) }
                    }
                });
                progress = Math.floor((completed / total_lessons) * 100);
            }

            let days_left = null;
            if (e.expiry_date) {
                days_left = Math.ceil((new Date(e.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
            }

            const user_review = await CourseReview.findOne({
                where: { user_id: req.user.id, course_id: course.id }
            });

            response.push({
                id: course.id,
                title: course.title,
                description: course.description,
                price: course.price,
                image_url: course.image_url,
                is_finalized: course.is_finalized,
                progress: progress,
                enrollment_type: e.enrollment_type || "paid",
                days_left: days_left,
                user_rating: user_review ? user_review.rating : null
            });
        }
        res.json(response);
    } catch (error) {
        console.error("DEBUG_ERROR:", error);
        res.status(500).json({ detail: error.message, stack: error.stack });
    }
});

router.post('/create-order', async (req, res) => {
    try {
        const { amount } = req.body;
        const options = {
            amount: amount * 100,
            currency: "INR",
            payment_capture: 1
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).json({ detail: "Razorpay Error" });
    }
});

router.post('/progress/toggle', authMiddleware, async (req, res) => {
    try {
        const { lesson_id } = req.body;
        const existing = await LessonProgress.findOne({
            where: { user_id: req.user.id, content_item_id: lesson_id }
        });
        
        if (existing) {
            return res.json({ status: "already_completed" });
        }
        
        await LessonProgress.create({ user_id: req.user.id, content_item_id: lesson_id });
        res.json({ status: "completed" });
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/student/dashboard', authMiddleware, async (req, res) => {
    try {
        const enrollments = await Enrollment.findAll({
            where: { user_id: req.user.id },
            include: [{ model: Course, as: 'course', include: ['instructor'] }]
        });

        const completed_records = await LessonProgress.findAll({ where: { user_id: req.user.id } });
        const completed_lesson_ids = new Set(completed_records.map(r => r.content_item_id));

        const enrolled_courses_with_progress = [];
        for (const e of enrollments) {
            const all_lessons = await ContentItem.findAll({ 
                include: [{ model: require('../models').Module, where: { course_id: e.course_id } }]
            });
            const total_lessons = all_lessons.length;
            let completed_lessons = 0;
            for (const lesson of all_lessons) {
                if (completed_lesson_ids.has(lesson.id)) completed_lessons++;
            }
            
            let progress_percentage = 0;
            if (total_lessons > 0) {
                progress_percentage = Math.round((completed_lessons / total_lessons) * 100);
            }
            
            enrolled_courses_with_progress.push({
                id: e.course_id,
                title: e.course.title,
                category: "Technology",
                progress: progress_percentage,
                instructor: e.course.instructor ? e.course.instructor.full_name : "Unknown"
            });
        }

        const all_courses = await Course.findAll({ limit: 2, include: ['instructor'] });
        const recommended = all_courses.map(c => ({
            id: c.id, title: c.title, instructor: c.instructor ? c.instructor.full_name : "Unknown"
        }));

        const leaderboard = [
            { id: 1, name: "Aiswarya.S", points: 1400 },
            { id: 2, name: "Vishaagan", points: 1390 },
            { id: 3, name: "Ajai", points: 1200 },
            { id: 4, name: "Kavyanjali", points: 1100 },
        ];

        res.json({
            user_name: req.user.full_name,
            enrolled_courses: enrolled_courses_with_progress,
            recommended_courses: recommended,
            leaderboard: leaderboard
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Scheduling
router.post('/meetings', authMiddleware, async (req, res) => {
    if (req.user.role !== "instructor") return res.status(403).json({ detail: "Instructor only" });
    try {
        const new_class = await ScheduledClass.create({
            instructor_id: req.user.id,
            course_id: req.body.course_id,
            title: req.body.title,
            agenda: req.body.agenda,
            start_time: new Date(req.body.start_time),
            duration_minutes: req.body.duration_minutes,
            meeting_link: "https://zoom.us/j/5551234567?pwd=test_fallback",
            meeting_id: "5551234567"
        });
        res.json({ message: "Scheduled with Fallback link.", meeting: { id: new_class.id, title: new_class.title, meeting_link: new_class.meeting_link } });
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/meetings/instructor', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "instructor") {
            return res.status(403).json({ detail: "Instructor only" });
        }
        const meetings = await ScheduledClass.findAll({
            where: { instructor_id: req.user.id },
            include: [{ model: Course, as: 'course' }]
        });
        res.json(meetings.map(m => ({
            id: m.id,
            course_id: m.course_id,
            course_title: m.course ? m.course.title : "Unknown Course",
            title: m.title,
            agenda: m.agenda,
            start_time: m.start_time.toISOString(),
            duration_minutes: m.duration_minutes,
            meeting_link: m.meeting_link
        })));
    } catch (error) {
        console.error("Get instructor meetings error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.delete('/meetings/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "instructor") {
            return res.status(403).json({ detail: "Instructor only" });
        }
        const meeting = await ScheduledClass.findOne({
            where: { id: req.params.id, instructor_id: req.user.id }
        });
        if (!meeting) {
            return res.status(404).json({ detail: "Meeting not found" });
        }
        await meeting.destroy();
        res.json({ message: "Meeting deleted successfully" });
    } catch (error) {
        console.error("Delete meeting error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/meetings/student', authMiddleware, async (req, res) => {
    if (req.user.role !== "student") return res.status(403).json({ detail: "Student only" });
    try {
        const enrollments = await Enrollment.findAll({ where: { user_id: req.user.id } });
        const course_ids = enrollments.map(e => e.course_id);
        if (course_ids.length === 0) return res.json([]);
        
        const meetings = await ScheduledClass.findAll({
            where: { course_id: { [Op.in]: course_ids } },
            include: ['course', 'instructor']
        });
        
        res.json(meetings.map(m => ({
            id: m.id, course_id: m.course_id, course_title: m.course ? m.course.title : "Unknown",
            title: m.title, agenda: m.agenda, start_time: m.start_time.toISOString(),
            duration_minutes: m.duration_minutes, meeting_link: m.meeting_link,
            instructor: m.instructor ? m.instructor.full_name : "Instructor"
        })));
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Post Course Review
router.post('/courses/:courseId/reviews', authMiddleware, async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const { rating, feedback } = req.body;
        
        const enrollment = await Enrollment.findOne({ where: { user_id: req.user.id, course_id: courseId } });
        if (!enrollment) {
            return res.status(403).json({ detail: "You must be enrolled in this course to leave a review." });
        }

        const review = await CourseReview.create({
            user_id: req.user.id,
            course_id: courseId,
            rating: Number(rating) || 5,
            feedback: feedback || ""
        });

        res.status(201).json({ message: "Review submitted successfully", review });
    } catch (error) {
        console.error("Post review error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Get Reviews for Instructor
router.get('/instructor/reviews', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "instructor") {
            return res.status(403).json({ detail: "Only instructors can retrieve reviews." });
        }

        const reviews = await CourseReview.findAll({
            include: [
                {
                    model: Course,
                    as: 'course',
                    where: { instructor_id: req.user.id }
                },
                {
                    model: User,
                    as: 'student'
                }
            ]
        });

        const formatted = reviews.map(r => ({
            id: r.id,
            course_id: r.course_id,
            rating: r.rating,
            text: r.feedback || "",
            feedback: r.feedback || "",
            student: r.student ? r.student.full_name : "Anonymous Student",
            course: r.course ? r.course.title : "Unknown Course",
            time: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : "N/A"
        }));

        res.json(formatted);
    } catch (error) {
        console.error("Get instructor reviews error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Free / Trial Course Enrollment
router.post('/enroll/:courseId', authMiddleware, async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const { type } = req.body;

        const course = await Course.findByPk(courseId);
        if (!course) {
            return res.status(404).json({ detail: "Course not found" });
        }

        const existing = await Enrollment.findOne({ where: { user_id: req.user.id, course_id: courseId } });
        if (existing) {
            return res.status(400).json({ detail: "Already enrolled in this course" });
        }

        let expiry_date = null;
        if (type === "trial") {
            expiry_date = new Date();
            expiry_date.setDate(expiry_date.getDate() + 7);
        }

        const enrollment = await Enrollment.create({
            user_id: req.user.id,
            course_id: courseId,
            enrollment_type: type || "trial",
            expiry_date
        });

        res.status(201).json({ message: "Successfully enrolled", enrollment });
    } catch (error) {
        console.error("Enrollment error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Generate PDF Certificate route (matching the frontend expectations)
router.get('/generate-pdf/:courseId', authMiddleware, async (req, res) => {
    try {
        const course = await Course.findByPk(req.params.courseId);
        if (!course) return res.status(404).json({ detail: "Course not found" });

        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
        
        const pdfBuffer = await createCertificatePDF(req.user.full_name.toUpperCase(), course.title.toUpperCase(), dateStr);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${req.user.full_name}_Certificate.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Generate PDF certificate error:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
