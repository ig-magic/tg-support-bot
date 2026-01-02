import { sendMessage, copyMessage } from "./telegram.js";
import { ensureUserTopic } from "./topics.js";
import { isAdmin, welcomeText, AUTO_REPLY } from "./utils.js";

const repliedOnce = new Set();

export async function handleUpdate(update) {
  if (!update.message) return;

  const msg = update.message;
  const from = msg.from;

  // -------- USER SIDE --------
  if (!isAdmin(from.id)) {
    // /start
    if (msg.text === "/start") {
      await ensureUserTopic(from);
      await sendMessage(from.id, welcomeText(from));
      return;
    }

    const topicId = await ensureUserTopic(from);

    await copyMessage(
      process.env.LOG_GROUP_ID,
      from.id,
      msg.message_id,
      { message_thread_id: topicId }
    );

    if (!repliedOnce.has(from.id)) {
      repliedOnce.add(from.id);
      await sendMessage(from.id, AUTO_REPLY);
    }
    return;
  }

  // -------- ADMIN SIDE --------
  if (!msg.message_thread_id) return;

  const text = msg.text || msg.caption;
  if (!text) return;

  const pinned = await sendMessage(
    process.env.LOG_GROUP_ID,
    ".",
    { message_thread_id: msg.message_thread_id }
  );

  const match = pinned.result.text?.match(/User ID: (\d+)/);
  if (!match) return;

  const userId = Number(match[1]);
  await sendMessage(userId, text);
}
