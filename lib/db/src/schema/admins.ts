import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

// Players granted admin access to the dashboard. The primary admin
// (player 2032555) is always an admin regardless of this table.
export const admins = pgTable("admins", {
  playerId: integer("player_id").primaryKey(),
  name: text("name").notNull(),
  addedBy: integer("added_by").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export type Admin = typeof admins.$inferSelect;
