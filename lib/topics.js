import { tg, createTopic, sendMessage, pinMessage } from "./telegram.js";

export async function getUserTopic(userId) {
  const res = await tg("getForumTopics", {
    chat_id: process.env.LOG_GROUP_ID,
    limit: 100
  });

  if (!res.ok) return null;

  for (const t of res.result.topics) {
    if (t.name.includes(String(userId))) return t.message_thread_id;
  }
  return null;
}

export async function ensureUserTopic(user) {
  const existing = await getUserTopic(user.id);
  if (existing) return existing;

  const title = `${user.first_name || "User"} | ${user.id}`;
  const topic = await createTopic(title);
  const topicId = topic.result.message_thread_id;

  const pinned = await sendMessage(
    process.env.LOG_GROUP_ID,
`🆔 User ID: ${user.id}
👤 Name: ${user.first_name || ""} ${user.last_name || ""}
🔗 Username: ${user.username ? "@" + user.username : "Not set"}`,
    { message_thread_id: topicId }
  );

  await pinMessage(process.env.LOG_GROUP_ID, pinned.result.message_id);
  return topicId;
}
