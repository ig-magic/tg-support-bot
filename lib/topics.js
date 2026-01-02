import { tg, createTopic, sendMessage, pinMessage } from "./telegram.js";

/**
 * In-memory cache (per Vercel instance)
 * userId -> topicId
 */
const USER_TOPIC_CACHE = new Map();

/**
 * Scan topics and find topic by pinned USER_ID
 */
export async function findTopicByPinnedUser(userId) {
  const res = await tg("getForumTopics", {
    chat_id: process.env.LOG_GROUP_ID,
    limit: 100
  });

  if (!res.ok || !res.result?.topics) return null;

  for (const topic of res.result.topics) {
    if (!topic.message_thread_id) continue;

    const chat = await tg("getChat", {
      chat_id: process.env.LOG_GROUP_ID,
      message_thread_id: topic.message_thread_id
    });

    const pinned = chat?.result?.pinned_message?.text;
    if (!pinned) continue;

    if (pinned.includes(`USER_ID: ${userId}`)) {
      USER_TOPIC_CACHE.set(userId, topic.message_thread_id);
      return topic.message_thread_id;
    }
  }
  return null;
}

/**
 * Ensure topic exists (reuse if already created)
 * Topic is ONLY created on /start
 */
export async function ensureUserTopic(user) {
  const userId = user.id;

  // 1️⃣ Cache hit
  if (USER_TOPIC_CACHE.has(userId)) {
    return USER_TOPIC_CACHE.get(userId);
  }

  // 2️⃣ Find by pinned message
  const existing = await findTopicByPinnedUser(userId);
  if (existing) {
    return existing;
  }

  // 3️⃣ Create new topic (FIRST TIME ONLY)
  const title = `${user.first_name || "User"} | ${userId}`;
  const topic = await createTopic(title);
  const topicId = topic.result.message_thread_id;

  // 4️⃣ Send + pin USER_ID message
  const pinnedMsg = await sendMessage(
    process.env.LOG_GROUP_ID,
`🆔 USER_ID: ${userId}
👤 Name: ${user.first_name || ""} ${user.last_name || ""}
🔗 Username: ${user.username ? "@" + user.username : "Not set"}`,
    { message_thread_id: topicId }
  );

  await pinMessage(process.env.LOG_GROUP_ID, pinnedMsg.result.message_id);

  USER_TOPIC_CACHE.set(userId, topicId);
  return topicId;
}
