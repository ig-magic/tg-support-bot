import { kv } from "@vercel/kv";
import {
  sendMessage,
  copyMessage,
  createTopic,
  pinMessage,
  getUserProfilePhotos,
  tg
} from "./telegram.js";
import { isAdmin, welcomeText, AUTO_REPLY } from "./utils.js";

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

      // ---- /start ----
      if (msg.text === "/start") {
        await sendMessage(from.id, welcomeText(from));
        return;
      }

      // ---- check KV mapping ----
      let userMap = await kv.get(`user:${from.id}`);

      // ---- create topic if new user ----
      if (!userMap) {
        const topic = await createTopic(String(from.id));

        if (
          !topic?.ok ||
          typeof topic.result?.message_thread_id !== "number"
        ) {
          await sendMessage(from.id, "⚠️ Temporary error. Try again later.");
          return;
        }

        const topicId = topic.result.message_thread_id;

        // build topic link
        const groupId = String(process.env.LOG_GROUP_ID);
        const internalId = groupId.startsWith("-100")
          ? groupId.slice(4)
          : groupId;

        const topicLink = `https://t.me/c/${internalId}/${topicId}`;

        // user profile link
        const userLink = from.username
          ? `https://t.me/${from.username}`
          : `tg://user?id=${from.id}`;

        const fullName =
          `${from.first_name || ""} ${from.last_name || ""}`.trim();

        // ---- PIN: rich user info ----
        const infoText = `👤 *USER INFORMATION*

🆔 *User ID:* \`${from.id}\`
👤 *Name:* ${fullName || "Not set"}
🔗 *Username:* ${from.username ? "@" + from.username : "Not set"}
🔗 *User Link:* [Open Profile](${userLink})
🔗 *Topic Link:* [Open Topic](${topicLink})

🕒 *First Contact:* ${new Date().toLocaleString()}
🛡️ *Status:* Active`;

        const infoMsg = await sendMessage(
          process.env.LOG_GROUP_ID,
          infoText,
          { message_thread_id: topicId }
        );

        if (infoMsg?.ok) {
          await pinMessage(
            process.env.LOG_GROUP_ID,
            infoMsg.result.message_id
          );
        }

        // ---- send profile photo (DP) if available ----
        const photos = await getUserProfilePhotos(from.id, 1);
        if (photos?.ok && photos.result?.total_count > 0) {
          const fileId = photos.result.photos[0][0].file_id;
          await tg("sendPhoto", {
            chat_id: process.env.LOG_GROUP_ID,
            photo: fileId,
            caption: "🖼️ User Profile Photo",
            message_thread_id: topicId
          });
        }

        // ---- save KV mappings ----
        await kv.set(`user:${from.id}`, {
          topic_id: topicId,
          group_id: process.env.LOG_GROUP_ID,
          topic_link: topicLink,
          created_at: Date.now()
        });
        await kv.set(`topic:${topicId}`, from.id);

        userMap = { topic_id: topicId };
      }

      // ---- forward ANY message (text/media/etc.) ----
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
