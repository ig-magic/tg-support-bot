import { kv } from "@vercel/kv";
import { editTopic, sendMessage } from "../../telegram.js";
import { KV } from "../../kv.js";
import { STATUS, buildTopicName } from "../../utils.js";

export async function handleReopen(msg) {
  if (msg.text !== "/reopen") return false;

  const userId = await kv.get(KV.topic(msg.message_thread_id));
  if (!userId) return true;

  await editTopic(
    msg.message_thread_id,
    buildTopicName({ id: userId }, STATUS.OPEN)
  );

  await kv.set(KV.user(userId), {
    ...(await kv.get(KV.user(userId))),
    status: STATUS.OPEN
  });

  await sendMessage(userId, "✅ Your ticket has been reopened.");
  return true;
}
