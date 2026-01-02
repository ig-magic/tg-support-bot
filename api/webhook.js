import { handleUpdate } from "../lib/handlers.js";

export default async function handler(req, res) {
  if (req.headers["x-telegram-bot-api-secret-token"] !== process.env.BOT_SECRET) {
    return res.status(403).send("Forbidden");
  }

  await handleUpdate(req.body);
  res.send("OK");
}
