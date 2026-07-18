require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1', require('./routes/auth'));
app.use('/api/v1', require('./routes/misc'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/courses', require('./routes/courses'));
app.use('/api/v1/code-tests', require('./routes/digital_skills'));
app.use('/api/v1/content', require('./routes/content'));
app.use('/api/v1/user', require('./routes/user'));
app.use('/api/v1/assignments', require('./routes/assignments'));

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'SkillForge Node.js API is running' });
});

// Sync Database and Start the server
const PORT = process.env.PORT || 8000;

sequelize.sync({ alter: true }) // Using alter to gracefully update existing db schema
    .then(() => {
        console.log('✅ PostgreSQL Database connected and synchronized.');
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ Failed to sync database:', err);
    });
