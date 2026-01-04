export const ADMINS = process.env.ADMIN_IDS.split(",").map(Number);

export const STATUS = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  BANNED: "BANNED"
};

export function isAdmin(id) {
  return ADMINS.includes(id);
}

export function buildTopicName(user, status = STATUS.OPEN) {
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  const base = name ? `${user.id} | ${name}` : String(user.id);
  return `[${status}] ${base}`.slice(0, 120);
}

export const AUTO_REPLY =
  "✅ Message received.\nOur admin will reply soon 😊";
