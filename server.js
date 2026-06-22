const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// قراءة مفتاح OpenRouter الجديد الذي قمت بحفظه في الـ Environment لـ Render
const API_KEY = process.env.OPENROUTER_API_KEY; 
// استخدام موديل Llama 3 المجاني والسريع عبر OpenRouter
const MODEL = "cohere/north-mini-code:free"; 
const URL = `https://openrouter.ai/api/v1/chat/completions`;

app.get('/ping', (req, res) => {
    res.status(200).send('Server is Awake!');
});

app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;

        // تهيئة الـ Headers الخاصة بالبث الحي (SSE) لإجبار المتصفح على استقبال البيانات فوراً
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // إرسال الطلب بتنسيق OpenRouter مع تفعيل الخاصية stream: true
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
            ],
            stream: true // تفعيل البث الحي من جهة OpenRouter
        }, {
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            responseType: 'stream' // استقبال الرد كـ Stream تدفقي وليس حزمة واحدة
        });

        // تمرير البيانات القادمة من OpenRouter مباشرة إلى المتصفح قطعة قطعة (Chunk)
        response.data.on('data', (chunk) => {
            res.write(chunk);
        });

        // إنهاء الاتصال فور اكتمال توليد النص بالكامل
        response.data.on('end', () => {
            res.end();
        });

    } catch (error) {
        console.error("Stream Error:", error.message);
        // في حال حدوث خطأ، يتم إرسال رسالة خطأ متوافقة مع صيغة البث
        res.write('data: {"error": "حدث خطأ في الاتصال، تأكد من الـ API KEY."}\n\n');
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
