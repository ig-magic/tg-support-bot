import { kv } from "@vercel/kv";
import { sendMessage, copyMessage, createTopic, pinMessage } from "./telegram.js";
import { isAdmin, welcomeText, AUTO_REPLY } from "./utils.js";

// Prevent spam auto-replies
const AUTO_REPLY_SENT = new Set();

export async function handleUpdate(update) {
  if (!update.message) return;

  const msg = update.message;
  const user = msg.from;

  // ================= USER SIDE =================
  if (!isAdmin(user.id)) {

    // ---------- /start ----------
    if (msg.text === "/start") {

      // Check KV mapping
      let topicId = await kv.get(`user:${user.id}`);

      // Create topic ONLY if not exists
      if (!topicId) {
        const topic = await createTopic(String(user.id));
        topicId = topic.result.message_thread_id;

        // Pin user info (for admins only)
        const pin = await sendMessage(
          process.env.LOG_GROUP_ID,
`🆔 USER_ID: ${user.id}
👤 Name: ${user.first_name || ""}
🔗 Username: ${user.username ? "@" + user.username : "Not set"}`,
          { message_thread_id: topicId }
        );

        await pinMessage(process.env.LOG_GROUP_ID, pin.result.message_id);

        // Store mapping for 24h
        await kv.set(`user:${user.id}`, topicId, { ex: 86400 });
      }

      await sendMessage(user.id, welcomeText(user));
      return;
    }

    // ---------- NORMAL USER MESSAGE ----------
    const topicId = await kv.get(`user:${user.id}`);

    if (!topicId) {
      await sendMessage(
        user.id,
        "⚠️ Session expired.\nPlease send /start again."
      );
      return;
    }

    await copyMessage(
      process.env.LOG_GROUP_ID,
      user.id,
      msg.message_id,
      { message_thread_id: topicId }
    );

    // Auto-reply only once
    if (!AUTO_REPLY_SENT.has(user.id)) {
      AUTO_REPLY_SENT.add(user.id);
      await sendMessage(user.id, AUTO_REPLY);
    }
    return;
  }

  // ================= ADMIN SIDE =================
  // Admin must reply inside a topic
  if (!msg.message_thread_id) return;

  const text = msg.text || msg.caption;
  if (!text) return;

  // Topic name is USER_ID
  const userId = Number(msg.message_thread_id);
  if (!userId) return;

  await sendMessage(userId, text);
}
