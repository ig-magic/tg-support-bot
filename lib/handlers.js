import { kv } from "@vercel/kv";
import {
  sendMessage,
  copyMessage,
  createTopic,
  editTopic,
  pinMessage,
  getUserProfilePhotos,
  tg
} from "./telegram.js";

import { isAdmin, STATUS, buildTopicName, AUTO_REPLY } from "./utils.js";
import { KV } from "./kv.js";

const AUTO_REPLY_SENT = new Set();

export async function handleUpdate(update) {
  try {
    if (!update?.message) return;

    const msg = update.message;
    if (!msg.from || !msg.chat) return;

    const from = msg.from;
    const chat = msg.chat;

    // ================= USER SIDE =================
    if (chat.type === "private" && !isAdmin(from.id)) {

      // BAN CHECK
      const ban = await kv.get(KV.ban(from.id));
      if (ban?.active) return;

      // /start
      if (msg.text === "/start") {
        await sendMessage(from.id, "👋 Welcome! Send your message.");
        return;
      }

      let userMap = await kv.get(KV.user(from.id));

      // CREATE TOPIC
      if (!userMap) {
        const topicName = buildTopicName(from, STATUS.OPEN);
        const topic = await createTopic(topicName);

        if (!topic?.ok) return;

        const topicId = topic.result.message_thread_id;

        // PIN USER INFO
        const profileLink = from.username
          ? `https://t.me/${from.username}`
          : `tg://user?id=${from.id}`;

        const infoMsg = await sendMessage(
          process.env.LOG_GROUP_ID,
`👤 *USER INFO*
🆔 ${from.id}
👤 ${from.first_name || ""} ${from.last_name || ""}
🔗 [Profile](${profileLink})
🕒 ${new Date().toLocaleString()}`,
          { message_thread_id: topicId }
        );

        if (infoMsg?.ok) {
          await pinMessage(process.env.LOG_GROUP_ID, infoMsg.result.message_id);
        }

        // PROFILE PHOTO
        const photos = await getUserProfilePhotos(from.id, 1);
        if (photos?.ok && photos.result.total_count > 0) {
          await tg("sendPhoto", {
            chat_id: process.env.LOG_GROUP_ID,
            photo: photos.result.photos[0][0].file_id,
            message_thread_id: topicId
          });
        }

        await kv.set(KV.user(from.id), {
          topic_id: topicId,
          status: STATUS.OPEN,
          created_at: Date.now()
        });
        await kv.set(KV.topic(topicId), from.id);

        userMap = { topic_id: topicId, status: STATUS.OPEN };
      }

      // FORWARD MESSAGE
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
    if (
      chat.id === Number(process.env.LOG_GROUP_ID) &&
      typeof msg.message_thread_id === "number"
    ) {
      const userId = await kv.get(KV.topic(msg.message_thread_id));
      if (!userId) return;

      const userMap = await kv.get(KV.user(userId));
      if (!userMap) return;

      // COMMANDS
      if (msg.text === "/close") {
        await editTopic(
          msg.message_thread_id,
          buildTopicName({ id: userId }, STATUS.CLOSED)
        );
        await kv.set(KV.user(userId), {
          ...userMap,
          status: STATUS.CLOSED
        });
        await sendMessage(userId, "❌ Your ticket has been closed.");
        return;
      }

      if (msg.text === "/reopen") {
        await editTopic(
          msg.message_thread_id,
          buildTopicName({ id: userId }, STATUS.OPEN)
        );
        await kv.set(KV.user(userId), {
          ...userMap,
          status: STATUS.OPEN
        });
        await sendMessage(userId, "✅ Your ticket has been reopened.");
        return;
      }

      // NORMAL ADMIN REPLY
      const text = msg.text || msg.caption;
      if (text) {
        await sendMessage(userId, text);
      }
    }

  } catch (err) {
    console.error("HANDLE UPDATE ERROR:", err);
  }
}
