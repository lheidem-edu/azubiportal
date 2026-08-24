import {
  boolean,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * ADMIN     – volle Verwaltung inklusive Rollen und Systemeinstellungen
 * PLANNER   – verantwortlich für den Vertretungsplan (in der Regel selbst Azubi)
 * APPRENTICE– Auszubildende:r, wird in die Vertretung eingeplant
 * DESK      – feste Besetzung der Zentrale, pflegt nur eigene Abwesenheiten
 */
export const roleEnum = pgEnum("role", ["ADMIN", "PLANNER", "APPRENTICE", "DESK"]);

/** Wie ein Abwesenheitsgrund heißt. Frei erweiterbar über die Verwaltung. */
export const absenceTypeEnum = pgEnum("absence_type", [
  "VACATION", // Urlaub
  "SICK", // Krank
  "SCHOOL_BLOCK", // Blockunterricht / zusätzliche Schultage
  "TRAINING", // Lehrgang, Prüfung
  "OTHER",
]);

export const absenceStatusEnum = pgEnum("absence_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

/** Ganztags oder nur halber Tag. */
export const dayPartEnum = pgEnum("day_part", ["FULL", "MORNING", "AFTERNOON"]);

/** Pausenvertretung vs. ganztägige Vertretung. */
export const slotKindEnum = pgEnum("slot_kind", ["BREAK", "FULL_DAY"]);

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "PLANNED",
  "CONFIRMED",
  "CANCELLED",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "EMAIL",
  "TEAMS",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "PENDING",
  "SENT",
  "FAILED",
  "SKIPPED",
]);

export const holidaySourceEnum = pgEnum("holiday_source", ["AUTO", "MANUAL"]);

/* -------------------------------------------------------------------------- */
/* Benutzer                                                                   */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    name: text().notNull(),
    /** Objekt-ID aus Microsoft Entra ID (oid claim). */
    entraOid: text(),
    role: roleEnum().notNull().default("APPRENTICE"),
    isActive: boolean().notNull().default(true),
    image: text(),
    lastLoginAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("users_email_unique").on(t.email), index("users_entra_oid_idx").on(t.entraOid)],
);

/* -------------------------------------------------------------------------- */
/* Auszubildende                                                              */
/* -------------------------------------------------------------------------- */

export const apprentices = pgTable(
  "apprentices",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().references(() => users.id, { onDelete: "cascade" }),
    displayName: text().notNull(),
    shortName: text(),
    email: text().notNull(),
    /** Beginn der Ausbildung – vorher wird nicht eingeplant. */
    startDate: date().notNull(),
    /** Ende der Ausbildung – danach wird nicht mehr eingeplant. */
    endDate: date(),
    department: text(),
    /** Nimmt an der Vertretungsplanung teil. */
    isPlannable: boolean().notNull().default(true),
    /**
     * Gewicht für den Lastenausgleich. 1.0 = normal. 0.5 = wird halb so oft
     * eingeplant (z.B. Teilzeit), 2.0 = doppelt so oft.
     */
    loadFactor: numeric({ precision: 4, scale: 2 }).notNull().default("1.00"),
    /** Startguthaben, damit später eingestellte Azubis nicht sofort dauerhaft dran sind. */
    loadOffset: numeric({ precision: 8, scale: 2 }).notNull().default("0.00"),
    notifyEmail: boolean().notNull().default(true),
    notifyTeams: boolean().notNull().default(false),
    /** Persönlicher Teams-Webhook (überschreibt den globalen Kanal-Webhook). */
    teamsWebhookUrl: text(),
    /** Token für den persönlichen ICS-Kalenderfeed. */
    icsToken: text().notNull(),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("apprentices_ics_token_unique").on(t.icsToken),
    unique("apprentices_user_unique").on(t.userId),
    index("apprentices_email_idx").on(t.email),
  ],
);

/* -------------------------------------------------------------------------- */
/* Schultage (wiederkehrend, je Azubi unterschiedlich)                        */
/* -------------------------------------------------------------------------- */

