const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.OPENROUTER_API_KEY; 
const MODEL = "cohere/north-mini-code:free"; 
const URL = `https://openrouter.ai/api/v1/chat/completions`;

const FISH_API_KEY = process.env.FISH_API_KEY || 'sk-fish-eCVCw5WT8B46HI-BHnczQMd7oT7GNUK4wsxw0B8hR1Q';

// قاموس الأصوات الثابتة
const VOICE_MAP = {
    'personal': '7409fcf04906472db14cb0dd5a50ccb0', 
    'saddam': 'e222b3a8dc7d4afcb24c0827874a2960',    
    'miku': 'fef2a33d77584832badf637d5e6b00c5',     
    'mommy': '8e4e02d2503b448eb4d6a2efd99c84e3',    
    'ahhh': '1d785d369dbf41589e421f4c72713629',     
    'child': 'dbb776759f3b40d688ad282a50068d58',    
    'daddy': 'a02d16b68013480fa1ab465427f35b30',    
    'girl': '7eee0787bf1a476fb0864270853e344a',     
    'memati': 'b8a16ccac9ad4bc78f5f3f5dd46dc6b5',   
    'aboflah': '7e4fa512aa564e198f8659b466f6ff70',  
    'tebboune': '207bf4478cfc456e8823de046272044b', 
    'gumball': '1d51fdd65ff14342aec4dffa0ef58386'   
};

app.get('/ping', (req, res) => {
    res.status(200).send('Server is Awake!');
});

// مسار تحويل الصوت إلى صوت (Voice Changer / Speech-to-Speech)
app.post('/api/voice-changer', upload.single('audio'), async (req, res) => {
    try {
        const voiceId = req.body.voice_id || VOICE_MAP['personal'];
        if (!req.file) {
            return res.status(400).json({ error: "الملف الصوتي مطلوب" });
        }

        const response = await axios({
            method: 'post',
            url: `https://api.fish.audio/v1/voice-changer`,
            headers: {
                'Authorization': `Bearer ${FISH_API_KEY}`,
                'Content-Type': req.file.mimetype || 'audio/webm',
                'model': 's2.1-pro-free'
            },
            data: req.file.buffer,
            params: {
                reference_id: voiceId
            },
            responseType: 'arraybuffer'
        });

        res.set({
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked'
        });
        res.send(response.data);

    } catch (error) {
        console.error("Voice Changer Error:", error.response?.data ? Buffer.from(error.response.data).toString() : error.message);
        res.status(500).json({ error: "حدث خطأ أثناء تحويل الصوت" });
    }
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
                    content: `أنت YacX، مساعد ذكي ومفيد من تطوير المبرمج ياسين. رد دائماً بنفس اللغة التي يكتب بها المستخدم بدقة.`
                },
                { role: "user", content: message || "مرحباً" }
            ],
            stream: true
        }, {
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            responseType: 'stream'
        });

        response.data.on('data', (chunk) => res.write(chunk));
        response.data.on('end', () => res.end());
    } catch (error) {
        res.write('data: {"error": "حدث خطأ في الاتصال"}\n\n');
        res.end();
    }
});

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
                temperature: 0.35, 
                top_p: 0.85        
            },
            responseType: 'arraybuffer'
        });

        res.set({
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked'
        });
        res.send(response.data);
    } catch (error) {
        res.status(500).json({ error: "حدث خطأ أثناء توليد الصوت" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
