const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const submitBtn = document.getElementById('send-btn') || form.querySelector('button[type="submit"]');
const attachBtn = document.getElementById('attach-btn');
const imageInput = document.getElementById('image-input');
const previewContainer = document.getElementById('image-preview-container');
const previewImg = document.getElementById('preview-image');
const removeImageBtn = document.getElementById('remove-image-btn');

// Menyimpan riwayat percakapan untuk dikirim ke backend
const conversation = [];

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

  try {
    // 3. Kirim request POST ke endpoint /api/chat
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ conversation })
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const data = await response.json();

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
