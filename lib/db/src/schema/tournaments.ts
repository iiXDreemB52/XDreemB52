import { pgTable, text, serial, timestamp, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tournamentStateTable = pgTable("tournament_state", {
  id: serial("id").primaryKey(),
  phase: text("phase", { enum: ["setup", "tournament"] }).notNull().default("setup"),
  size: integer("size").notNull().default(16),
  players: jsonb("players").notNull().default([]),
  rounds: jsonb("rounds").notNull().default([]),
  cur: integer("cur").notNull().default(0),
  bSize: integer("b_size").notNull().default(16),
  byeN: integer("bye_n").notNull().default(0),
  isTeams: boolean("is_teams").notNull().default(false),
  teamSize: integer("team_size").notNull().default(2),
  name: text("name").default(""),
  gameType: text("game_type").default(""),
  champion: text("champion").default(""),
  scheduledAt: text("scheduled_at").default(""),
  lastWinner: text("last_winner").default(""),
  lastGameType: text("last_game_type").default(""),
  lastTournamentName: text("last_tournament_name").default(""),
  entryLog: jsonb("entry_log").notNull().default([]),
  winnerHistory: jsonb("winner_history").notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const winnersTable = pgTable("winners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gameType: text("game_type").notNull(),
  tournamentName: text("tournament_name").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTournamentStateSchema = createInsertSchema(tournamentStateTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTournamentState = z.infer<typeof insertTournamentStateSchema>;
export type TournamentState = typeof tournamentStateTable.$inferSelect;

export const insertWinnerSchema = createInsertSchema(winnersTable).omit({ id: true, createdAt: true });
export type InsertWinner = z.infer<typeof insertWinnerSchema>;
export type Winner = typeof winnersTable.$inferSelect;

export const tournamentRecordsTable = pgTable("tournament_records", {
  id: serial("id").primaryKey(),
  tournamentName: text("tournament_name").notNull().default(""),
  displayName: text("display_name").notNull().default(""), // اسم اللعبة المعروض (يعدّله الأدمن)
  winnerName: text("winner_name").notNull().default(""),
  image: text("image").notNull().default(""), // صورة البطولة كـ Base64 data URL
  image2: text("image2").notNull().default(""), // صورة إضافية ثانية (ميزة الصورتين)
  isHidden: boolean("is_hidden").notNull().default(false), // يخفيه الأدمن من الصفحة العامة بدون حذفه
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTournamentRecordSchema = createInsertSchema(tournamentRecordsTable).omit({ id: true, createdAt: true });
export type InsertTournamentRecord = z.infer<typeof insertTournamentRecordSchema>;
export type TournamentRecord = typeof tournamentRecordsTable.$inferSelect;

export const tournamentArchivesTable = pgTable("tournament_archives", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gameType: text("game_type").notNull(),
  champion: text("champion").notNull(),
  isTeams: boolean("is_teams").notNull().default(false),
  teamSize: integer("team_size").notNull().default(2),
  players: jsonb("players").notNull().default([]),
  rounds: jsonb("rounds").notNull().default([]),
  finishedAt: timestamp("finished_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTournamentArchiveSchema = createInsertSchema(tournamentArchivesTable).omit({ id: true, createdAt: true });
export type InsertTournamentArchive = z.infer<typeof insertTournamentArchiveSchema>;
export type TournamentArchive = typeof tournamentArchivesTable.$inferSelect;

// حسابات "مساعد أدمن" — الأدمن الرئيسي ينشئها ويحدد صلاحياتها بنفسه.
export const adminHelpersTable = pgTable("admin_helpers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // اسم يعرفه الأدمن الرئيسي فقط (لتمييز المساعدين عن بعض)
  code: text("code").notNull().unique(), // كود الدخول اللي يستخدمه المساعد بدل كلمة مرور الأدمن
  permissions: jsonb("permissions").notNull().default({}), // { tournament: boolean, records: boolean }
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAdminHelperSchema = createInsertSchema(adminHelpersTable).omit({ id: true, createdAt: true });
export type InsertAdminHelper = z.infer<typeof insertAdminHelperSchema>;
export type AdminHelper = typeof adminHelpersTable.$inferSelect;