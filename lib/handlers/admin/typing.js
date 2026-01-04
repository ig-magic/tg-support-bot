import { tg } from "../../telegram.js";

export async function handleTyping(msg) {
  if (msg.text && !msg.text.startsWith("/")) {
    await tg("sendChatAction", {
      chat_id: msg.from.id,
      action: "typing"
    });
  }
}
