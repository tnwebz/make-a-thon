const axios = require('axios');
const jwt = require('jsonwebtoken');

const token = 'mock-inbuilt-token:admin@skillforge.com';

const API_BASE = 'http://localhost:8000/api/v1';

async function testEndpoints() {
    console.log("==================================================");
    console.log("TESTING HINDI & TAMIL VOICE API ENDPOINTS");
    console.log("==================================================");

    // 1. Test Hindi Status
    console.log("\n1. GET /courses/7/items/39/voice/status?lang=hi");
    const hiStatus = await axios.get(`${API_BASE}/courses/7/items/39/voice/status?lang=hi`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Hindi Status Response:", hiStatus.data);

    // 2. Test Tamil Status
    console.log("\n2. GET /courses/7/items/39/voice/status?lang=ta");
    const taStatus = await axios.get(`${API_BASE}/courses/7/items/39/voice/status?lang=ta`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Tamil Status Response:", taStatus.data);

    // 3. Test Course Player with Hindi
    console.log("\n3. GET /courses/7/player?lang=hi");
    const playerHi = await axios.get(`${API_BASE}/courses/7/player?lang=hi`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Course Player Hindi active language:", playerHi.data.current_language);
    console.log("Available languages:", playerHi.data.available_languages);
    
    // Find lesson 39
    let lesson39Hi = null;
    playerHi.data.modules?.forEach(m => m.lessons?.forEach(l => {
        if (l.id === 39) lesson39Hi = l;
    }));
    console.log("Lesson 39 Dubbed Video (Hindi):", lesson39Hi?.dubbed_video_url);

    // 4. Test Course Player with Tamil
    console.log("\n4. GET /courses/7/player?lang=ta");
    const playerTa = await axios.get(`${API_BASE}/courses/7/player?lang=ta`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    let lesson39Ta = null;
    playerTa.data.modules?.forEach(m => m.lessons?.forEach(l => {
        if (l.id === 39) lesson39Ta = l;
    }));
    console.log("Lesson 39 Dubbed Video (Tamil):", lesson39Ta?.dubbed_video_url);

    console.log("\n==================================================");
    console.log("ALL API TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
}

testEndpoints().catch(err => {
    console.error("API test failed:", err?.response?.data || err.message);
    process.exit(1);
});
