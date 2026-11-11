// Află TELEGRAM_CHAT_ID-ul tău.
// 1) Scrie-i botului tău orice mesaj în Telegram (ex. /start).
// 2) Rulează:  node scripts/telegram-chat-id.mjs TOKENUL_BOTULUI
//
// Tokenul NU se salvează nicăieri — îl folosești doar acum, local.

const token = process.argv[2] || process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Folosire: node scripts/telegram-chat-id.mjs <TOKEN_BOT>');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const body = await res.json();
if (!body.ok) {
  console.error('Eroare Telegram:', body.description);
  process.exit(1);
}

const chats = new Map();
for (const u of body.result) {
  const chat = (u.message || u.edited_message || u.channel_post || u.my_chat_member)?.chat;
  if (chat) chats.set(chat.id, chat);
}

if (!chats.size) {
  console.log('Nu am găsit mesaje. Scrie-i botului /start în Telegram și rulează din nou.');
} else {
  for (const c of chats.values()) {
    const who = c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username;
    console.log(`TELEGRAM_CHAT_ID = ${c.id}   (${c.type}: ${who})`);
  }
}
