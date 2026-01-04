import { kv } from "@vercel/kv";
import { editTopic, sendMessage } from "../../telegram.js";
import { KV } from "../../kv.js";
import { STATUS, buildTopicName } from "../../utils.js";

export async function handleBan(msg) {
  if (!msg.text.startsWith("/ban") && msg.text !== "/unban") return false;

  const userId = await kv.get(KV.topic(msg.message_thread_id));
  if (!userId) return true;

  if (msg.text === "/unban") {
    await kv.delete(KV.ban(userId));
    await editTopic(
      msg.message_thread_id,
      buildTopicName({ id: userId }, STATUS.OPEN)
    );
    await sendMessage(userId, "✅ You have been unbanned.");
    return true;
  }

  await kv.set(KV.ban(userId), { active: true });
  await editTopic(
    msg.message_thread_id,
    buildTopicName({ id: userId }, STATUS.BANNED)
  );
  await sendMessage(userId, "🚫 You have been banned.");
  return true;
}
