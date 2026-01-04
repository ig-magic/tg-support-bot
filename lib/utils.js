export const ADMINS = process.env.ADMIN_IDS
  .split(",")
  .map(Number);

export function isAdmin(id) {
  return ADMINS.includes(id);
}

export function welcomeText(user) {
  return `👋 Hello ${user.first_name || ""}

You can send your message here.
Our admin team will reply soon.`;
}

export const AUTO_REPLY = `✅ Message received.
Our admin will reply soon 😊`;
