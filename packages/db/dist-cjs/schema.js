"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appSchema = exports.authSchema = exports.subtasksRelations = exports.pushSubscriptionsRelations = exports.activityLedgerRelations = exports.taskAssigneesRelations = exports.tasksRelations = exports.listsRelations = exports.departmentsRelations = exports.organizationMemberManagedDepartmentsRelations = exports.organizationMembersRelations = exports.organizationsRelations = exports.accountsRelations = exports.sessionsRelations = exports.usersRelations = exports.pushSubscriptions = exports.activityLedger = exports.ledgerTypeEnum = exports.taskAssignees = exports.subtasks = exports.tasks = exports.lists = exports.organizationMemberManagedDepartments = exports.organizationMembers = exports.departments = exports.organizations = exports.taskPriorityEnum = exports.taskStatusEnum = exports.orgRoleEnum = exports.jwks = exports.verification = exports.account = exports.session = exports.user = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
/** Better Auth — core user */
exports.user = (0, pg_core_1.pgTable)("user", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    emailVerified: (0, pg_core_1.boolean)("email_verified").notNull().default(false),
    image: (0, pg_core_1.text)("image"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});
exports.session = (0, pg_core_1.pgTable)("session", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true }).notNull(),
    token: (0, pg_core_1.text)("token").notNull().unique(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "cascade" }),
}, (t) => [(0, pg_core_1.index)("session_user_id_idx").on(t.userId)]);
exports.account = (0, pg_core_1.pgTable)("account", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    accountId: (0, pg_core_1.text)("account_id").notNull(),
    providerId: (0, pg_core_1.text)("provider_id").notNull(),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "cascade" }),
    accessToken: (0, pg_core_1.text)("access_token"),
    refreshToken: (0, pg_core_1.text)("refresh_token"),
    idToken: (0, pg_core_1.text)("id_token"),
    accessTokenExpiresAt: (0, pg_core_1.timestamp)("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: (0, pg_core_1.timestamp)("refresh_token_expires_at", { withTimezone: true }),
    scope: (0, pg_core_1.text)("scope"),
    password: (0, pg_core_1.text)("password"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [(0, pg_core_1.index)("account_user_id_idx").on(t.userId)]);
exports.verification = (0, pg_core_1.pgTable)("verification", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    identifier: (0, pg_core_1.text)("identifier").notNull(),
    value: (0, pg_core_1.text)("value").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});
/** Better Auth JWT plugin — JWKS storage */
exports.jwks = (0, pg_core_1.pgTable)("jwks", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    publicKey: (0, pg_core_1.text)("public_key").notNull(),
    privateKey: (0, pg_core_1.text)("private_key").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true }),
});
exports.orgRoleEnum = (0, pg_core_1.pgEnum)("org_role", ["owner", "manager", "member"]);
exports.taskStatusEnum = (0, pg_core_1.pgEnum)("task_status", [
    "open",
    "pending",
    "assigned",
    "in_progress",
    "done",
    "late",
    "cancelled",
]);
exports.taskPriorityEnum = (0, pg_core_1.pgEnum)("task_priority", ["high", "medium", "low"]);
exports.organizations = (0, pg_core_1.pgTable)("organizations", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    /** URL segment for web routes (`/<slug>/…`). Immutable after create. */
    slug: (0, pg_core_1.text)("slug").notNull().unique(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
});
exports.departments = (0, pg_core_1.pgTable)("departments", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)("organization_id")
        .notNull()
        .references(() => exports.organizations.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.text)("name").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [(0, pg_core_1.index)("departments_org_idx").on(t.organizationId)]);
