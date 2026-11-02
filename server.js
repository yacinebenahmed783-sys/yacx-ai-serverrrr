const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// مفتاح OpenRouter (سنستعمل متغير OPENROUTER_API_KEY أو نفس خانة المفتاح)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY; 
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// مفتاح Fish Audio للصوت
const FISH_API_KEY = process.env.FISH_API_KEY || 'sk-fish-eCVCw5WT8B46HI-BHnczQMd7oT7GNUK4wsxw0B8hR1Q';

const VOICE_MAP = {
    'personal': '7409fcf04906472db14cb0dd5a50ccb0',
    'miku': 'fef2a33d77584832badf637d5e6b00c5',
    'mommy': '8e4e02d2503b448eb4d6a2efd99c84e3',
    'ahhh': '1d785d369dbf41589e421f4c72713629',
    'child': 'dbb776759f3b40d688ad282a50068d58',
    'daddy': '44924e1147434a479e241309a75470e4',
    'girl': '7eee0787bf1a476fb0864270853e344a',
    'memati': 'b8a16ccac9ad4bc78f5f3f5dd46dc6b5',
    'aboflah': '7e4fa512aa564e198f8659b466f6ff70',
    'tebboune': '207bf4478cfc456e8823de046272044b',
    'gumball': '1d51fdd65ff14342aec4dffa0ef58386'
};

app.get('/ping', (req, res) => {
    res.status(200).send('Server is Awake!');
});

// مسار الشات باستخدام OpenRouter ونموذج مجاني مستقر
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "الرسالة مطلوبة" });

        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ reply: "مفتاح OpenRouter غير مضاف في إعدادات Render." });
        }

        const response = await axios.post(OPENROUTER_URL, {
            model: "mistralai/mistral-7b-instruct:free", // نموذج مجاني وثابت تماماً على OpenRouter
            messages: [
                {
                    role: "system",
                    content: "أنت YacX، مساعد ذكي ومحترف من تطوير ياسين. رد دائماً بنفس لغة المستخدم واجعل إجاباتك منظمة ومباشرة."
                },
                {
                    role: "user",
                    content: message
                }
            ]
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://yacx-ai.com", // اختياري لـ OpenRouter
                "X-Title": "YacX.AI"                  // اختياري لـ OpenRouter
            }
        });

        const replyText = response.data?.choices?.[0]?.message?.content || "عذراً، لم أتمكن من الرد.";
        res.json({ reply: replyText });

    } catch (error) {
        console.error("OpenRouter Error:", error.response?.data || error.message);
        res.status(500).json({ reply: "عذراً، حدث خطأ في الاتصال بسيرفر OpenRouter." });
    }
});

// مسار الصوت (TTS)
app.post("/api/tts", async (req, res) => {
    try {
        const { text, voice_id } = req.body;
        if (!text) return res.status(400).json({ error: "النص مطلوب" });

        let targetVoiceId = voice_id || VOICE_MAP['personal'];

        const response = await axios({
            method: 'post',
            url: 'https://api.fish.audio/v1/tts',
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': 'application/json',
                'model': 's2.1-pro-free'
            },
            data: {
                text: text,
                reference_id: targetVoiceId,
                normalize: true,
                latency: 'normal',
                temperature: 0.3,
                top_p: 0.7
            },
            responseType: 'arraybuffer'
        });

        res.set({
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked'
        });
        res.send(response.data);

    } catch (error) {
        console.error("TTS Error:", error.message);
        res.status(500).json({ error: "حدث خطأ أثناء توليد الصوت" });
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
