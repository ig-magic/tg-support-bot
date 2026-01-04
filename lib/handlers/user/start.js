import { sendMessage } from "../../telegram.js";

export async function handleUserStart(msg) {
  if (msg.text === "/start") {
    await sendMessage(msg.from.id, "👋 Welcome! Send your message.");
    return true;
  }
  return false;
}
