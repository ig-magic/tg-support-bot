import { tg } from "../lib/telegram.js";

export default async function handler(req, res) {
  const r = await tg("setWebhook", { url: "" });
  res.json(r);
}
