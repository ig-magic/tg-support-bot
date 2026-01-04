import { kv } from "@vercel/kv";
import { KV } from "../../kv.js";

export async function checkUserBan(msg) {
  const ban = await kv.get(KV.ban(msg.from.id));
  if (ban?.active && (!ban.until || Date.now() < ban.until)) {
    return true; // block user completely
  }
  return false;
}
