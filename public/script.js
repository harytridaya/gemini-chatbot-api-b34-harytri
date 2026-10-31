const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const submitBtn = document.getElementById('send-btn') || form.querySelector('button[type="submit"]');
const attachBtn = document.getElementById('attach-btn');
const imageInput = document.getElementById('image-input');
const previewContainer = document.getElementById('image-preview-container');
const previewImg = document.getElementById('preview-image');
const removeImageBtn = document.getElementById('remove-image-btn');

const historyList = document.getElementById('chat-history-list');
const newChatBtn = document.getElementById('new-chat-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');

// Simpan tampilan awal chat untuk digunakan saat membuat percakapan baru
const initialChatContent = chatBox.innerHTML;

// Menyimpan riwayat percakapan untuk dikirim ke backend
const conversation = [];

// Menyimpan ID chat aktif dari database Supabase
let currentChatId = null;

// Menyimpan data gambar yang sedang dipilih sebelum dikirim
let currentImage = null; // { data: base64String, mimeType: string, dataUrl: string }

// Trigger input file saat tombol lampiran diklik
if (attachBtn && imageInput) {
  attachBtn.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Harap pilih file gambar yang valid (JPG, PNG, WebP).');
      imageInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      const base64Data = dataUrl.split(',')[1];
      currentImage = {
        data: base64Data,
        mimeType: file.type,
        dataUrl: dataUrl
      };
      previewImg.src = dataUrl;
      previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });
}

// Tombol hapus gambar yang dipilih
if (removeImageBtn) {
  removeImageBtn.addEventListener('click', clearImageAttachment);
}

