import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

export const visitorHistoryTable = pgTable("visitor_history", {
  playerId: integer("player_id").primaryKey(),
  name: text("name").notNull(),
  level: integer("level"),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
  visitCount: integer("visit_count").notNull().default(1),
});

export type VisitorHistory = typeof visitorHistoryTable.$inferSelect;
