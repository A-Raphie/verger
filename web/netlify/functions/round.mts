import { ensureMailboxSeeded } from "../../lib/blobs";
import { processNextMessage } from "../../lib/verger";

// Scheduled unattended rounds: one inbox message per tick, Netlify cron.
// The bell holds anything that needs the trustee; a quiet round is the goal.
export default async () => {
  await ensureMailboxSeeded();
  const result = await processNextMessage();
  return Response.json({ ok: true, ...result });
};

export const config = {
  schedule: "*/10 * * * *",
};
