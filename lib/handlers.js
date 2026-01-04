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

function parseBanDuration(text) {
  if (!text) return null;
  const match = text.match(/(\d+)(h|d)/);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2];

  if (unit === "h") return value * 60 * 60 * 1000;
  if (unit === "d") return value * 24 * 60 * 60 * 1000;
  return null;
}

export async function handleUpdate(update) {
  try {
    if (!update?.message) return;

    const msg = update.message;
    if (!msg.from || !msg.chat) return;

    const from = msg.from;
    const chat = msg.chat;

    // ================= USER SIDE =================
    if (chat.type === "private" && !isAdmin(from.id)) {

      // 🔒 BAN CHECK
      const ban = await kv.get(KV.ban(from.id));
      if (ban?.active) {
        if (!ban.until || Date.now() < ban.until) return;
        await kv.delete(KV.ban(from.id)); // auto-unban
      }

      if (msg.text === "/start") {
        await sendMessage(from.id, "👋 Welcome! Send your message.");
        return;
      }

      let userMap = await kv.get(KV.user(from.id));

      // CREATE TOPIC IF NEEDED
      if (!userMap) {
        const topicName = buildTopicName(from, STATUS.OPEN);
        const topic = await createTopic(topicName);
        if (!topic?.ok) return;

        const topicId = topic.result.message_thread_id;

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

      const text = msg.text || "";

      // 🚫 BAN
      if (text.startsWith("/ban")) {
        const duration = parseBanDuration(text);
        const until = duration ? Date.now() + duration : null;

        await kv.set(KV.ban(userId), {
          active: true,
          until
        });

        await editTopic(
          msg.message_thread_id,
          buildTopicName({ id: userId }, STATUS.BANNED)
        );

        await sendMessage(
          userId,
          "🚫 You have been banned from support."
        );
        return;
      }

      // ✅ UNBAN
      if (text === "/unban") {
        await kv.delete(KV.ban(userId));

        await editTopic(
          msg.message_thread_id,
          buildTopicName({ id: userId }, STATUS.OPEN)
        );

        await sendMessage(
          userId,
          "✅ You have been unbanned."
        );
        return;
      }

      // 📊 STATS
      if (text === "/stats") {
        const keys = await kv.keys("user:*");
        const banned = await kv.keys("ban:*");

        await sendMessage(
          chat.id,
`📊 *STATS*
👥 Total Users: ${keys.length}
🚫 Banned Users: ${banned.length}`,
          { message_thread_id: msg.message_thread_id }
        );
        return;
      }

      // 🔍 SEARCH
      if (text.startsWith("/search")) {
        const id = Number(text.split(" ")[1]);
        if (!id) return;

        const map = await kv.get(KV.user(id));
        if (!map) {
          await sendMessage(
            chat.id,
            "❌ User not found",
            { message_thread_id: msg.message_thread_id }
          );
          return;
        }

        await sendMessage(
          chat.id,
`🔍 *USER FOUND*
🆔 ${id}
🧵 Topic ID: ${map.topic_id}`,
          { message_thread_id: msg.message_thread_id }
        );
        return;
      }

      // 📌 AUTO-PIN LAST ADMIN MESSAGE
      if (text) {
        const sent = await sendMessage(userId, text);
        if (sent?.ok) {
          await pinMessage(chat.id, msg.message_id);
        }
      }
    }

  } catch (err) {
    console.error("HANDLE UPDATE ERROR:", err);
  }
}
