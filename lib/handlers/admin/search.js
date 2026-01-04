import { kv } from "@vercel/kv";
import { sendMessage } from "../../telegram.js";
import { KV } from "../../kv.js";

export async function handleSearch(msg) {
  if (!msg.text.startsWith("/search")) return false;

  const id = Number(msg.text.split(" ")[1]);
  if (!id) return true;

  const map = await kv.get(KV.user(id));
  if (!map) {
    await sendMessage(msg.chat.id, "❌ User not found", {
      message_thread_id: msg.message_thread_id
    });
    return true;
  }

  await sendMessage(
    msg.chat.id,
    `🧵 Topic ID: ${map.topic_id}`,
    { message_thread_id: msg.message_thread_id }
  );
  return true;
}
