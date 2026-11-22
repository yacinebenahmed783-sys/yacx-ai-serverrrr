const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "cohere/north-mini-code:free";
const URL = `https://openrouter.ai/api/v1/chat/completions`;

const FISH_API_KEY = process.env.FISH_API_KEY;

// قاموس الأصوات (بنت صايعة أولاً، صدام حسين ثانياً، وبقية الأصوات بدون ألقاب)
const VOICE_MAP = {
    'girl': '7409fcf04906472db14cb0dd5a50ccb0',
    'saddam': 'e222b3a8dc7d4afcb24c0827874a2960',
    'miku': 'fef2a33d77584832badf637d5e6b00c5',
    'mommy': '8e4e02d2503b448eb4d6a2efd99c84e3',
    'ahhh': '1d785d369dbf41589e421f4c72713629',
    'child': 'dbb776759f3b40d688ad282a50068d58',
    'daddy': 'a02d16b68013480fa1ab465427f35b30',
    'memati': 'b8a16ccac9ad4bc78f5f3f5dd46dc6b5',
    'aboflah': '7e4fa512aa564e198f8659b466f6ff70',
    'tebboune': '207bf4478cfc456e8823de046272044b',
    'gumball': '1d51fdd65ff14342aec4dffa0ef58386'
};

// تنظيف النص وتقسيمه إلى مقاطع قصيرة واضحة للنطق العربي
function prepareArabicChunks(rawText, maxLen = 180) {
    const cleaned = String(rawText)
        .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FFa-zA-Z0-9\s،.!?؟؛:()\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return [];

    // تقسيم مبدئي حسب علامات الوقف
    const parts = cleaned.match(/[^.!?؟،؛\n]+[.!?؟،؛]?/g) || [cleaned];
    const chunks = [];

    for (const part of parts) {
        const piece = part.trim();
        if (!piece) continue;

        if (piece.length <= maxLen) {
            chunks.push(piece);
        } else {
            // تقسيم الجملة الطويلة حسب الكلمات دون قطع الكلمة في المنتصف
            const words = piece.split(/\s+/);
            let current = '';
            for (const word of words) {
                if ((current + ' ' + word).trim().length > maxLen) {
                    if (current) chunks.push(current.trim());
                    current = word;
                } else {
                    current = current ? `${current} ${word}` : word;
                }
            }
            if (current) chunks.push(current.trim());
        }
    }

    return chunks;
}

async function synthesizeChunk(text, targetVoiceId) {
    const response = await axios({
        method: 'post',
        url: 'https://api.fish.audio/v1/tts',
        headers: {
            'Authorization': `Bearer ${FISH_API_KEY}`,
            'Content-Type': 'application/json'
        },
        data: {
            text,
            reference_id: targetVoiceId,
            model: 's2.1-pro-free',
            normalize: true,
            latency: 'normal',
            temperature: 0.3,
            top_p: 0.85,
            format: 'mp3'
        },
        responseType: 'arraybuffer',
        timeout: 30000
    });

    return Buffer.from(response.data);
}

app.get('/ping', (req, res) => {
    res.status(200).send('Server is Awake!');
});

app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!API_KEY) {
            return res.status(500).json({ error: "OPENROUTER_API_KEY غير مضبوط في السيرفر" });
        }

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
                "Content-Type": "application/json",
                "HTTP-Referer": "https://yacx.vercel.app",
                "X-Title": "YacX.AI"
            },
            responseType: 'stream',
            timeout: 45000
        });

        response.data.on('data', (chunk) => {
            res.write(chunk);
        });

        response.data.on('end', () => {
            res.end();
        });

        response.data.on('error', (streamErr) => {
            console.error("Chat Stream Error:", streamErr.message);
            res.write(`data: ${JSON.stringify({ error: "انقطع بث الرد من السيرفر" })}\n\n`);
            res.end();
        });
    } catch (error) {
        const errDetail = error?.response?.data
            ? Buffer.isBuffer(error.response.data)
                ? error.response.data.toString('utf8')
                : JSON.stringify(error.response.data)
            : error.message;
        console.error("Chat Error:", errDetail);

        if (!res.headersSent) {
            res.status(500).json({ error: "حدث خطأ في الاتصال بالشات" });
        } else {
            res.write(`data: ${JSON.stringify({ error: "حدث خطأ في الاتصال" })}\n\n`);
            res.end();
        }
    }
});

app.post("/api/tts", async (req, res) => {
    try {
        const { text, voice_id } = req.body;
        if (!text) return res.status(400).json({ error: "النص مطلوب" });

        const targetVoiceId = voice_id || VOICE_MAP['girl'];
        const chunks = prepareArabicChunks(text);

        if (chunks.length === 0) {
            return res.status(400).json({ error: "النص غير صالح للنطق" });
        }

        const audioBuffers = [];
        for (const chunk of chunks) {
            const buf = await synthesizeChunk(chunk, targetVoiceId);
            audioBuffers.push(buf);
        }

        const finalAudio = Buffer.concat(audioBuffers);

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': finalAudio.length
        });
        res.send(finalAudio);
    } catch (error) {
        console.error("TTS Error:", error?.response?.data || error.message);
        res.status(500).json({ error: "حدث خطأ أثناء توليد الصوت" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
