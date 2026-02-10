const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GOOGLE_API_KEY; 
const MODEL = "gemma-3-27b-it"; 
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

app.get('/ping', (req, res) => {
    res.status(200).send('Server is Awake!');
});

app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;

        const response = await axios.post(URL, {
            contents: [{ 
                parts: [{ 
                    text: `Instructions: أنت YacX، مساعد ذكي من تطوير ياسين.
                    قواعد الرد:
                    1. إذا قال المستخدم "مرحباً" أو "أهلاً"، رد بترحيب طبيعي وودود ولا تذكر معلومات المطور فوراً.
                    2. فقط إذا سألك المستخدم "من هو مطورك؟" أو "أين يعيش؟" أو "متى ولد؟"، أخبره أن ياسين من مواليد 4 سبتمبر 2009، ويسكن في ولاية تيارت ببلدية عين حديد.
                    3. كن تفاعلياً وذكياً في الشرح، ولا تكتفِ بالإجابات الجافة.
                    User Question: ${message}` 
                }] 
            }],
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        });

        if (response.data && response.data.candidates && response.data.candidates[0].content) {
            const botReply = response.data.candidates[0].content.parts[0].text;
            res.json({ reply: botReply });
        } else {
            res.json({ reply: "أنا هنا، لكن الموديل لم يرسل نصاً. حاول مرة أخرى." });
        }
    } catch (error) {
        console.error("Error Detail:", error.response ? error.response.data : error.message);
        res.status(500).json({ reply: "حدث خطأ في الاتصال، تأكد من الـ API KEY." });
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
