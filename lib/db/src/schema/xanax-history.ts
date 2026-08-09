import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

// Permanent archive of daily xanax counts (dates are TCT/UTC "YYYY-MM-DD").
// Synced from the Torn activity log so history survives past the API's window.
export const xanaxHistoryTable = pgTable(
  "xanax_history",
  {
    playerId: integer("player_id").notNull(),
    date: text("date").notNull(),
    count: integer("count").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.date] })],
);

export type XanaxHistoryRow = typeof xanaxHistoryTable.$inferSelect;
