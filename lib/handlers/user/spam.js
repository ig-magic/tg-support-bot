import { kv } from "@vercel/kv";
import { sendMessage } from "../../telegram.js";

const WINDOW = 20_000;
const WARN = 5;
const BLOCK = 10;

export async function handleSpam(msg) {
  const key = `spam_msgs:${msg.from.id}`;
  let arr = (await kv.get(key)) || [];
  const now = Date.now();

  arr = arr.filter(t => now - t < WINDOW);
  arr.push(now);
  await kv.set(key, arr, { ex: 30 });

  if (arr.length === WARN) {
    await sendMessage(
      msg.from.id,
      "⚠️ Please don’t spam.\nEk hi message me apne doubts likhein 🙂"
    );
  }

  if (arr.length >= BLOCK) {
    await kv.set(`spam_blocked:${msg.from.id}`, true, { ex: 600 });
  }

  return false; // forwarding allowed
}
