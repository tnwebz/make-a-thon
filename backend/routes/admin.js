const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const csv = require('csv-parser');
const stream = require('stream');
const { User, Enrollment, Course, SchoolClass } = require('../models');
const { getPasswordHash, authMiddleware } = require('../middleware/auth');
const { sendCredentialsEmail } = require('../utils/email');

const generateRandomPassword = (length = 8) => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
};

// Routes require instructor or admin role
router.use(authMiddleware);
router.use((req, res, next) => {
    if (req.user.role !== "instructor" && req.user.role !== "admin") {
        return res.status(403).json({ detail: "Forbidden" });
    }
    next();
});

router.post('/admit-student', async (req, res) => {
    try {
        const { full_name, email, course_ids, password, school_class_id, section } = req.body;

        let student = await User.findOne({ where: { email } });
        const final_password = password || generateRandomPassword();

        if (!student) {
            const hashedPassword = await getPasswordHash(final_password);
            student = await User.create({
                email,
                full_name,
                hashed_password: hashedPassword,
                role: "student",
                status: "Active",
                temp_password: final_password,
                school_class_id: school_class_id || null,
                section: section || null
            });
            await sendCredentialsEmail(email, full_name, final_password);
        } else {
            student.temp_password = final_password;
            if (school_class_id) student.school_class_id = school_class_id;
            if (section) student.section = section;
            await student.save();
        }

        const enrolled = [];
        for (const cid of course_ids) {
            const existingEnrollment = await Enrollment.findOne({ where: { user_id: student.id, course_id: cid } });
            if (!existingEnrollment) {
                await Enrollment.create({ user_id: student.id, course_id: cid, enrollment_type: "paid" });
                enrolled.push(cid);
            }
        }

        res.json({ message: `Enrolled in ${enrolled.length} courses` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.post('/bulk-admit', upload.single('file'), async (req, res) => {
    try {
        const course_id = req.body.course_id;
        const school_class_id = req.body.school_class_id;
        const section = req.body.section;
        
        if (!req.file) {
            return res.status(400).json({ detail: "File required" });
        }

        const results = [];
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);

        bufferStream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                let count = 0;
                for (const row of results) {
                    // Keys might be upper or lower case, normalize them
                    const normalizedRow = {};
                    for (const key in row) {
                        normalizedRow[key.toLowerCase().trim()] = row[key];
                    }

                    const email = normalizedRow.email?.trim();
                    const name = normalizedRow.name || "Student";
                    
                    if (!email || email.toLowerCase() === "nan") continue;

                    let student = await User.findOne({ where: { email } });
                    if (!student) {
                        const bulk_password = generateRandomPassword();
                        const hashedPassword = await getPasswordHash(bulk_password);
                        student = await User.create({
                            email,
                            full_name: name,
                            hashed_password: hashedPassword,
                            role: "student",
                            status: "Active",
                            temp_password: bulk_password,
                            school_class_id: school_class_id || null,
                            section: section || null
                        });
                        await sendCredentialsEmail(email, name, bulk_password);
                    }

                    if (course_id) {
                        const existingEnrollment = await Enrollment.findOne({ where: { user_id: student.id, course_id } });
                        if (!existingEnrollment) {
                            await Enrollment.create({ user_id: student.id, course_id, enrollment_type: "paid" });
                            count++;
                        }
                    } else {
                        count++;
                    }
                }
                res.json({ message: `Enrolled ${count} students` });
            });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/students', async (req, res) => {
    try {
        const students = await User.findAll({ 
            where: { role: "student" },
            include: [
                {
                    model: Enrollment,
                    as: 'enrollments',
                    include: [{ model: Course, as: 'course' }]
                },
                {
                    model: SchoolClass,
                    as: 'schoolClass'
                }
            ]
        });

        const out = students.map(s => {
            const enrolled = s.enrollments.map(e => {
                let days_left = null;
                if (e.expiry_date) {
                    days_left = Math.ceil((new Date(e.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                }
                return {
                    title: e.course ? e.course.title : "Unknown Course",
                    tier: e.enrollment_type === "paid" ? "Paid" : "Free",
                    days_left: days_left
                };
            });

            return {
                id: s.id,
                full_name: s.full_name,
                email: s.email,
                joined_at: s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : "N/A",
                status: s.status || "Active",
                temp_password: s.temp_password || "Encrypted",
                school_class: s.schoolClass ? s.schoolClass.name : null,
                section: s.section,
                enrolled_courses: enrolled
            };
        });

        res.json(out);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.patch('/students/:userId/status', async (req, res) => {
    try {
        const student = await User.findByPk(req.params.userId);
        if (!student) return res.status(404).json({ detail: "Not found" });
        
        student.status = req.body.status;
        await student.save();
        res.json({ message: `Account changed to ${req.body.status}` });
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.patch('/students/:userId/name', async (req, res) => {
    try {
        const student = await User.findByPk(req.params.userId);
        if (!student) return res.status(404).json({ detail: "Not found" });
        
        student.full_name = req.body.name;
        await student.save();
        res.json({ message: "Name updated successfully" });
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.patch('/students/:userId/reset-password', async (req, res) => {
    try {
        const student = await User.findByPk(req.params.userId);
        if (!student) return res.status(404).json({ detail: "Not found" });
        
        student.hashed_password = await getPasswordHash(req.body.new_password);
        student.temp_password = req.body.new_password;
        await student.save();
        res.json({ message: "Password reset successfully" });
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// --- Class Management ---
router.post('/classes', async (req, res) => {
    try {
        if (req.user.role !== "admin") return res.status(403).json({ detail: "Forbidden: Admins only" });
        const { name, academic_year } = req.body;
        const newClass = await SchoolClass.create({ name, academic_year });
        res.status(201).json(newClass);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/classes', async (req, res) => {
    try {
        const classes = await SchoolClass.findAll({ order: [['createdAt', 'DESC']] });
        res.json(classes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/classes/:id/students', async (req, res) => {
    try {
        const whereClause = { role: "student", school_class_id: req.params.id };
        if (req.query.section) {
            whereClause.section = req.query.section;
        }
        const students = await User.findAll({ 
            where: whereClause
        });
        res.json(students);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// --- Staff Management ---
router.post('/staff', async (req, res) => {
    try {
        if (req.user.role !== "admin") return res.status(403).json({ detail: "Forbidden: Admins only" });
        const { full_name, email, password } = req.body;
        let staff = await User.findOne({ where: { email } });
        if (staff) return res.status(400).json({ detail: "Email already exists" });

        const final_password = password || generateRandomPassword();
        const hashedPassword = await getPasswordHash(final_password);
        staff = await User.create({
            email,
            full_name,
            hashed_password: hashedPassword,
            role: "instructor",
            status: "Active",
            temp_password: final_password
        });
        await sendCredentialsEmail(email, full_name, final_password);
        res.status(201).json({ message: "Staff created" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.get('/staff', async (req, res) => {
    try {
        const staffList = await User.findAll({ where: { role: "instructor" }, order: [['createdAt', 'DESC']] });
        res.json(staffList);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.patch('/staff/:id/status', async (req, res) => {
    try {
        if (req.user.role !== "admin") return res.status(403).json({ detail: "Forbidden: Admins only" });
        const staff = await User.findByPk(req.params.id);
        if (!staff) return res.status(404).json({ detail: "Not found" });
        staff.status = req.body.status;
        await staff.save();
        res.json({ message: "Status updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

router.delete('/staff/:id', async (req, res) => {
    try {
        if (req.user.role !== "admin") return res.status(403).json({ detail: "Forbidden: Admins only" });
        const staff = await User.findByPk(req.params.id);
        if (!staff) return res.status(404).json({ detail: "Not found" });
        await staff.destroy();
        res.json({ message: "Staff deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
