const express = require('express');
const router = express.Router();
const { CodeTest, Problem, TestResult, User } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const excel = require('exceljs');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCUhFFvAAcHjvZfMqDCnt670QPR-0yMxps";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// AI Generation using Gemini
router.post('/ai/generate', async (req, res) => {
    try {
        const { title } = req.body;
        
        const prompt = `
        Act as a strict coding instructor. 
        Create a programming challenge based on the topic: "${title}".
        
        REQUIRED OUTPUT FORMAT (JSON ONLY):
        {
            "description": "A clear, concise problem statement asking the student to solve the task.",
            "test_cases": [
                {"input": "example_input", "output": "expected_output", "hidden": false},
                {"input": "test_input_2", "output": "test_output_2", "hidden": false},
                {"input": "edge_case", "output": "edge_output", "hidden": true}
            ]
        }
        
        Do NOT wrap in markdown code blocks. Return ONLY the raw JSON string.
        `;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const match = text.match(/\{[\s\S]*\}/);
        
        if (!match) throw new Error("AI did not return valid JSON format.");
        
        const aiData = JSON.parse(match[0]);
        res.json({
            description: aiData.description || "No description generated.",
            test_cases: JSON.stringify(aiData.test_cases || [])
        });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ detail: `AI Error: ${error.message}` });
    }
});

// Judge0 Code Execution
router.post('/execute', async (req, res) => {
    try {
        const { source_code, stdin } = req.body;
        const url = "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true";
        const payload = { source_code, language_id: 71, stdin }; // 71 is Python in Judge0
        const headers = { 
            "content-type": "application/json", 
            "X-RapidAPI-Key": "0708d014ebmsh3e0532f99384efbp139119jsn3736fb5bd1c2", 
            "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com" 
        };
        
        const response = await axios.post(url, payload, { headers });
        res.json(response.data);
    } catch (error) {
        console.error("Judge0 Error:", error.message);
        res.status(500).json({ detail: "Compiler Service Error" });
    }
});

// Create Test
router.post('/', authMiddleware, async (req, res) => {
    if (req.user.role !== "instructor") return res.status(403).json({ detail: "Forbidden" });
    try {
        const { title, pass_key, time_limit, problems } = req.body;
        const newTest = await CodeTest.create({ title, pass_key, time_limit, instructor_id: req.user.id });
        
        for (const prob of problems) {
            await Problem.create({
                test_id: newTest.id,
                title: prob.title,
                description: prob.description,
                difficulty: prob.difficulty,
                test_cases: prob.test_cases
            });
        }
        res.json({ message: "Test Created Successfully!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Get Tests
router.get('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === "instructor") {
            const tests = await CodeTest.findAll({ 
                where: { instructor_id: req.user.id },
                include: [{ model: Problem, as: 'problems' }] 
            });
            return res.json(tests.map(t => ({
                id: t.id, title: t.title, pass_key: t.pass_key, time_limit: t.time_limit,
                problems: t.problems.map(p => ({
                    id: p.id, title: p.title, description: p.description, difficulty: p.difficulty || "Easy", test_cases: p.test_cases
                }))
            })));
        }
        
        const tests = await CodeTest.findAll({ include: [{ model: Problem, as: 'problems' }] });
        const responseData = [];
        for (const t of tests) {
            const submission = await TestResult.findOne({ where: { test_id: t.id, user_id: req.user.id } });
            responseData.push({
                id: t.id, title: t.title, time_limit: t.time_limit, problems: t.problems,
                completed: !!submission,
                result_status: submission ? submission.status : null
            });
        }
        res.json(responseData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Start Test
router.post('/:test_id/start', authMiddleware, async (req, res) => {
    try {
        const { pass_key } = req.body;
        const existingResult = await TestResult.findOne({ where: { test_id: req.params.test_id, user_id: req.user.id } });
        if (existingResult) return res.status(403).json({ detail: "Test already submitted." });
        
        const test = await CodeTest.findOne({ 
            where: { id: req.params.test_id },
            include: [{ model: Problem, as: 'problems' }]
        });
        if (!test) return res.status(404).json({ detail: "Test not found" });
        if (test.pass_key !== pass_key) return res.status(403).json({ detail: "Invalid Pass Key" });
        
        res.json({
            id: test.id, title: test.title, time_limit: test.time_limit,
            problems: test.problems.map(p => ({ id: p.id, title: p.title, description: p.description, test_cases: p.test_cases }))
        });
    } catch (error) {
        console.error("Error in /start:", error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Submit Test
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        const { test_id, score, problems_solved, time_taken, status = "submitted" } = req.body;
        const existing = await TestResult.findOne({ where: { test_id, user_id: req.user.id } });
        if (existing) return res.status(409).json({ detail: "Result already recorded." });
        
        await TestResult.create({ test_id, user_id: req.user.id, score, problems_solved, time_taken, status });
        res.json({ message: "Test result saved." });
    } catch (error) {
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

// Export Results to Excel
router.get('/:test_id/export', authMiddleware, async (req, res) => {
    if (req.user.role !== "instructor") return res.status(403).json({ detail: "Forbidden" });
    try {
        const test = await CodeTest.findByPk(req.params.test_id);
        if (!test) return res.status(404).json({ detail: "Test not found" });
        
        const results = await TestResult.findAll({
            where: { test_id: req.params.test_id },
            include: [{ model: User, as: 'student' }]
        });
        
        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet('Results');
        
        worksheet.columns = [
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Score', key: 'score', width: 10 },
            { header: 'Problems Solved', key: 'problems_solved', width: 15 },
            { header: 'Time Taken', key: 'time_taken', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Submitted At', key: 'submitted_at', width: 20 },
        ];
        
        results.forEach(r => {
            worksheet.addRow({
                name: r.student.full_name,
                email: r.student.email,
                score: r.score,
                problems_solved: r.problems_solved,
                time_taken: r.time_taken,
                status: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : "Submitted",
                submitted_at: new Date(r.submitted_at).toLocaleString()
            });
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${test.title.replace(/ /g, '_')}_results.xlsx"`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: "Internal Server Error" });
    }
});

module.exports = router;
