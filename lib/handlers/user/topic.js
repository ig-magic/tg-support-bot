import { kv } from "@vercel/kv";
import { createTopic } from "../../telegram.js";
import { KV } from "../../kv.js";
import { STATUS, buildTopicName } from "../../utils.js";

export async function getOrCreateTopic(msg) {
  let map = await kv.get(KV.user(msg.from.id));
  if (map) return map.topic_id;

  const topic = await createTopic(
    buildTopicName(msg.from, STATUS.OPEN)
  );

  const topicId = topic.result.message_thread_id;

  await kv.set(KV.user(msg.from.id), {
    topic_id: topicId,
    status: STATUS.OPEN,
    created_at: Date.now()
  });

  await kv.set(KV.topic(topicId), msg.from.id);
  return topicId;
}
