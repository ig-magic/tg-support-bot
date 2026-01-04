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

// 🔥 NEW: Spam config
const SPAM_WINDOW = 20_000; // 20 sec
const SPAM_WARN_LIMIT = 5;
const SPAM_BLOCK_LIMIT = 10;
const SPAM_TTL = 600; // 10 min

async function trackSpam(userId) {
  const key = `spam_msgs:${userId}`;
  let arr = (await kv.get(key)) || [];
  const t = now();

  arr = arr.filter(ts => t - ts < SPAM_WINDOW);
  arr.push(t);

  await kv.set(key, arr, { ex: 30 });
  return arr.length;
}

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

      // ban check (hard ban)
      const ban = await kv.get(KV.ban(from.id));
      if (ban?.active && (!ban.until || now() < ban.until)) return;

      // 🔥 NEW: spam tracking
      const spamCount = await trackSpam(from.id);
      const warned = await kv.get(`spam_warned:${from.id}`);
      const softBlocked = await kv.get(`spam_blocked:${from.id}`);

      if (spamCount >= SPAM_WARN_LIMIT && !warned) {
        await sendMessage(
          from.id,
          "⚠️ Please don’t spam.\nEk hi message me apne saare doubts likhein 🙂"
        );
        await kv.set(`spam_warned:${from.id}`, true, { ex: SPAM_TTL });
      }

      if (spamCount >= SPAM_BLOCK_LIMIT && !softBlocked) {
        await kv.set(`spam_blocked:${from.id}`, true, { ex: SPAM_TTL });
        await sendMessage(
          from.id,
          "🚫 You are temporarily blocked due to spamming.\nAdmin will review your messages."
        );
      }

      if (msg.text === "/start") {
        await sendMessage(from.id, "👋 Welcome! Send your message.");
        return;
      }

      let userMap = await kv.get(KV.user(from.id));

      // create topic if new OR deleted
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
🕒 First Contact: ${new Date().toLocaleString()}`,
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
          created_at: now()
        });
        await kv.set(KV.topic(topicId), from.id);

        userMap = { topic_id: topicId, status: STATUS.OPEN };
      }

      // 🔥 NEW: safe forward with auto recreate
      try {
        await copyMessage(
          process.env.LOG_GROUP_ID,
          from.id,
          msg.message_id,
          { message_thread_id: userMap.topic_id }
        );
      } catch (e) {
        // topic deleted → recreate
        await kv.delete(KV.user(from.id));
        return handleUpdate(update);
      }

      await kv.set(`last_user_msg:${from.id}`, now());

      if (!AUTO_REPLY_SENT.has(from.id) && !softBlocked) {
        AUTO_REPLY_SENT.add(from.id);
        await sendMessage(from.id, AUTO_REPLY);
      }

      // 🔥 NEW: notify admin on soft block
      if (softBlocked) {
        await sendMessage(
          process.env.LOG_GROUP_ID,
          `🚨 AUTO-SPAM DETECTED\nUser: ${from.id}\nStatus: Soft-blocked`,
          { message_thread_id: userMap.topic_id }
        );
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

      // typing simulation
      if (text && !text.startsWith("/")) {
        await tg("sendChatAction", {
          chat_id: userId,
          action: "typing"
        });
      }

      // /note
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

      // /export
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

      // reply templates
      if (text.startsWith("/r ")) {
        const key = text.replace("/r ", "").trim();
        if (TEMPLATES[key]) {
          await sendMessage(userId, TEMPLATES[key]);
        }
        return;
      }

      // normal admin reply
      if (text && !text.startsWith("/")) {
        await sendMessage(userId, text);
        await kv.set(`last_admin_msg:${userId}`, now());
        await pinMessage(chat.id, msg.message_id);
        return;
      }
    }

    // ================= REMINDER & CLEANUP =================

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
