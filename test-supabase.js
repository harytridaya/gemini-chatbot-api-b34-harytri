
import { supabase } from './supabaseClient.js';

async function testConnection() {
    console.log('Menguji koneksi ke Supabase...');

    const { data, error } = await supabase
        .from('chats')
        .select('id, title, created_at')
        .limit(5);

    if (error) {
        console.error('Koneksi gagal:', error.message);
        return;
    }

    console.log('Koneksi database berhasil!');
    console.log('Data percakapan:', data);
}

testConnection();
