export const ADMINS = process.env.ADMIN_IDS
  .split(",")
  .map(id => Number(id));

export function isAdmin(id) {
  return ADMINS.includes(id);
}

export function welcomeText(user) {
  const username = user.username ? `@${user.username}` : "Not set";
  return `👋 Hello ${user.first_name || ""} ${user.last_name || ""}

You can send your message here.
Our admin team will reply soon.

🆔 Username: ${username}`;
}

export const AUTO_REPLY = `✅ Message received.
Our admin will reply soon 😊

Feel free to send more messages.
All messages will reach our admin team.`;
