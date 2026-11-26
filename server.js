const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "cohere/north-mini-code:free";
const FALLBACK_MODELS = [
    process.env.OPENROUTER_FALLBACK_MODEL,
    "openrouter/free"
].filter(Boolean);
const URL = `https://openrouter.ai/api/v1/chat/completions`;

const FISH_API_KEY = process.env.FISH_API_KEY || 'sk-fish-Mz4VAGGAWvn6bbSdG0tddMmlU_IG4WtaUdjkDYQX3FE';

// قاموس الأصوات (بنت صايعة أولاً، صدام حسين ثانياً، وبقية الأصوات بدون ألقاب)
const VOICE_MAP = {
    'girl': '7409fcf04906472db14cb0dd5a50ccb0',
    'saddam': 'e222b3a8dc7d4afcb24c0827874a2960',
    'miku': 'fef2a33d77584832badf637d5e6b00c5',
    'mommy': '8e4e02d2503b448eb4d6a2efd99c84e3',
    'Yui hirasawa': 'dbb7d501cb154cf19287437e05326de4',
    'ahhh': '1d785d369dbf41589e421f4c72713629',
    'child': 'dbb776759f3b40d688ad282a50068d58',
    'daddy': 'a02d16b68013480fa1ab465427f35b30',
    'memati': 'b8a16ccac9ad4bc78f5f3f5dd46dc6b5',
    'aboflah': '7e4fa512aa564e198f8659b466f6ff70',
    'tebboune': '207bf4478cfc456e8823de046272044b',
    'gumball': '1d51fdd65ff14342aec4dffa0ef58386'
};

function formatErrorData(err) {
    const data = err?.response?.data;
    if (!data) return err?.message || 'Unknown error';
    if (Buffer.isBuffer(data)) return data.toString('utf8');
    if (typeof data === 'object' && typeof data.on === 'function') {
        return `Stream Error (${err?.response?.status || 'no-status'}): ${err?.message || ''}`;
    }
    if (typeof data === 'object') return JSON.stringify(data);
    return String(data);
}

async function openChatStream(modelName, message) {
    return axios.post(URL, {
        model: modelName,
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
        responseType: 'stream',
        timeout: 30000
    });
}

// تنظيف النص وتقسيمه إلى مقاطع بانسيابية قريبة من التوليد المباشر
function prepareArabicChunks(rawText, maxLen = 320) {
    const cleaned = String(rawText)
        .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FFa-zA-Z0-9\s،.!?؟؛:()\-_[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return [];

    if (cleaned.length <= maxLen) {
        return [cleaned];
    }

    // تقسيم حسب نهايات الجمل الكبيرة أولاً لتقليل التقطيع بين العبارات المترابطة
    const parts = cleaned.match(/[^.!?؟\n]+[.!?؟]?/g) || [cleaned];
    const chunks = [];

    for (const part of parts) {
        const piece = part.trim();
        if (!piece) continue;

        if (piece.length <= maxLen) {
            chunks.push(piece);
        } else {
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
            'Content-Type': 'application/json',
            'model': 's2.1-pro-free'
        },
        data: {
            text,
            reference_id: targetVoiceId,
            model: 's2.1-pro-free',
            normalize: true,
            latency: 'normal',
            temperature: 0.45,
            top_p: 0.9,
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
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const candidateModels = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];
        let response = null;
        let lastError = null;

        for (const candidate of candidateModels) {
            try {
                response = await openChatStream(candidate, message);
                if (candidate !== MODEL) {
                    console.log(`Chat fallback active using model: ${candidate}`);
                }
                break;
            } catch (err) {
                lastError = err;
                console.error(`Chat Error (${candidate}):`, formatErrorData(err));
            }
        }

        if (!response) {
            throw lastError || new Error("All chat models failed");
        }

        response.data.on('data', (chunk) => res.write(chunk));
        response.data.on('end', () => res.end());
        response.data.on('error', (streamErr) => {
            console.error("Chat Stream Error:", streamErr?.message || streamErr);
            res.write('data: {"error": "حدث خطأ في الاتصال"}\n\n');
            res.end();
        });
    } catch (error) {
        console.error("Chat Error:", formatErrorData(error));
        res.write('data: {"error": "حدث خطأ في الاتصال"}\n\n');
        res.end();
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
        console.error("TTS Error:", formatErrorData(error));
        res.status(500).json({ error: "حدث خطأ أثناء توليد الصوت" });
    }
});

const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://yacx-ai-serverrrr.onrender.com';
setInterval(() => {
    if (RENDER_URL) {
        axios.get(`${RENDER_URL}/ping`).catch(() => {});
    }
}, 600000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
