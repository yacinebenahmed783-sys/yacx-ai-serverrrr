const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.OPENROUTER_API_KEY; 
const MODEL = "cohere/north-mini-code:free"; 
const URL = `https://openrouter.ai/api/v1/chat/completions`;

// إعدادات Fish Audio وقائمة معرفات الأصوات المعتمدة
const FISH_API_KEY = process.env.FISH_API_KEY || 'sk-fish-eCVCw5WT8B46HI-BHnczQMd7oT7GNUK4wsxw0B8hR1Q';

// قاموس الأصوات مع تصحيح معرف صوت "احححح" بالكامل
const VOICE_MAP = {
    'personal': '7409fcf04906472db14cb0dd5a50ccb0', // صوتك الشخصي الأساسي
    'miku': 'fef2a33d77584832badf637d5e6b00c5',     // صوت ميكو
    'mommy': '8e4e02d2503b448eb4d6a2efd99c84e3',    // mommy
    'ahhh': '11413f183cf24e04859607efd14c832d',     // احححح (المعرف الصحيح الكامل)
    'child': '1d785d369dbf41589e421f4c72713629'     // بنت صغيرة
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

app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;

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
            stream: true
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

// مسار الـ TTS المدعوم بإعدادات التهدئة وتقليل التمديد الصوتي
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
                temperature: 0.3,      // تقليل الحماسة والتذبذب الصوتي الزائد
                top_p: 0.7             // ضبط التباين ليصبح التحدث مستقراً
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
