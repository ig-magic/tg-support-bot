import { kv } from "@vercel/kv";
import { sendMessage } from "../../telegram.js";

export async function handleStats(msg) {
  if (msg.text !== "/stats") return false;

  const users = await kv.keys("user:*");
  const bans = await kv.keys("ban:*");

  await sendMessage(
    msg.chat.id,
    `📊 Stats\nUsers: ${users.length}\nBanned: ${bans.length}`,
    { message_thread_id: msg.message_thread_id }
  );
  return true;
}
