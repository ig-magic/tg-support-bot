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

// ---------- Helpers ---------- //

function now() {
  return Date.now();
}

function minutes(ms) {
  return Math.floor(ms / 60000);
}

// reply templates
const TEMPLATES = {
  hello: "👋 Hello! How can I help you?",
  wait: "⏳ Please wait, we are checking this.",
  done: "✅ Your issue has been resolved."
};

// ---------- Main Handler ---------- //

export async function handleUpdate(update) {
  try {
    if (!update?.message) return;

    const msg = update.message;
    if (!msg.from || !msg.chat) return;

    const from = msg.from;
    const chat = msg.chat;

    // ================= USER SIDE =================
    if (chat.type === "private" && !isAdmin(from.id)) {

      // ban check
      const ban = await kv.get(KV.ban(from.id));
      if (ban?.active && (!ban.until || now() < ban.until)) return;

      if (msg.text === "/start") {
        await sendMessage(from.id, "👋 Welcome! Send your message.");
        return;
      }

      let userMap = await kv.get(KV.user(from.id));

      // create topic if new
      if (!userMap) {
        const topicName = buildTopicName(from, STATUS.OPEN);
        const topic = await createTopic(topicName);
        if (!topic?.ok) return;

        const topicId = topic.result.message_thread_id;

        // pin info
        const profileLink = from.username
          ? `https://t.me/${from.username}`
          : `tg://user?id=${from.id}`;

        const infoMsg = await sendMessage(
          process.env.LOG_GROUP_ID,
`👤 *USER INFO*
🆔 ${from.id}
👤 ${from.first_name || ""} ${from.last_name || ""}
🔗 [Profile](${profileLink})
🕒 First Contact: ${new Date().toLocaleString()}`,
          { message_thread_id: topicId }
        );

        if (infoMsg?.ok) {
          await pinMessage(process.env.LOG_GROUP_ID, infoMsg.result.message_id);
        }

        // profile photo
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
          created_at: now()
        });
        await kv.set(KV.topic(topicId), from.id);

        userMap = { topic_id: topicId, status: STATUS.OPEN };
      }

      // forward any message
      await copyMessage(
        process.env.LOG_GROUP_ID,
        from.id,
        msg.message_id,
        { message_thread_id: userMap.topic_id }
      );

      // save last user message time
      await kv.set(`last_user_msg:${from.id}`, now());

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

      // ---------- typing simulation ----------
      if (text && !text.startsWith("/")) {
        await tg("sendChatAction", {
          chat_id: userId,
          action: "typing"
        });
      }

      // ---------- /note ----------
      if (text.startsWith("/note ")) {
        const note = text.replace("/note ", "").trim();
        await kv.set(KV.note(userId), note);

        await sendMessage(
          chat.id,
          "📝 Note saved.",
          { message_thread_id: msg.message_thread_id }
        );
        return;
      }

      // ---------- /export ----------
      if (text.startsWith("/export")) {
        const map = await kv.get(KV.user(userId));
        await sendMessage(
          chat.id,
`📦 *EXPORT*
🆔 ${userId}
🧵 Topic ID: ${map.topic_id}
📅 Created: ${new Date(map.created_at).toLocaleString()}`,
          { message_thread_id: msg.message_thread_id }
        );
        return;
      }

      // ---------- reply templates ----------
      if (text.startsWith("/r ")) {
        const key = text.replace("/r ", "").trim();
        if (TEMPLATES[key]) {
          await sendMessage(userId, TEMPLATES[key]);
        }
        return;
      }

      // ---------- normal admin reply ----------
      if (text && !text.startsWith("/")) {
        await sendMessage(userId, text);

        // save last admin reply time
        await kv.set(`last_admin_msg:${userId}`, now());

        // auto-pin last admin reply
        await pinMessage(chat.id, msg.message_id);
        return;
      }
    }

    // ================= REMINDER & CLEANUP =================

    // reminder: user waiting > 5 min
    const userKeys = await kv.keys("last_user_msg:*");
    for (const key of userKeys) {
      const uid = Number(key.split(":")[1]);
      const lastUser = await kv.get(key);
      const lastAdmin = await kv.get(`last_admin_msg:${uid}`);

      if (
        lastUser &&
        (!lastAdmin || lastAdmin < lastUser) &&
        minutes(now() - lastUser) >= 5
      ) {
        const map = await kv.get(KV.user(uid));
        if (map?.topic_id) {
          await sendMessage(
            process.env.LOG_GROUP_ID,
            "⏰ User waiting for reply",
            { message_thread_id: map.topic_id }
          );
        }
        await kv.set(`last_admin_msg:${uid}`, now());
      }
    }

    // cleanup: CLOSED tickets older than 7 days
    const userList = await kv.keys("user:*");
    for (const u of userList) {
      const data = await kv.get(u);
      if (
        data?.status === STATUS.CLOSED &&
        now() - data.created_at > 7 * 24 * 60 * 60 * 1000
      ) {
        await kv.delete(u);
      }
    }

  } catch (err) {
    console.error("HANDLE UPDATE ERROR:", err);
  }
}
