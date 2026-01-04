import { sendMessage, pinMessage } from "../../telegram.js";
import { kv } from "@vercel/kv";
import { KV } from "../../kv.js";

export async function handleAdminReply(msg) {
  const userId = await kv.get(KV.topic(msg.message_thread_id));
  if (!userId || !msg.text) return;

  await sendMessage(userId, msg.text);
  await pinMessage(msg.chat.id, msg.message_id);
}
