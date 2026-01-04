import { kv } from "@vercel/kv";

export const KV = {
  user: id => `user:${id}`,
  topic: id => `topic:${id}`,
  ban: id => `ban:${id}`,
  note: id => `note:${id}`
};
