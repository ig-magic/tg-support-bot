import { handleUpdate } from "../lib/handlers.js";

export default async function handler(req, res) {
  try {
    await handleUpdate(req.body);
    res.status(200).send("OK");
  } catch (e) {
    console.error("WEBHOOK ERROR:", e);
    res.status(200).send("OK");
  }
}
