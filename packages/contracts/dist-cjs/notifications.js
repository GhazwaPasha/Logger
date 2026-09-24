"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLedgerEntryNotifiableToUser = isLedgerEntryNotifiableToUser;
exports.notificationRecipients = notificationRecipients;
const idsOf = (raw) => Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
/** Legacy statuses fold into the current ones (`open` / `assigned` → pending, `late` → in progress). */
function stage(raw) {
    if (raw === "open" || raw === "assigned")
        return "pending";
    if (raw === "late")
        return "in_progress";
    return typeof raw === "string" ? raw : "";
}
function isLedgerEntryNotifiableToUser(entry, userId, { assigneeUserIds, assignerId }) {
    if (entry.actorId === userId)
        return false;
    const isAssigner = !!assignerId && assignerId === userId;
    const isAssignee = assigneeUserIds.includes(userId);
    const p = (entry.payload ?? {});
    switch (entry.type) {
        case "assignee_change": {
            const before = idsOf(p.previousAssigneeUserIds);
            const after = idsOf(p.assigneeUserIds);
            const added = after.includes(userId) && !before.includes(userId);
            const removed = before.includes(userId) && !after.includes(userId);
            return added || removed || isAssigner;
        }
        case "status_change": {
            const from = stage(p.oldStatus);
            const to = stage(p.newStatus);
            if (from === to)
                return false;
            const closedOrReopened = to === "done" || to === "cancelled" || from === "done" || from === "cancelled";
            if (closedOrReopened)
                return isAssignee || isAssigner;
            return to === "in_progress" && isAssigner;
        }
        case "reschedule":
        case "comment_added":
            return isAssignee || isAssigner;
        case "priority_change":
            return p.newPriority === "high" && isAssignee;
        case "archive":
            return isAssignee;
        case "ack":
            return isAssigner;
        default:
            return false;
    }
}
/** The user ids an entry notifies, from a candidate list (e.g. for push fan-out). */
function notificationRecipients(entry, candidates, audience) {
    return [...new Set(candidates)].filter((id) => isLedgerEntryNotifiableToUser(entry, id, audience));
}
