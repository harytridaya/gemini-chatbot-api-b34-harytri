
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { supabase } from './supabaseClient.js';

const app = express();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server ready on http://localhost:${PORT}`);
});

// Endpoint chatbot
app.post('/api/chat', async (req, res) => {
    const { conversation, chat_id } = req.body;

    try {
        // 1. Validasi conversation
        if (!Array.isArray(conversation) || conversation.length === 0) {
            throw new Error('Message must be a non-empty array');
        }

        // 2. Ambil pesan user terakhir untuk disimpan
        let lastUserMessage;

        for (let i = conversation.length - 1; i >= 0; i--) {
            if (conversation[i].role === 'user') {
                lastUserMessage = conversation[i];
                break;
            }
        }

        if (!lastUserMessage) {
            throw new Error('Pesan pengguna tidak ditemukan');
        }

        // 3. Siapkan isi percakapan untuk Gemini
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

        // 4. Minta Gemini menghasilkan jawaban
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents,
            config: {
                systemInstruction: `
"Kamu adalah EduChat AI, seorang asisten pembelajaran virtual yang cerdas, interaktif, dan ramah, yang dirancang khusus untuk mendampingi siswa Sekolah Menengah Kejuruan (SMK) di Indonesia. 
1. Peran dan Karakter Utama
Identitas: Nama kamu adalah EduChat AI.
Persona: Kakak pembimbing atau mentor sebaya yang suportif, sabar, antusias, dan menggunakan bahasa yang santai namun tetap edukatif dan sopan.
Pengetahuan Pedagogik : Memiliki pengetahuan luas tentang dunia Pendidikan.Memahami secara detail Ilmu Pendidikan, Psikologi Pendidikan, berbagai Teori Belajar, Model- model pembelajaan, Strategi pembelajaran, pendekatan pembelajaran, Moda dan Teknik Pembelajaran.Memahami Karakteristik siswa.Memahami semua Peraturan yang sedang berlaku saat ini. 
Target Pengguna: Siswa SMK dari berbagai Kompetensi Keahlian(Jurusan) seperti Agribisnis dan Agroteknologi/ Pertanian, Teknik Komputer dan Jaringan(TKJ), Rekayasa Perangkat Lunak(RPL), Akuntansi dan Keuangan Lembaga(AKL), Bisnis Daring dan Pemasaran(BDP), Teknik Kendaraan Ringan(TKR), Perhotelan, Tata Busana, dan jurusan SMK lainnya.

2. Gaya Komunikasi dan Bahasa
- Gunakan bahasa Indonesia yang akrab, memotivasi, dan mudah dipahami oleh remaja(usia 15–18 tahun).
- Hindari penggunaan istilah atau jargon yang terlalu akademis atau kaku tanpa memberikan penjelasan sederhananya.
- Gunakan panggilan yang akrab seperti "Kamu", "Sobat", atau menyapa sesuai jurusan jika relevan.
- Sesekali gunakan analogi dunia nyata atau praktik industri yang dekat dengan keseharian siswa SMK agar materi lebih mudah dicerna.

3. Fokus Materi Pembelajaran
Mata Pelajaran Normatif & Adaptif: Matematika, Bahasa Indonesia, Bahasa Inggris, IPAS, Sejarah, PPKn.
Mata Pelajaran Produktif / Kejuruan: Sesuaikan dengan jurusan siswa(misalnya dasar - dasar pemrograman, jaringan komputer, dasar akuntansi, pelayanan prima, teknik mesin dasar, dll.).
Keterampilan Abad 21 & Kesiapan Kerja: Tips magang / PKL(Praktik Kerja Lapangan), pembuatan portofolio, persiapan wawancara kerja, dasar kewirausahaan(entrepreneurship), dan etos kerja industri.

4. Metode Pendampingan(Pedagogi)
Jangan Langsung Memberi Jawaban Instan: Jika siswa bertanya tentang soal latihan atau tugas, bimbing mereka langkah demi langkah menggunakan metode * scaffolding * (pertanyaan pemantik) agar mereka berpikir kritis dan menemukan jawabannya sendiri.
Berbasis Praktik: Utamakan pendekatan * learning by doing * (belajar sambil melakukan) yang menjadi ciri khas pendidikan vokasi / SMK.
Kontekstual: Hubungkan teori pelajaran dengan implementasinya di dunia kerja atau dunia industri(DUDI).

5. Aturan & Batasan(Guardrails)
Fokus Edukasi: Tolak dengan sopan jika ada pertanyaan di luar konteks pendidikan, pengembangan diri, atau persiapan karier siswa SMK, lalu arahkan kembali ke topik belajar.
Akurasi & Integritas: Pastikan informasi yang diberikan akurat, terutama terkait rumus, kode pemrograman, standar akuntansi, atau prosedur teknis.Jika ragu, sarankan siswa untuk memastikannya kembali pada guru pengampu di sekolah
Etika: Selalu dukung nilai - nilai positif, hindari konten negatif, bullying, atau hal - hal yang bertentangan dengan norma dan hukum yang berlaku di Indonesia."
 `
            }

        });

        const answer = response.text;

        // 5. Jika belum punya chat_id, buat percakapan baru
        let currentChatId = chat_id;

        if (!currentChatId) {
            const title = (lastUserMessage.text || 'Percakapan dengan gambar')
                .trim()
                .slice(0, 60);

            const { data: newChat, error: chatError } = await supabase
                .from('chats')
                .insert({ title })
                .select('id')
                .single();

            if (chatError) throw chatError;

            currentChatId = newChat.id;
        } else {
            // Pastikan chat_id memang ada
            const { data: existingChat, error: findError } = await supabase
                .from('chats')
                .select('id')
                .eq('id', currentChatId)
                .maybeSingle();

            if (findError) throw findError;

            if (!existingChat) {
                return res.status(404).json({
                    error: 'Percakapan tidak ditemukan'
                });
            }
        }

        // 6. Simpan pertanyaan dan jawaban ke tabel messages
        const userContent = [
            lastUserMessage.text || '',
            lastUserMessage.image ? '[Gambar dilampirkan]' : ''
        ].filter(Boolean).join('\n');

        const { error: messageError } = await supabase
            .from('messages')
            .insert([
                {
                    chat_id: currentChatId,
                    role: 'user',
                    content: userContent
                },
                {
                    chat_id: currentChatId,
                    role: 'model',
                    content: answer || ''
                }
            ]);

        if (messageError) throw messageError;

        // 7. Perbarui waktu percakapan
        const { error: updateError } = await supabase
            .from('chats')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', currentChatId);

        if (updateError) throw updateError;

        // 8. Kirim jawaban dan chat_id ke frontend
        res.status(200).json({
            result: answer,
            chat_id: currentChatId
        });

    } catch (e) {
        console.error('Chat error:', e);

        res.status(500).json({
            error: e.message
        });
    }
});


// Mengambil daftar seluruh percakapan
app.get('/api/chats', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('chats')
            .select('id, title, created_at, updated_at')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('Gagal mengambil riwayat chat:', error.message);
        res.status(500).json({ error: 'Gagal mengambil riwayat percakapan' });
    }
});


// Mengambil seluruh pesan dari satu percakapan
app.get('/api/chats/:id/messages', async (req, res) => {
    try {
        const chatId = req.params.id;

        // Pastikan percakapan tersedia
        const { data: chat, error: chatError } = await supabase
            .from('chats')
            .select('id')
            .eq('id', chatId)
            .maybeSingle();

        if (chatError) throw chatError;

        if (!chat) {
            return res.status(404).json({
                error: 'Percakapan tidak ditemukan'
            });
        }

        // Ambil pesan berdasarkan urutan waktu
        const { data, error } = await supabase
            .from('messages')
            .select('id, role, content, created_at')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error('Gagal mengambil pesan:', error.message);
        res.status(500).json({ error: 'Gagal mengambil pesan percakapan' });
    }
});

