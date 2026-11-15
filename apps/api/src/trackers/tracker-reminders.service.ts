import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { getZonedParts, isoWeekday, trackerSlotKey } from "@work-ledger/contracts";
import { organizations, trackerEntries, trackers } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { PushNotificationsService } from "../push/push-notifications.service";

/** Reminders fire from the set time until this many minutes after it — a restart never sends a midnight nudge. */
const WINDOW_MINUTES = 180;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Nudges a tracker's assignee when today's (or this week's) log isn't in by the tracker's reminder time
 * (workspace-local). Daily trackers remind on each working day; weekly ones on the last working day
 * of the week. Each tracker is reminded at most once per day.
 */
@Injectable()
export class TrackerRemindersService {
  private readonly log = new Logger(TrackerRemindersService.name);
  private running = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly push: PushNotificationsService,
  ) {}

  @Cron("0 */5 * * * *")
  async tick() {
    if (this.running || !this.push.isConfigured()) return;
    this.running = true;
    try {
      await this.run(new Date());
    } catch (e) {
      this.log.warn(`Tracker reminders failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.running = false;
    }
  }

  async run(now: Date) {
    const rows = await this.db
      .select({
        id: trackers.id,
        name: trackers.name,
        assigneeId: trackers.assigneeId,
        periodStart: trackers.periodStart,
        periodEnd: trackers.periodEnd,
        checkIn: trackers.checkIn,
        workingDays: trackers.workingDays,
        reminderTime: trackers.reminderTime,
        lastRemindedOn: trackers.lastRemindedOn,
        timeZone: organizations.timeZone,
        slug: organizations.slug,
      })
      .from(trackers)
      .innerJoin(organizations, eq(organizations.id, trackers.organizationId))
      .where(and(isNotNull(trackers.reminderTime), isNull(trackers.archivedAt)));

    for (const t of rows) {
      const p = getZonedParts(now, t.timeZone);
      const today = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
      if (today < t.periodStart || today > t.periodEnd || t.lastRemindedOn === today) continue;

      const [h, m] = (t.reminderTime ?? "").split(":").map(Number) as [number, number];
      const minutesPast = p.hour * 60 + p.minute - (h * 60 + m);
      if (!(minutesPast >= 0 && minutesPast < WINDOW_MINUTES)) continue;

      const weekly = t.checkIn === "weekly";
      const wd = isoWeekday(today);
      const remindDay = weekly ? Math.max(...t.workingDays) : null;
      if (weekly ? wd !== remindDay : !t.workingDays.includes(wd)) continue;

      const slot = trackerSlotKey(weekly ? "weekly" : "daily", today);
      const [logged] = await this.db
        .select({ id: trackerEntries.id })
        .from(trackerEntries)
        .where(and(eq(trackerEntries.trackerId, t.id), eq(trackerEntries.entryDate, slot)))
        .limit(1);
      if (logged) continue;

      // Claim today's reminder first, so two API instances never both send it.
      const claimed = await this.db
        .update(trackers)
        .set({ lastRemindedOn: today })
        .where(and(eq(trackers.id, t.id), or(isNull(trackers.lastRemindedOn), ne(trackers.lastRemindedOn, today))))
        .returning({ id: trackers.id });
      if (claimed.length === 0) continue;

      await this.push.notifyUsers([t.assigneeId], {
        title: t.name,
        body: weekly ? "This week's numbers aren't logged yet." : "Today's numbers aren't logged yet.",
        url: `/${t.slug}/trackers?t=${encodeURIComponent(t.id)}`,
        data: { trackerId: t.id },
      });
    }
  }
}