exports.organizationMembers = (0, pg_core_1.pgTable)("organization_members", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)("organization_id")
        .notNull()
        .references(() => exports.organizations.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "cascade" }),
    role: (0, exports.orgRoleEnum)("role").notNull(),
    /**
     * Legacy column: first managed level when role is `manager`.
     * Canonical many-to-many is `organization_member_managed_departments`.
     */
    departmentId: (0, pg_core_1.uuid)("department_id").references(() => exports.departments.id, {
        onDelete: "set null",
    }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.uniqueIndex)("organization_members_org_user_idx").on(t.organizationId, t.userId),
    (0, pg_core_1.index)("organization_members_user_idx").on(t.userId),
]);
/** Levels a manager covers (role `manager`); empty for owner/member. */
exports.organizationMemberManagedDepartments = (0, pg_core_1.pgTable)("organization_member_managed_departments", {
    organizationMemberId: (0, pg_core_1.uuid)("organization_member_id")
        .notNull()
        .references(() => exports.organizationMembers.id, { onDelete: "cascade" }),
    departmentId: (0, pg_core_1.uuid)("department_id")
        .notNull()
        .references(() => exports.departments.id, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.primaryKey)({ columns: [t.organizationMemberId, t.departmentId] }),
    (0, pg_core_1.index)("organization_member_managed_departments_dept_idx").on(t.departmentId),
]);
exports.lists = (0, pg_core_1.pgTable)("lists", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)("organization_id")
        .notNull()
        .references(() => exports.organizations.id, { onDelete: "cascade" }),
    departmentId: (0, pg_core_1.uuid)("department_id")
        .notNull()
        .references(() => exports.departments.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.text)("name").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [
    (0, pg_core_1.index)("lists_org_idx").on(t.organizationId),
    (0, pg_core_1.index)("lists_department_idx").on(t.departmentId),
]);
exports.tasks = (0, pg_core_1.pgTable)("tasks", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)("organization_id")
        .notNull()
        .references(() => exports.organizations.id, { onDelete: "cascade" }),
    listId: (0, pg_core_1.uuid)("list_id")
        .notNull()
        .references(() => exports.lists.id, { onDelete: "cascade" }),
    assignerId: (0, pg_core_1.text)("assigner_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "restrict" }),
    title: (0, pg_core_1.text)("title").notNull(),
    status: (0, exports.taskStatusEnum)("status").notNull().default("pending"),
    priority: (0, exports.taskPriorityEnum)("priority").notNull().default("medium"),
    dueAt: (0, pg_core_1.timestamp)("due_at", { withTimezone: true }),
    /** `daily` | `weekly` | `monthly` | `yearly`; null = none. */
    dueRepeat: (0, pg_core_1.text)("due_repeat"),
    /** Group id for recurring chain; set when the task has `due_repeat` (see migration backfill). */
    recurringSeriesId: (0, pg_core_1.uuid)("recurring_series_id"),
    /** If this row was created as the next cycle of a recurring task, parent task id. */
    spawnedFromTaskId: (0, pg_core_1.uuid)("spawned_from_task_id"),
    deletedAt: (0, pg_core_1.timestamp)("deleted_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [
    (0, pg_core_1.index)("tasks_org_idx").on(t.organizationId),
    (0, pg_core_1.index)("tasks_list_idx").on(t.listId),
    (0, pg_core_1.index)("tasks_assigner_idx").on(t.assignerId),
    (0, pg_core_1.index)("tasks_recurring_series_idx").on(t.recurringSeriesId),
    (0, pg_core_1.uniqueIndex)("tasks_spawned_from_parent_uidx")
        .on(t.spawnedFromTaskId)
        .where((0, drizzle_orm_1.sql) `${t.spawnedFromTaskId} is not null`),
]);
exports.subtasks = (0, pg_core_1.pgTable)("subtasks", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    taskId: (0, pg_core_1.uuid)("task_id")
        .notNull()
        .references(() => exports.tasks.id, { onDelete: "cascade" }),
    title: (0, pg_core_1.text)("title").notNull(),
    done: (0, pg_core_1.boolean)("done").notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [(0, pg_core_1.index)("subtasks_task_idx").on(t.taskId)]);
