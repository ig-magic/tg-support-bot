import { copyMessage } from "../../telegram.js";
import { kv } from "@vercel/kv";
import { KV } from "../../kv.js";

export async function forwardUserMessage(msg, topicId) {
  try {
    await copyMessage(
      process.env.LOG_GROUP_ID,
      msg.from.id,
      msg.message_id,
      { message_thread_id: topicId }
    );
    await kv.set(`last_user_msg:${msg.from.id}`, Date.now());
  } catch (e) {
    // topic deleted → reset mapping
    await kv.delete(KV.user(msg.from.id));
    throw e;
  }
}
