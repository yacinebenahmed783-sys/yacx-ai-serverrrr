const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// قراءة مفتاح OpenRouter الجديد الذي قمت بحفظه في الـ Environment لـ Render
const API_KEY = process.env.OPENROUTER_API_KEY; 
// استخدام موديل Llama 3 المجاني والسريع عبر OpenRouter
const MODEL = "meta-llama/llama-3.1-8b-instruct:free"; 
const URL = `https://openrouter.ai/api/v1/chat/completions`;

app.get('/ping', (req, res) => {
    res.status(200).send('Server is Awake!');
});

app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;

        // إرسال الطلب بتنسيق OpenRouter القياسي مع الحفاظ التام على تعليماتك السابقة
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
                {
                    role: "user",
                    content: message
                }
            ]
        }, {
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        // قراءة الرد القادم من هيكلية بيانات OpenRouter
        if (response.data && response.data.choices && response.data.choices[0].message) {
            const botReply = response.data.choices[0].message.content;
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
