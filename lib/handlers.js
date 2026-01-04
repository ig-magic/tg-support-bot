import { kv } from "@vercel/kv";
import {
  sendMessage,
  copyMessage,
  createTopic,
  pinMessage
} from "./telegram.js";
import { isAdmin, welcomeText, AUTO_REPLY } from "./utils.js";

const AUTO_REPLY_SENT = new Set();

export async function handleUpdate(update) {
  try {
    // ✅ HARD GUARD
    if (!update || !update.message) return;

    const msg = update.message;

    // ✅ Another guard
    if (!msg.from || !msg.chat) return;

    const from = msg.from;
    const chat = msg.chat;

    // ================= USER SIDE =================
    if (!isAdmin(from.id) && chat.type === "private") {

      // -------- /start --------
      if (msg.text === "/start") {
        await sendMessage(from.id, welcomeText(from));
        return;
      }

      // 1️⃣ Check user → topic mapping
      let userMap = await kv.get(`user:${from.id}`);

      // 2️⃣ Create topic if new user
      if (!userMap) {
        const topic = await createTopic(String(from.id));
        const topicId = topic.result.message_thread_id;

        const groupId = String(process.env.LOG_GROUP_ID);
        const internalId = groupId.startsWith("-100")
          ? groupId.slice(4)
          : groupId;

        const topicLink = `https://t.me/c/${internalId}/${topicId}`;

        // Pin user info
        const pin = await sendMessage(
          process.env.LOG_GROUP_ID,
`🆔 USER_ID: ${from.id}
👤 Name: ${from.first_name || ""}
🔗 Username: ${from.username ? "@" + from.username : "Not set"}
🔗 Topic: ${topicLink}`,
          { message_thread_id: topicId }
        );
        await pinMessage(process.env.LOG_GROUP_ID, pin.result.message_id);

        // Save mappings
        await kv.set(`user:${from.id}`, {
          topic_id: topicId,
          group_id: process.env.LOG_GROUP_ID,
          topic_link: topicLink
        });
        await kv.set(`topic:${topicId}`, from.id);

        userMap = { topic_id: topicId };
      }

      // 3️⃣ Forward user message to topic
      await copyMessage(
        process.env.LOG_GROUP_ID,
        from.id,
        msg.message_id,
        { message_thread_id: userMap.topic_id }
      );

      if (!AUTO_REPLY_SENT.has(from.id)) {
        AUTO_REPLY_SENT.add(from.id);
        await sendMessage(from.id, AUTO_REPLY);
      }

      return;
    }

    // ================= ADMIN SIDE =================
    // Message from log group + inside a topic
    if (
      chat.id === Number(process.env.LOG_GROUP_ID) &&
      typeof msg.message_thread_id === "number"
    ) {
      const userId = await kv.get(`topic:${msg.message_thread_id}`);
      if (!userId) return;

      const text = msg.text || msg.caption;
      if (!text) return;

      await sendMessage(userId, text);
      return;
    }

  } catch (err) {
    console.error("HANDLE UPDATE ERROR:", err);
  }
}
