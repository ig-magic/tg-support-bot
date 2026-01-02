import { sendMessage, copyMessage, createTopic, pinMessage } from "./telegram.js";
import { isAdmin, welcomeText, AUTO_REPLY } from "./utils.js";

/**
 * In-memory map (per runtime)
 * userId -> topicId
 */
const USER_TOPICS = new Map();
const AUTO_REPLY_SENT = new Set();

export async function handleUpdate(update) {
  if (!update.message) return;

  const msg = update.message;
  const user = msg.from;

  // ================= USER SIDE =================
  if (!isAdmin(user.id)) {

    // -------- /start --------
    if (msg.text === "/start") {

      // already have topic in memory
      if (USER_TOPICS.has(user.id)) {
        await sendMessage(user.id, welcomeText(user));
        return;
      }

      // create topic ONLY HERE
      const topic = await createTopic(String(user.id));
      const topicId = topic.result.message_thread_id;

      // pin user info
      const pin = await sendMessage(
        process.env.LOG_GROUP_ID,
`🆔 USER_ID: ${user.id}
👤 Name: ${user.first_name || ""}
🔗 Username: ${user.username ? "@" + user.username : "Not set"}`,
        { message_thread_id: topicId }
      );

      await pinMessage(process.env.LOG_GROUP_ID, pin.result.message_id);

      USER_TOPICS.set(user.id, topicId);
      await sendMessage(user.id, welcomeText(user));
      return;
    }

    // -------- normal message --------
    if (!USER_TOPICS.has(user.id)) {
      await sendMessage(
        user.id,
        "⚠️ Session expired.\nPlease send /start again to continue."
      );
      return;
    }

    const topicId = USER_TOPICS.get(user.id);

    await copyMessage(
      process.env.LOG_GROUP_ID,
      user.id,
      msg.message_id,
      { message_thread_id: topicId }
    );

    if (!AUTO_REPLY_SENT.has(user.id)) {
      AUTO_REPLY_SENT.add(user.id);
      await sendMessage(user.id, AUTO_REPLY);
    }
    return;
  }

  // ================= ADMIN SIDE =================
  if (!msg.message_thread_id) return;

  const text = msg.text || msg.caption;
  if (!text) return;

  // topic name IS user_id
  const userId = Number(msg.message_thread_id); // logical mapping
  if (!userId) return;

  await sendMessage(userId, text);
}
