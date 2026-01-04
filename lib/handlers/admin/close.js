import { kv } from "@vercel/kv";
import { editTopic, sendMessage } from "../../telegram.js";
import { KV } from "../../kv.js";
import { STATUS, buildTopicName } from "../../utils.js";

export async function handleClose(msg) {
  if (msg.text !== "/close") return false;

  const userId = await kv.get(KV.topic(msg.message_thread_id));
  if (!userId) return true;

  await editTopic(
    msg.message_thread_id,
    buildTopicName({ id: userId }, STATUS.CLOSED)
  );

  await kv.set(KV.user(userId), {
    ...(await kv.get(KV.user(userId))),
    status: STATUS.CLOSED
  });

  await sendMessage(userId, "❌ Your ticket has been closed.");
  return true;
}
