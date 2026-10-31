
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Ambil konfigurasi dari file .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

// Periksa apakah konfigurasi tersedia
if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Konfigurasi Supabase belum lengkap. Periksa file .env');
}

// Buat koneksi Supabase
export const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

console.log('Supabase client berhasil diinisialisasi');