function clearImageAttachment() {
  currentImage = null;
  if (imageInput) imageInput.value = '';
  if (previewImg) previewImg.src = '';
  if (previewContainer) previewContainer.classList.add('hidden');
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  // Validasi: harus ada teks atau gambar yang dikirim
  if (!userMessage && !currentImage) return;

  const attached = currentImage;
  clearImageAttachment();

  // 1. Tampilkan pesan user (teks & gambar jika ada) di chat box
  appendUserMessage(userMessage, attached ? attached.dataUrl : null);
  input.value = '';

  // Susun objek pesan untuk percakapan
  const msgObj = {
    role: 'user',
    text: userMessage || (attached ? 'Tolong analisis gambar ini.' : '')
  };

  if (attached) {
    msgObj.image = {
      data: attached.data,
      mimeType: attached.mimeType
    };
  }

  conversation.push(msgObj);

  // 2. Tampilkan pesan bot dengan animasi loading ("Thinking...")
  const botMessageElement = createBotLoadingMessage();

  // Kunci form sementara untuk mencegah spam request
  setInputState(false);


  async function loadChatHistory() {
    if (!historyList) return;

    try {
      const response = await fetch('/api/chats');

      if (!response.ok) {
        throw new Error('Gagal mengambil riwayat percakapan');
      }

      const chats = await response.json();

      historyList.innerHTML = '';

      if (chats.length === 0) {
        historyList.innerHTML =
          '<p class="empty-history">Belum ada percakapan</p>';
        return;
      }

      chats.forEach(chat => {
        const item = document.createElement('button');

        item.className = 'history-item';
        item.textContent = chat.title;
        item.type = 'button';

        if (chat.id === currentChatId) {
          item.classList.add('active');
        }

        item.addEventListener('click', () => openChat(chat.id));

        historyList.appendChild(item);
      });

    } catch (error) {
      console.error('Error loadChatHistory:', error);
      historyList.innerHTML =
        '<p class="empty-history">Gagal memuat riwayat</p>';
    }
  }


  // Membuka percakapan yang dipilih
  async function openChat(chatId) {
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`);

      if (!response.ok) {
        throw new Error('Gagal mengambil pesan');
      }

      const messages = await response.json();

      currentChatId = chatId;
      conversation.length = 0;
      chatBox.innerHTML = '';

      messages.forEach(message => {
        conversation.push({
          role: message.role,
          text: message.content
        });

        if (message.role === 'user') {
          appendUserMessage(message.content, null);
        } else {
          const botMessage = document.createElement('div');
          botMessage.classList.add('message', 'bot');
          botMessage.innerHTML = renderMarkdown(message.content);
          chatBox.appendChild(botMessage);
        }
      });

      chatBox.scrollTop = chatBox.scrollHeight;

      await loadChatHistory();

      // Tutup sidebar pada tampilan mobile
      if (sidebar) sidebar.classList.remove('open');

    } catch (error) {
      console.error('Error openChat:', error);
      alert('Gagal membuka percakapan.');
    }
  }


  // Membuat percakapan baru
  function startNewChat() {
    currentChatId = null;
    conversation.length = 0;

    chatBox.innerHTML = initialChatContent;

    clearImageAttachment();

    if (input) input.value = '';

    loadChatHistory();

    if (sidebar) sidebar.classList.remove('open');

    if (input) input.focus();
  }


  // Tombol percakapan baru
  if (newChatBtn) {
    newChatBtn.addEventListener('click', startNewChat);
  }


  // Tombol menu untuk tampilan mobile
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }


  // Muat riwayat ketika aplikasi pertama kali dibuka
  loadChatHistory();


  try {
    // 3. Kirim request POST ke endpoint /api/chat
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ conversation, chat_id: currentChatId })
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const data = await response.json();

    // Simpan chat_id yang dikembalikan server untuk pesan berikutnya
    if (data && data.chat_id) {
      currentChatId = data.chat_id;
      await loadChatHistory();
    }

    // 4. Ganti animasi loading dengan teks markdown (mendukung gambar dari bot)
    if (data && data.result) {
      botMessageElement.innerHTML = renderMarkdown(data.result);
      conversation.push({ role: 'model', text: data.result });
    } else {
      botMessageElement.textContent = 'Sorry, no response received.';
      conversation.pop(); // Rollback pesan user jika tidak ada respons
    }
  } catch (error) {
    console.error('Error fetching chat response:', error);
    // 5. Tangani jika terjadi error koneksi / server
    botMessageElement.textContent = 'Failed to get response from server.';
    conversation.pop(); // Rollback pesan user jika error
  } finally {
    // Aktifkan kembali input form dan scroll ke bawah
    setInputState(true);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

/**
 * Menampilkan pesan user dengan teks & gambar
 */
function appendUserMessage(text, imageDataUrl) {
  const msg = document.createElement('div');
  msg.classList.add('message', 'user');

  if (imageDataUrl) {
    const img = document.createElement('img');
    img.src = imageDataUrl;
    img.classList.add('chat-image');
    img.alt = 'Uploaded image';
    msg.appendChild(img);
  }

  if (text) {
    const p = document.createElement('p');
    p.textContent = text;
    msg.appendChild(p);
  }

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

/**
 * Membuat bubble pesan bot dengan animasi loading (3 dots bouncing)
 */
function createBotLoadingMessage() {
  const msg = document.createElement('div');
  msg.classList.add('message', 'bot');
  msg.innerHTML = `
    <div class="typing-indicator" title="Thinking...">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

/**
 * Memformat teks markdown menjadi HTML yang rapi & aman (sanitized)
 */
function renderMarkdown(rawText) {
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
    const parsedHtml = marked.parse(rawText);
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(parsedHtml) : parsedHtml;
  }
  return rawText.replace(/\n/g, '<br/>');
}

/**
 * Mengunci atau mengaktifkan kembali kontrol input saat loading
 */
function setInputState(enabled) {
  input.disabled = !enabled;
  if (submitBtn) submitBtn.disabled = !enabled;
  if (attachBtn) attachBtn.disabled = !enabled;
  if (enabled) input.focus();
}
