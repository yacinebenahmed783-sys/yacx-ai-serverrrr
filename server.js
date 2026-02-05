const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// استخدام Environment Variables للأمان (بناخذ المفتاح من إعدادات ريندر)
const API_KEY = process.env.GOOGLE_API_KEY; 
const MODEL = "gemma-3-27b-it"; 
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

// مسار الـ Ping عشان السيرفر يصحى
app.get('/ping', (req, res) => {
    res.status(200).send('Server is Awake!');
});

app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const response = await axios.post(URL, {
            contents: [{ parts: [{ text: message }] }]
        });

        if (response.data && response.data.candidates) {
            const botReply = response.data.candidates[0].content.parts[0].text;
            res.json({ reply: botReply });
        }
    } catch (error) {
        res.status(500).json({ error: "خطأ في السيرفر أو المفتاح" });
    }
});

// --- خدعة منع الخمول ---
// بناخذ رابط موقعك من إعدادات ريندر تلقائياً (عشان ما تغيره يدوي)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL; 

setInterval(() => {
    if (RENDER_URL) {
        axios.get(`${RENDER_URL}/ping`)
            .then(() => console.log('🚀 تم إرسال نبضة الاستيقاظ'))
            .catch(err => console.log('⚠️ جاري تشغيل السيرفر...'));
    }
}, 600000); // كل 10 دقائق

// استخدام المنفذ اللي يطلبه ريندر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});