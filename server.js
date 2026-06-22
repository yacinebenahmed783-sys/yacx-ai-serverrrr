const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.OPENROUTER_API_KEY; 
const MODEL = "cohere/north-mini-code:free"; 
const URL = `https://openrouter.ai/api/v1/chat/completions`;

app.get('/ping', (req, res) => {
    res.status(200).send('Server is Awake!');
});

app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;

        // تهيئة الـ Headers للبث الحي
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await axios.post(URL, {
            model: MODEL,
            messages: [
                {
                    role: "system",
                    content: `Instructions: أنت YacX، مساعد ذكي من تطوير ياسين.
                    قواعد الرد:
                    1. إذا قال المستخدم "مرحباً" أو "أهلاً"، رد بترحيب طبيعي وودود ولا تذكر معلومات المطور فوراً.
                    2. إذا سألك المستخدم "من هو مطورك؟" أو "من صنعك؟"، أخبره فقط أنك من تطوير المبرمج ياسين، دون ذكر أي تفاصيل شخصية أخرى كالعمر، تاريخ الميلاد، أو مكان السكن لحماية الخصوصية.
                    3. كن تفاعلياً وذكياً في الشرح، ولا تكتفِ بالإجابات الجافة.`
                },
                { role: "user", content: message }
            ],
            stream: true // تفعيل البث من OpenRouter
        }, {
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            responseType: 'stream'
        });

        response.data.on('data', (chunk) => {
            res.write(chunk);
        });

        response.data.on('end', () => {
            res.end();
        });

    } catch (error) {
        console.error("Stream Error:", error.message);
        res.write('data: {"error": "حدث خطأ في الاتصال"}\n\n');
        res.end();
    }
});

const RENDER_URL = process.env.RENDER_EXTERNAL_URL; 
setInterval(() => {
    if (RENDER_URL) {
        axios.get(`${RENDER_URL}/ping`).catch(() => {});
    }
}, 600000); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
