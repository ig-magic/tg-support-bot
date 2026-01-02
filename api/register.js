import { tg } from "../lib/telegram.js";

export default async function handler(req, res) {
  const url = `${req.headers["x-forwarded-proto"]}://${req.headers.host}/api/webhook`;
  const r = await tg("setWebhook", {
    url,
    secret_token: process.env.BOT_SECRET
  });
  res.json(r);
}