export const schoolTerms = pgTable(
  "school_terms",
  {
    id: uuid().primaryKey().defaultRandom(),
    apprenticeId: uuid()
      .notNull()
      .references(() => apprentices.id, { onDelete: "cascade" }),
    /** ISO-Wochentag: 1 = Montag … 5 = Freitag. */
    weekday: smallint().notNull(),
    validFrom: date().notNull(),
    validTo: date(),
    /** Nur jede zweite Woche (z.B. 14-tägiger Berufsschultag). */
    intervalWeeks: smallint().notNull().default(1),
    /** ISO-Kalenderwoche, in der der Rhythmus startet (nur bei intervalWeeks > 1). */
    anchorWeek: date(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("school_terms_apprentice_idx").on(t.apprenticeId)],
);

/* -------------------------------------------------------------------------- */
/* Abwesenheiten (Urlaub, Krank, Blockschule …)                               */
/* -------------------------------------------------------------------------- */

/**
 * Eine Tabelle für alle Abwesenheiten – von Auszubildenden wie von der festen
 * Zentrale-Besetzung. Genau eines der beiden Personenfelder ist gesetzt; die
 * Prüfbedingung stellt das auf Datenbankebene sicher.
 *
 * Die Wirkung unterscheidet sich je nach Person: Fehlt ein Azubi, steht er für
 * die Vertretung nicht zur Verfügung. Fehlt jemand aus der Festbesetzung,
 * entsteht dadurch überhaupt erst der Bedarf an ganztägiger Vertretung.
 */
export const absences = pgTable(
  "absences",
  {
    id: uuid().primaryKey().defaultRandom(),
    apprenticeId: uuid().references(() => apprentices.id, { onDelete: "cascade" }),
    deskStaffId: uuid().references(() => deskStaff.id, { onDelete: "cascade" }),
    type: absenceTypeEnum().notNull(),
    dayPart: dayPartEnum().notNull().default("FULL"),
    startDate: date().notNull(),
    endDate: date().notNull(),
    status: absenceStatusEnum().notNull().default("PENDING"),
    reason: text(),
    requestedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    decidedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp({ withTimezone: true }),
    decisionNote: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("absences_apprentice_idx").on(t.apprenticeId),
    index("absences_desk_staff_idx").on(t.deskStaffId),
    index("absences_range_idx").on(t.startDate, t.endDate),
    check(
      "absences_subject_check",
      sql`(${t.apprenticeId} is not null) <> (${t.deskStaffId} is not null)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Zentrale: Festbesetzung                                                    */
/* -------------------------------------------------------------------------- */

export const deskStaff = pgTable(
  "desk_staff",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Verknüpftes Benutzerkonto – damit sich die Person selbst anmelden kann. */
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    name: text().notNull(),
    email: text(),
    isActive: boolean().notNull().default(true),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("desk_staff_user_unique").on(t.userId), index("desk_staff_email_idx").on(t.email)],
);

/** Wer sitzt an welchem Wochentag regulär in der Zentrale. */
export const deskShifts = pgTable(
  "desk_shifts",
  {
    id: uuid().primaryKey().defaultRandom(),
    staffId: uuid()
      .notNull()
      .references(() => deskStaff.id, { onDelete: "cascade" }),
    weekday: smallint().notNull(),
    validFrom: date().notNull(),
    validTo: date(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("desk_shifts_staff_idx").on(t.staffId)],
);

/* -------------------------------------------------------------------------- */
/* Vertretungs-Slots (Pausenzeiten / Ganztagsvertretung)                      */
/* -------------------------------------------------------------------------- */

export const coverageSlots = pgTable(
  "coverage_slots",
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull(),
    label: text().notNull(),
    kind: slotKindEnum().notNull().default("BREAK"),
    startTime: time().notNull(),
    endTime: time().notNull(),
    /** An welchen ISO-Wochentagen der Slot gilt, z.B. [1,2,3,4,5]. */
    weekdays: smallint().array().notNull().default([1, 2, 3, 4, 5]),
    /** Gewicht für den Lastenausgleich (Ganztag zählt mehr als eine Pause). */
    weight: numeric({ precision: 4, scale: 2 }).notNull().default("1.00"),
    /** Wie viele Ersatzleute zusätzlich zur Vertretung geplant werden. */
    backupCount: smallint().notNull().default(2),
    isActive: boolean().notNull().default(true),
    sortOrder: smallint().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("coverage_slots_key_unique").on(t.key)],
);

/* -------------------------------------------------------------------------- */
/* Kalender: Feiertage & Betriebsferien                                       */
/* -------------------------------------------------------------------------- */

export const publicHolidays = pgTable(
  "public_holidays",
  {
    id: uuid().primaryKey().defaultRandom(),
    date: date().notNull(),
    name: text().notNull(),
    region: text().notNull().default("NRW"),
    isActive: boolean().notNull().default(true),
    source: holidaySourceEnum().notNull().default("AUTO"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("public_holidays_date_region_unique").on(t.date, t.region)],
);

export const companyClosures = pgTable(
  "company_closures",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    startDate: date().notNull(),
    endDate: date().notNull(),
    /** false = Betrieb läuft, aber z.B. reduziert – es wird trotzdem geplant. */
    blocksPlanning: boolean().notNull().default(true),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("company_closures_range_idx").on(t.startDate, t.endDate)],
);

/* -------------------------------------------------------------------------- */
/* Planung                                                                    */
/* -------------------------------------------------------------------------- */

export const planRuns = pgTable("plan_runs", {
  id: uuid().primaryKey().defaultRandom(),
  rangeStart: date().notNull(),
  rangeEnd: date().notNull(),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  stats: jsonb().$type<Record<string, unknown>>(),
  issues: jsonb().$type<string[]>(),
});

export const assignments = pgTable(
  "assignments",
  {
    id: uuid().primaryKey().defaultRandom(),
    date: date().notNull(),
    slotId: uuid()
      .notNull()
      .references(() => coverageSlots.id, { onDelete: "cascade" }),
    /** 1 = Vertretung, 2 = 1. Ersatz, 3 = 2. Ersatz … */
    rank: smallint().notNull(),
    apprenticeId: uuid()
      .notNull()
      .references(() => apprentices.id, { onDelete: "cascade" }),
    status: assignmentStatusEnum().notNull().default("PLANNED"),
    /** Manuell gesetzt bzw. gesperrt – wird von der Automatik nicht überschrieben. */
    isLocked: boolean().notNull().default(false),
    isManual: boolean().notNull().default(false),
    note: text(),
    planRunId: uuid().references(() => planRuns.id, { onDelete: "set null" }),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("assignments_slot_rank_unique").on(t.date, t.slotId, t.rank),
    unique("assignments_slot_person_unique").on(t.date, t.slotId, t.apprenticeId),
    index("assignments_date_idx").on(t.date),
    index("assignments_apprentice_idx").on(t.apprenticeId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Benachrichtigungen                                                         */
/* -------------------------------------------------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    apprenticeId: uuid().references(() => apprentices.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum().notNull(),
    target: text().notNull(),
    subject: text(),
    body: text(),
    status: notificationStatusEnum().notNull().default("PENDING"),
    error: text(),
    /** Verhindert Doppelversand, z.B. "reminder:2026-08-24:<apprenticeId>". */
    dedupeKey: text().notNull(),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("notifications_dedupe_unique").on(t.dedupeKey, t.channel)],
);

/* -------------------------------------------------------------------------- */
/* Einstellungen & Protokoll                                                  */
/* -------------------------------------------------------------------------- */

export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    actorName: text(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    payload: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ one }) => ({
  apprentice: one(apprentices, {
    fields: [users.id],
    references: [apprentices.userId],
  }),
  deskStaff: one(deskStaff, {
    fields: [users.id],
    references: [deskStaff.userId],
  }),
}));

export const apprenticesRelations = relations(apprentices, ({ one, many }) => ({
  user: one(users, { fields: [apprentices.userId], references: [users.id] }),
  schoolTerms: many(schoolTerms),
  absences: many(absences),
  assignments: many(assignments),
}));

export const schoolTermsRelations = relations(schoolTerms, ({ one }) => ({
  apprentice: one(apprentices, {
    fields: [schoolTerms.apprenticeId],
    references: [apprentices.id],
  }),
}));

export const absencesRelations = relations(absences, ({ one }) => ({
  apprentice: one(apprentices, {
    fields: [absences.apprenticeId],
    references: [apprentices.id],
  }),
  deskStaff: one(deskStaff, {
    fields: [absences.deskStaffId],
    references: [deskStaff.id],
  }),
}));

export const deskStaffRelations = relations(deskStaff, ({ one, many }) => ({
  user: one(users, { fields: [deskStaff.userId], references: [users.id] }),
  shifts: many(deskShifts),
  absences: many(absences),
}));

export const deskShiftsRelations = relations(deskShifts, ({ one }) => ({
  staff: one(deskStaff, { fields: [deskShifts.staffId], references: [deskStaff.id] }),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  slot: one(coverageSlots, {
    fields: [assignments.slotId],
    references: [coverageSlots.id],
  }),
  apprentice: one(apprentices, {
    fields: [assignments.apprenticeId],
    references: [apprentices.id],
  }),
}));

export const coverageSlotsRelations = relations(coverageSlots, ({ many }) => ({
  assignments: many(assignments),
}));

/* -------------------------------------------------------------------------- */
/* Typen                                                                      */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type Apprentice = typeof apprentices.$inferSelect;
export type SchoolTerm = typeof schoolTerms.$inferSelect;
export type Absence = typeof absences.$inferSelect;
export type DeskStaff = typeof deskStaff.$inferSelect;
export type DeskShift = typeof deskShifts.$inferSelect;
export type CoverageSlot = typeof coverageSlots.$inferSelect;
export type PublicHoliday = typeof publicHolidays.$inferSelect;
export type CompanyClosure = typeof companyClosures.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type PlanRun = typeof planRuns.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type AbsenceType = (typeof absenceTypeEnum.enumValues)[number];
export type AbsenceStatus = (typeof absenceStatusEnum.enumValues)[number];
export type DayPart = (typeof dayPartEnum.enumValues)[number];
export type SlotKind = (typeof slotKindEnum.enumValues)[number];
