import { kv } from "@vercel/kv";
import { sendMessage } from "../../telegram.js";
import { KV } from "../../kv.js";

export async function handleNotes(msg) {
  if (!msg.text.startsWith("/note ")) return false;

  const userId = await kv.get(KV.topic(msg.message_thread_id));
  if (!userId) return true;

  await kv.set(KV.note(userId), msg.text.slice(6));
  await sendMessage(msg.chat.id, "📝 Note saved", {
    message_thread_id: msg.message_thread_id
  });
  return true;
}
