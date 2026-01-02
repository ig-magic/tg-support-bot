const API = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

export async function tg(method, params = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return res.json();
}

export const sendMessage = (chat_id, text, extra = {}) =>
  tg("sendMessage", { chat_id, text, parse_mode: "Markdown", ...extra });

export const copyMessage = (chat_id, from_chat_id, message_id, extra = {}) =>
  tg("copyMessage", { chat_id, from_chat_id, message_id, ...extra });

export const createTopic = (name) =>
  tg("createForumTopic", {
    chat_id: process.env.LOG_GROUP_ID,
    name
  });

export const pinMessage = (chat_id, message_id) =>
  tg("pinChatMessage", { chat_id, message_id });

export const getChat = (chat_id) =>
  tg("getChat", { chat_id });
