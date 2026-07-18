const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { User, SchoolClass } = require('../models');
const { authMiddleware } = require('../middleware/auth');

// GET /api/v1/profile - Get current user profile
router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [{ model: SchoolClass, as: 'schoolClass' }],
            attributes: { exclude: ['hashed_password', 'temp_password', 'zoom_client_secret'] }
        });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/v1/profile - Update profile details
router.put('/', authMiddleware, async (req, res) => {
    try {
        const { full_name, profile_pic, school_class_id, section } = req.body;
        
        const updateData = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (profile_pic !== undefined) updateData.profile_pic = profile_pic;
        
        // Only students usually have class/section, but we allow updating if provided
        if (school_class_id !== undefined) updateData.school_class_id = school_class_id === 'none' ? null : school_class_id;
        if (section !== undefined) updateData.section = section;

        await User.update(updateData, { where: { id: req.user.id } });
        
        const updatedUser = await User.findByPk(req.user.id, {
            include: [{ model: SchoolClass, as: 'schoolClass' }],
            attributes: { exclude: ['hashed_password', 'temp_password', 'zoom_client_secret'] }
        });
        
        res.json(updatedUser);
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// PUT /api/v1/profile/password - Reset password
router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: "Old password and new password are required." });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(oldPassword, user.hashed_password);
        if (!isMatch) {
            return res.status(401).json({ error: "Incorrect old password." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashed_password = await bcrypt.hash(newPassword, salt);

        await User.update({ hashed_password }, { where: { id: req.user.id } });
        
        res.json({ success: true, message: "Password updated successfully." });
    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/v1/profile/classes - Get all classes for dropdown
router.get('/classes', async (req, res) => {
    try {
        const classes = await SchoolClass.findAll();
        res.json(classes);
    } catch (error) {
        console.error("Error fetching classes:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
