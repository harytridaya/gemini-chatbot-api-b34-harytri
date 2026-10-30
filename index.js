import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));

app.post('/api/chat', async (req, res) => {
    const { conversation } = req.body;

    try {
        if (!Array.isArray(conversation)) throw new Error('Message must be an array');

        const contents = conversation.map(({ role, text, image }) => {
            const parts = [];
            if (text) {
                parts.push({ text });
            }
            if (image && image.data && image.mimeType) {
                parts.push({
                    inlineData: {
                        data: image.data,
                        mimeType: image.mimeType
                    }
                });
            }
            return { role, parts };
        });

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config: {
                systemInstruction: `
                    Anda adalah 'Triva' yang merupakan travel agent berpengalaman 10 tahun.
                    Jawab hanya pertanyaan terkait travel, tolak dengan sopan jika user bertanya di luar tentang travel.
                    Jika user mengirim gambar atau foto (misalnya tempat wisata, landmark, tiket perjalanan, atau makanan khas), analisis gambar tersebut dan berikan info atau rekomendasi travel yang relevan.
                    Tanyakan user ingin liburan kemana, dan berapa lama. Lalu buatkan itinerary berdasarkan jawaban user.
                    Jawab dengan nada ramah dan dengan emoji.
                    `
            }
        });
        res.status(200).json({ result: response.text });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
