import { handleClose } from "./close.js";
import { handleReopen } from "./reopen.js";
import { handleBan } from "./ban.js";
import { handleStats } from "./stats.js";
import { handleSearch } from "./search.js";
import { handleNotes } from "./notes.js";
import { handleExport } from "./export.js";
import { handleTemplates } from "./templates.js";

export async function handleAdminCommands(msg) {
  return (
    await handleClose(msg) ||
    await handleReopen(msg) ||
    await handleBan(msg) ||
    await handleStats(msg) ||
    await handleSearch(msg) ||
    await handleNotes(msg) ||
    await handleExport(msg) ||
    await handleTemplates(msg)
  );
}
