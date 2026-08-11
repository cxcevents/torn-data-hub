import { pgTable, serial, integer, text, timestamp, primaryKey, boolean } from "drizzle-orm/pg-core";

// Community guides — submitted by players, approved by the admin before going public.
export const guidesTable = pgTable("guides", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"), // optional — list pages fall back to a body excerpt
  body: text("body").notNull(), // markdown-ish plain text
  category: text("category").notNull(), // getting-started | leveling | faction | money | drugs-boosters | combat | misc
  audience: text("audience").notNull(), // new | established | all
  authorId: integer("author_id").notNull(),
  authorName: text("author_name").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

// Reddit-style thumbs: value is +1 or -1, one vote per player per guide.
export const guideVotesTable = pgTable(
  "guide_votes",
  {
    guideId: integer("guide_id").notNull(),
    playerId: integer("player_id").notNull(),
    value: integer("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guideId, t.playerId] })],
);

// Comments post instantly; admin can soft-delete.
export const guideCommentsTable = pgTable("guide_comments", {
  id: serial("id").primaryKey(),
  guideId: integer("guide_id").notNull(),
  playerId: integer("player_id").notNull(),
  playerName: text("player_name").notNull(),
  body: text("body").notNull(),
  deleted: boolean("deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuideRow = typeof guidesTable.$inferSelect;
export type GuideCommentRow = typeof guideCommentsTable.$inferSelect;
