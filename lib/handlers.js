import { sendMessage, copyMessage } from "./telegram.js";
import { ensureUserTopic } from "./topics.js";
import { isAdmin, welcomeText, AUTO_REPLY } from "./utils.js";

/**
 * Tracks auto-reply per user (no spam)
 */
const AUTO_REPLY_SENT = new Set();

export async function handleUpdate(update) {
  if (!update.message) return;

  const msg = update.message;
  const from = msg.from;

  // ---------------- USER SIDE ----------------
  if (!isAdmin(from.id)) {

    // /start (topic created ONLY first time)
    if (msg.text === "/start") {
      await ensureUserTopic(from);
      await sendMessage(from.id, welcomeText(from));
      return;
    }

    // Normal user message
    const topicId = await ensureUserTopic(from);

    await copyMessage(
      process.env.LOG_GROUP_ID,
      from.id,
      msg.message_id,
      { message_thread_id: topicId }
    );

    // Auto-reply only ONCE
    if (!AUTO_REPLY_SENT.has(from.id)) {
      AUTO_REPLY_SENT.add(from.id);
      await sendMessage(from.id, AUTO_REPLY);
    }
    return;
  }

  // ---------------- ADMIN SIDE ----------------
  // Admin must reply inside topic
  if (!msg.message_thread_id) return;

  // Read pinned message to find USER_ID
  const chat = await sendMessage(
    process.env.LOG_GROUP_ID,
    ".",
    { message_thread_id: msg.message_thread_id }
  );

  const pinnedText = chat?.result?.reply_to_message?.pinned_message?.text;
  if (!pinnedText) return;

  const match = pinnedText.match(/USER_ID:\s*(\d+)/);
  if (!match) return;

  const userId = Number(match[1]);

  const text = msg.text || msg.caption;
  if (!text) return;

  await sendMessage(userId, text);
}
