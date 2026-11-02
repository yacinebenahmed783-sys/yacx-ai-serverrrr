const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// مفتاح جوجل الذي أضفته في Render
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
// رابط الاتصال المباشر بنموذج فلاش السريع من جوجل
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

// إعدادات Fish Audio وقائمة معرفات الأصوات الخاصة بك بدقة
const FISH_API_KEY = process.env.FISH_API_KEY || 'sk-fish-eCVCw5WT8B46HI-BHnczQMd7oT7GNUK4wsxw0B8hR1Q';

// قاموس الأصوات بالمعرفات التي عدّلتها بنفسك
const VOICE_MAP = {
    'personal': '7409fcf04906472db14cb0dd5a50ccb0', // صوتك الشخصي الأساسي
    'miku': 'fef2a33d77584832badf637d5e6b00c5',     // صوت ميكو
    'mommy': '8e4e02d2503b448eb4d6a2efd99c84e3',    // mommy
    'ahhh': '11413f183cf24e04859607efd14c832d',     // احححح
    'child': '1d785d369dbf41589e421f4c72713629',    // بنت صغيرة
    'daddy': '44924e1147434a479e241309a75470e4',    // daddy
    'girl': '7eee0787bf1a476fb0864270853e344a',     // girl
    'memati': 'b8a16ccac9ad4bc78f5f3f5dd46dc6b5',   // ميماتي
    'aboflah': '7e4fa512aa564e198f8659b466f6ff70',  // ابو فلة
    'tebboune': '207bf4478cfc456e8823de046272044b', // تبون
    'gumball': '1d51fdd65ff14342aec4dffa0ef58386'   // غامبول
};

app.get('/ping', (req, res) => {
    res.status(200).send('Server is Awake!');
});

// مسار الـ Chat المحدث ليعمل مباشرة مع نموذج جوجل وسرعته الخارقة
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await axios.post(GEMINI_URL, {
            system_instruction: {
                parts: [{
                    text: `Instructions: أنت YacX، مساعد ذكي ومحترف من تطوير ياسين.
                    قواعد الرد الصارمة:
                    1. لغة الرد: رد دائماً وبشكل قطعي بنفس لغة المستخدم (إذا كتب بالعربية رد بالعربية، إذا كتب بالإنجليزية رد بالإنجليزية، إلخ). لا ترد بلغة أخرى أبداً.
                    2. التنظيم: اجعل إجاباتك منظمة، استخدم النقاط (Bullet points) والعناوين القصيرة لتسهيل القراءة، وكن دقيقاً ومباشراً بدون حشو زائد.
                    3. إذا قال المستخدم "مرحباً" أو "أهلاً"، رد بترحيب طبيعي وودود بنفس لغته ولا تذكر معلومات المطور فوراً.
                    4. إذا سألك المستخدم "من هو مطورك؟" أو "من صنعك؟"، أخبره فقط أنك من تطوير المبرمج ياسين، دون ذكر أي تفاصيل شخصية أخرى لحماية الخصوصية.`
                }]
            },
            contents: [{
                role: "user",
                parts: [{ text: message }]
            }]
        }, {
            headers: {
                "Content-Type": "application/json"
            },
            responseType: 'stream'
        });

        response.data.on('data', (chunk) => {
            const chunkStr = chunk.toString();
            try {
                const lines = chunkStr.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonData = JSON.parse(line.substring(6));
                        const textPart = jsonData.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (textPart) {
                            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: textPart } }] })}\n\n`);
                        }
                    }
                }
            } catch (e) {
                // تجاهل الحزم الفارغة
            }
        });

        response.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
        });

    } catch (error) {
        console.error("Gemini Stream Error:", error.response?.data || error.message);
        res.write('data: {"error": "حدث خطأ في الاتصال بسيرفر جوجل"}\n\n');
        res.end();
    }
});

// مسار الـ TTS المدعوم بكافة أصواتك ومعلمات الضبط الهادئ
app.post("/api/tts", async (req, res) => {
    try {
        const { text, voice_id } = req.body;
        if (!text) return res.status(400).json({ error: "النص مطلوب" });

        let targetVoiceId = voice_id;
        
        if (!targetVoiceId) {
            targetVoiceId = VOICE_MAP['personal'];
        }

        console.log(`Generating TTS with Voice ID: ${targetVoiceId} for text: ${text}`);

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
                normalize: true,       // ضبط إيقاع القراءة
                latency: 'normal',      // الأداء القياسي
                temperature: 0.3,      // استقرار النبرة وتجنب التمخض
                top_p: 0.7             // تباين مستقر ومنتظم
            },
            responseType: 'arraybuffer'
        });

        res.set({
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked'
        });
        res.send(response.data);

    } catch (error) {
        console.error("TTS Error:", error.response?.data ? Buffer.from(error.response.data).toString() : error.message);
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
