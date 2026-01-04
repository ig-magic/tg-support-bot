import { handleUserStart } from "./user/start.js";
import { checkUserBan } from "./user/banCheck.js";
import { handleSpam } from "./user/spam.js";
import { getOrCreateTopic } from "./user/topic.js";
import { forwardUserMessage } from "./user/message.js";

import { handleAdminReply } from "./admin/reply.js";
import { handleTyping } from "./admin/typing.js";
import { handleAdminCommands } from "./admin/index.js";

import { runReminder } from "./system/reminder.js";
import { runCleanup } from "./system/cleanup.js";

export async function handleUpdate(update) {
  if (!update?.message) return;

  const msg = update.message;

  // USER SIDE
  if (msg.chat.type === "private") {
    if (await checkUserBan(msg)) return;
    if (await handleSpam(msg)) return;
    if (await handleUserStart(msg)) return;

    const topic = await getOrCreateTopic(msg);
    await forwardUserMessage(msg, topic);
  }

  // ADMIN SIDE
  if (msg.message_thread_id) {
    await handleTyping(msg);
    if (await handleAdminCommands(msg)) return;
    await handleAdminReply(msg);
  }

  // SYSTEM TASKS (non-blocking)
  runReminder();
  runCleanup();
}
