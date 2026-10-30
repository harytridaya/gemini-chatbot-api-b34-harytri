const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const submitBtn = document.getElementById('send-btn') || form.querySelector('button[type="submit"]');

// Menyimpan riwayat percakapan untuk dikirim ke backend
const conversation = [];

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  // 1. Tampilkan pesan user di chat box & kosongkan input
  appendUserMessage(userMessage);
  input.value = '';

  // Simpan ke riwayat percakapan
  conversation.push({ role: 'user', text: userMessage });

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

    // 4. Ganti animasi loading dengan teks markdown yang sudah diformat
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
 * Menampilkan pesan user (plain text aman dari XSS)
 */
function appendUserMessage(text) {
  const msg = document.createElement('div');
  msg.classList.add('message', 'user');
  msg.textContent = text;
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
  if (enabled) input.focus();
}