exports.taskAssignees = (0, pg_core_1.pgTable)("task_assignees", {
    taskId: (0, pg_core_1.uuid)("task_id")
        .notNull()
        .references(() => exports.tasks.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.uniqueIndex)("task_assignees_task_user_idx").on(t.taskId, t.userId),
    (0, pg_core_1.index)("task_assignees_user_idx").on(t.userId),
]);
exports.ledgerTypeEnum = (0, pg_core_1.pgEnum)("ledger_type", [
    "ack",
    "note",
    "reschedule",
    "status_change",
    "assignee_change",
    "archive",
]);
exports.activityLedger = (0, pg_core_1.pgTable)("activity_ledger", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    taskId: (0, pg_core_1.uuid)("task_id")
        .notNull()
        .references(() => exports.tasks.id, { onDelete: "cascade" }),
    actorId: (0, pg_core_1.text)("actor_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "restrict" }),
    type: (0, exports.ledgerTypeEnum)("type").notNull(),
    payload: (0, pg_core_1.jsonb)("payload").notNull().$type(),
    clientMutationId: (0, pg_core_1.text)("client_mutation_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [(0, pg_core_1.index)("activity_ledger_task_created_idx").on(t.taskId, t.createdAt)]);
/** Browser Web Push subscriptions (FCM/Apple/APNs via browser endpoint). */
exports.pushSubscriptions = (0, pg_core_1.pgTable)("push_subscriptions", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "cascade" }),
    endpoint: (0, pg_core_1.text)("endpoint").notNull(),
    p256dh: (0, pg_core_1.text)("p256dh").notNull(),
    auth: (0, pg_core_1.text)("auth").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.uniqueIndex)("push_subscriptions_endpoint_uidx").on(t.endpoint),
    (0, pg_core_1.index)("push_subscriptions_user_idx").on(t.userId),
]);
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.user, ({ many }) => ({
    sessions: many(exports.session),
    accounts: many(exports.account),
    pushSubscriptions: many(exports.pushSubscriptions),
}));
exports.sessionsRelations = (0, drizzle_orm_1.relations)(exports.session, ({ one }) => ({
    user: one(exports.user, { fields: [exports.session.userId], references: [exports.user.id] }),
}));
exports.accountsRelations = (0, drizzle_orm_1.relations)(exports.account, ({ one }) => ({
    user: one(exports.user, { fields: [exports.account.userId], references: [exports.user.id] }),
}));
exports.organizationsRelations = (0, drizzle_orm_1.relations)(exports.organizations, ({ many }) => ({
    members: many(exports.organizationMembers),
    departments: many(exports.departments),
    lists: many(exports.lists),
    tasks: many(exports.tasks),
}));
exports.organizationMembersRelations = (0, drizzle_orm_1.relations)(exports.organizationMembers, ({ one, many }) => ({
    organization: one(exports.organizations, {
        fields: [exports.organizationMembers.organizationId],
        references: [exports.organizations.id],
    }),
    user: one(exports.user, { fields: [exports.organizationMembers.userId], references: [exports.user.id] }),
    managedDepartments: many(exports.organizationMemberManagedDepartments),
}));
exports.organizationMemberManagedDepartmentsRelations = (0, drizzle_orm_1.relations)(exports.organizationMemberManagedDepartments, ({ one }) => ({
    member: one(exports.organizationMembers, {
        fields: [exports.organizationMemberManagedDepartments.organizationMemberId],
        references: [exports.organizationMembers.id],
    }),
    department: one(exports.departments, {
        fields: [exports.organizationMemberManagedDepartments.departmentId],
        references: [exports.departments.id],
    }),
}));
exports.departmentsRelations = (0, drizzle_orm_1.relations)(exports.departments, ({ one, many }) => ({
    organization: one(exports.organizations, {
        fields: [exports.departments.organizationId],
        references: [exports.organizations.id],
    }),
    lists: many(exports.lists),
}));
exports.listsRelations = (0, drizzle_orm_1.relations)(exports.lists, ({ one, many }) => ({
    organization: one(exports.organizations, {
        fields: [exports.lists.organizationId],
        references: [exports.organizations.id],
    }),
    department: one(exports.departments, {
        fields: [exports.lists.departmentId],
        references: [exports.departments.id],
    }),
    tasks: many(exports.tasks),
}));
exports.tasksRelations = (0, drizzle_orm_1.relations)(exports.tasks, ({ one, many }) => ({
    organization: one(exports.organizations, {
        fields: [exports.tasks.organizationId],
        references: [exports.organizations.id],
    }),
    list: one(exports.lists, {
        fields: [exports.tasks.listId],
        references: [exports.lists.id],
    }),
    assigner: one(exports.user, { fields: [exports.tasks.assignerId], references: [exports.user.id] }),
    assignees: many(exports.taskAssignees),
    subtasks: many(exports.subtasks),
    ledgerEntries: many(exports.activityLedger),
}));
exports.taskAssigneesRelations = (0, drizzle_orm_1.relations)(exports.taskAssignees, ({ one }) => ({
    task: one(exports.tasks, { fields: [exports.taskAssignees.taskId], references: [exports.tasks.id] }),
    user: one(exports.user, { fields: [exports.taskAssignees.userId], references: [exports.user.id] }),
}));
exports.activityLedgerRelations = (0, drizzle_orm_1.relations)(exports.activityLedger, ({ one }) => ({
    task: one(exports.tasks, { fields: [exports.activityLedger.taskId], references: [exports.tasks.id] }),
    actor: one(exports.user, { fields: [exports.activityLedger.actorId], references: [exports.user.id] }),
}));
exports.pushSubscriptionsRelations = (0, drizzle_orm_1.relations)(exports.pushSubscriptions, ({ one }) => ({
    user: one(exports.user, { fields: [exports.pushSubscriptions.userId], references: [exports.user.id] }),
}));
exports.subtasksRelations = (0, drizzle_orm_1.relations)(exports.subtasks, ({ one }) => ({
    task: one(exports.tasks, { fields: [exports.subtasks.taskId], references: [exports.tasks.id] }),
}));
exports.authSchema = {
    user: exports.user,
    session: exports.session,
    account: exports.account,
    verification: exports.verification,
    jwks: exports.jwks,
    usersRelations: exports.usersRelations,
    sessionsRelations: exports.sessionsRelations,
    accountsRelations: exports.accountsRelations,
};
exports.appSchema = {
    organizations: exports.organizations,
    organizationMembers: exports.organizationMembers,
    organizationMemberManagedDepartments: exports.organizationMemberManagedDepartments,
    departments: exports.departments,
    lists: exports.lists,
    tasks: exports.tasks,
    subtasks: exports.subtasks,
    taskAssignees: exports.taskAssignees,
    activityLedger: exports.activityLedger,
    pushSubscriptions: exports.pushSubscriptions,
    organizationsRelations: exports.organizationsRelations,
    organizationMembersRelations: exports.organizationMembersRelations,
    organizationMemberManagedDepartmentsRelations: exports.organizationMemberManagedDepartmentsRelations,
    departmentsRelations: exports.departmentsRelations,
    listsRelations: exports.listsRelations,
    tasksRelations: exports.tasksRelations,
    subtasksRelations: exports.subtasksRelations,
    taskAssigneesRelations: exports.taskAssigneesRelations,
    activityLedgerRelations: exports.activityLedgerRelations,
    pushSubscriptionsRelations: exports.pushSubscriptionsRelations,
};
