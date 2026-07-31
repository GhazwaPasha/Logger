"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityLedgerRelations = exports.taskAssigneesRelations = exports.tasksRelations = exports.listsRelations = exports.departmentsRelations = exports.organizationMemberManagedDepartmentsRelations = exports.organizationMembersRelations = exports.organizationsRelations = exports.oauthConsentsRelations = exports.oauthAccessTokensRelations = exports.oauthApplicationsRelations = exports.accountsRelations = exports.sessionsRelations = exports.usersRelations = exports.pushSubscriptions = exports.timeEntries = exports.apiKeys = exports.discordIntegrations = exports.webhookDeliveries = exports.webhookEndpoints = exports.commentMentions = exports.comments = exports.taskAttachments = exports.attachmentBlobs = exports.milestoneTasks = exports.milestones = exports.goals = exports.taskDependencies = exports.activityLedger = exports.ledgerTypeEnum = exports.taskAssignees = exports.subtasks = exports.tasks = exports.lists = exports.organizationMemberManagedDepartments = exports.organizationMembers = exports.departments = exports.organizations = exports.taskPriorityEnum = exports.taskStatusEnum = exports.roadmapStatusEnum = exports.orgRoleEnum = exports.oauthConsent = exports.oauthAccessToken = exports.oauthApplication = exports.jwks = exports.verification = exports.account = exports.session = exports.user = void 0;
exports.appSchema = exports.authSchema = exports.subtasksRelations = exports.discordIntegrationsRelations = exports.webhookDeliveriesRelations = exports.webhookEndpointsRelations = exports.timeEntriesRelations = exports.commentMentionsRelations = exports.commentsRelations = exports.taskAttachmentsRelations = exports.attachmentBlobsRelations = exports.milestoneTasksRelations = exports.milestonesRelations = exports.goalsRelations = exports.taskDependenciesRelations = exports.apiKeysRelations = exports.pushSubscriptionsRelations = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
/** Better Auth — core user */
exports.user = (0, pg_core_1.pgTable)("user", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    emailVerified: (0, pg_core_1.boolean)("email_verified").notNull().default(false),
    image: (0, pg_core_1.text)("image"),
    /** Cached avatar URL from each linked OAuth provider, refreshed on every sign-in via that provider. */
    discordImage: (0, pg_core_1.text)("discord_image"),
    googleImage: (0, pg_core_1.text)("google_image"),
    /** Which linked provider's avatar to use for `image`. Null = auto (prefers Discord, see auth.ts). */
    avatarSource: (0, pg_core_1.text)("avatar_source"),
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
/** Better Auth `mcp`/`oidc-provider` plugin — an OAuth client registered (usually via dynamic client registration) against our authorization server. */
exports.oauthApplication = (0, pg_core_1.pgTable)("oauth_application", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    icon: (0, pg_core_1.text)("icon"),
    metadata: (0, pg_core_1.text)("metadata"),
    clientId: (0, pg_core_1.text)("client_id").notNull().unique(),
    clientSecret: (0, pg_core_1.text)("client_secret"),
    redirectUrls: (0, pg_core_1.text)("redirect_urls").notNull(),
    type: (0, pg_core_1.text)("type").notNull(),
    /** Not part of Better Auth's documented oidc-provider schema, but `registerMcpClient` writes it on every DCR call — omitting this column causes registration to fail. */
    authenticationScheme: (0, pg_core_1.text)("authentication_scheme"),
    disabled: (0, pg_core_1.boolean)("disabled").notNull().default(false),
    userId: (0, pg_core_1.text)("user_id").references(() => exports.user.id, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [(0, pg_core_1.index)("oauth_application_user_id_idx").on(t.userId)]);
exports.oauthAccessToken = (0, pg_core_1.pgTable)("oauth_access_token", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    accessToken: (0, pg_core_1.text)("access_token").notNull().unique(),
    refreshToken: (0, pg_core_1.text)("refresh_token").notNull().unique(),
    accessTokenExpiresAt: (0, pg_core_1.timestamp)("access_token_expires_at", { withTimezone: true }).notNull(),
    refreshTokenExpiresAt: (0, pg_core_1.timestamp)("refresh_token_expires_at", { withTimezone: true }).notNull(),
    clientId: (0, pg_core_1.text)("client_id")
        .notNull()
        .references(() => exports.oauthApplication.clientId, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id").references(() => exports.user.id, { onDelete: "cascade" }),
    scopes: (0, pg_core_1.text)("scopes").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [
    (0, pg_core_1.index)("oauth_access_token_client_id_idx").on(t.clientId),
    (0, pg_core_1.index)("oauth_access_token_user_id_idx").on(t.userId),
]);
exports.oauthConsent = (0, pg_core_1.pgTable)("oauth_consent", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    clientId: (0, pg_core_1.text)("client_id")
        .notNull()
        .references(() => exports.oauthApplication.clientId, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "cascade" }),
    scopes: (0, pg_core_1.text)("scopes").notNull(),
    consentGiven: (0, pg_core_1.boolean)("consent_given").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [
    (0, pg_core_1.index)("oauth_consent_client_id_idx").on(t.clientId),
    (0, pg_core_1.index)("oauth_consent_user_id_idx").on(t.userId),
]);
exports.orgRoleEnum = (0, pg_core_1.pgEnum)("org_role", ["owner", "manager", "member"]);
exports.roadmapStatusEnum = (0, pg_core_1.pgEnum)("roadmap_status", [
    "on_track",
    "at_risk",
    "done",
    "archived",
]);
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
    /** Discord channel snowflake ID attachments on this task are posted to; null = Discord posting disabled. */
    discordChannelId: (0, pg_core_1.text)("discord_channel_id"),
    /** When a Discord channel is set, whether a Discord submission is required before the task can be marked done. */
    discordSubmissionRequired: (0, pg_core_1.boolean)("discord_submission_required").notNull().default(true),
    /** At least one attachment (any source) is required before the task can be marked done. */
    attachmentRequired: (0, pg_core_1.boolean)("attachment_required").notNull().default(false),
    /** Controls whether the time-tracking UI renders for this task at all. */
    timeTrackingEnabled: (0, pg_core_1.boolean)("time_tracking_enabled").notNull().default(true),
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
    "comment_added",
    "comment_edited",
    "comment_deleted",
    "attachment_added",
    "attachment_deleted",
    "dependency_added",
    "dependency_removed",
    "priority_change",
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
/** Blocking relationship: taskId is blocked by dependsOnTaskId. */
exports.taskDependencies = (0, pg_core_1.pgTable)("task_dependencies", {
    taskId: (0, pg_core_1.uuid)("task_id")
        .notNull()
        .references(() => exports.tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: (0, pg_core_1.uuid)("depends_on_task_id")
        .notNull()
        .references(() => exports.tasks.id, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.primaryKey)({ columns: [t.taskId, t.dependsOnTaskId] }),
    (0, pg_core_1.index)("task_deps_depends_on_idx").on(t.dependsOnTaskId),
]);
/** Outcome a team is pursuing; not time-boxed. Owns one or more milestones. */
exports.goals = (0, pg_core_1.pgTable)("goals", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)("organization_id")
        .notNull()
        .references(() => exports.organizations.id, { onDelete: "cascade" }),
    /** Optional level scope; null = org-wide goal. */
    departmentId: (0, pg_core_1.uuid)("department_id").references(() => exports.departments.id, { onDelete: "set null" }),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    ownerId: (0, pg_core_1.text)("owner_id").references(() => exports.user.id, { onDelete: "set null" }),
    status: (0, exports.roadmapStatusEnum)("status").notNull().default("on_track"),
    /** Soft overall deadline; not a structural boundary for its milestones. */
    targetDate: (0, pg_core_1.timestamp)("target_date", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [(0, pg_core_1.index)("goals_org_idx").on(t.organizationId)]);
/** Time-boxed step serving a goal; free-form dates, no forced period ladder. Optionally self-nests via parentId. */
exports.milestones = (0, pg_core_1.pgTable)("milestones", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)("organization_id")
        .notNull()
        .references(() => exports.organizations.id, { onDelete: "cascade" }),
    /** Optional level scope; null = org-wide milestone. */
    departmentId: (0, pg_core_1.uuid)("department_id").references(() => exports.departments.id, { onDelete: "set null" }),
    goalId: (0, pg_core_1.uuid)("goal_id")
        .notNull()
        .references(() => exports.goals.id, { onDelete: "cascade" }),
    parentId: (0, pg_core_1.uuid)("parent_id"),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    periodStart: (0, pg_core_1.timestamp)("period_start", { withTimezone: true }).notNull(),
    periodEnd: (0, pg_core_1.timestamp)("period_end", { withTimezone: true }).notNull(),
    ownerId: (0, pg_core_1.text)("owner_id").references(() => exports.user.id, { onDelete: "set null" }),
    status: (0, exports.roadmapStatusEnum)("status").notNull().default("on_track"),
    orderIndex: (0, pg_core_1.integer)("order_index").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [
    (0, pg_core_1.index)("milestones_org_idx").on(t.organizationId),
    (0, pg_core_1.index)("milestones_goal_idx").on(t.goalId),
    (0, pg_core_1.index)("milestones_parent_idx").on(t.parentId),
]);
/** Which real tasks count toward a milestone. */
exports.milestoneTasks = (0, pg_core_1.pgTable)("milestone_tasks", {
    milestoneId: (0, pg_core_1.uuid)("milestone_id")
        .notNull()
        .references(() => exports.milestones.id, { onDelete: "cascade" }),
    taskId: (0, pg_core_1.uuid)("task_id")
        .notNull()
        .references(() => exports.tasks.id, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.primaryKey)({ columns: [t.milestoneId, t.taskId] }),
    (0, pg_core_1.index)("milestone_tasks_task_idx").on(t.taskId),
]);
/** Deduplicated binary payload in R2 (content-addressed or legacy key). */
exports.attachmentBlobs = (0, pg_core_1.pgTable)("attachment_blobs", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    contentSha256: (0, pg_core_1.text)("content_sha256").notNull().unique(),
    storageKey: (0, pg_core_1.text)("storage_key").notNull().unique(),
    mimeType: (0, pg_core_1.text)("mime_type").notNull(),
    byteSize: (0, pg_core_1.text)("byte_size").notNull(),
    refCount: (0, pg_core_1.integer)("ref_count").notNull().default(1),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
});
/** Files uploaded to tasks; each row references one shared blob. */
exports.taskAttachments = (0, pg_core_1.pgTable)("task_attachments", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    taskId: (0, pg_core_1.uuid)("task_id")
        .notNull()
        .references(() => exports.tasks.id, { onDelete: "cascade" }),
    blobId: (0, pg_core_1.uuid)("blob_id")
        .notNull()
        .references(() => exports.attachmentBlobs.id, { onDelete: "restrict" }),
    uploadedBy: (0, pg_core_1.text)("uploaded_by")
        .notNull()
        .references(() => exports.user.id, { onDelete: "restrict" }),
    fileName: (0, pg_core_1.text)("file_name").notNull(),
    fileSize: (0, pg_core_1.text)("file_size").notNull(), // display size (original upload); blob may be smaller when compressed
    mimeType: (0, pg_core_1.text)("mime_type").notNull(),
    /** Set when this file was uploaded via the "Discord submission" flow and successfully posted; null = not a Discord submission (or delivery failed). */
    discordDeliveredAt: (0, pg_core_1.timestamp)("discord_delivered_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [(0, pg_core_1.index)("task_attachments_task_idx").on(t.taskId), (0, pg_core_1.index)("task_attachments_blob_idx").on(t.blobId)]);
/** Task comments (threaded, soft-deletable). */
exports.comments = (0, pg_core_1.pgTable)("comments", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    taskId: (0, pg_core_1.uuid)("task_id")
        .notNull()
        .references(() => exports.tasks.id, { onDelete: "cascade" }),
    parentCommentId: (0, pg_core_1.uuid)("parent_comment_id"),
    authorId: (0, pg_core_1.text)("author_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "restrict" }),
    body: (0, pg_core_1.text)("body").notNull(),
    editedAt: (0, pg_core_1.timestamp)("edited_at", { withTimezone: true }),
    deletedAt: (0, pg_core_1.timestamp)("deleted_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.index)("comments_task_created_idx").on(t.taskId, t.createdAt),
    (0, pg_core_1.index)("comments_parent_idx").on(t.parentCommentId),
]);
/** Mention records inside a comment — each @[name](userId) becomes a row. */
exports.commentMentions = (0, pg_core_1.pgTable)("comment_mentions", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    commentId: (0, pg_core_1.uuid)("comment_id")
        .notNull()
        .references(() => exports.comments.id, { onDelete: "cascade" }),
    mentionedUserId: (0, pg_core_1.text)("mentioned_user_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [(0, pg_core_1.index)("comment_mentions_user_idx").on(t.mentionedUserId)]);
/** Outbound webhook endpoints registered per organization. */
exports.webhookEndpoints = (0, pg_core_1.pgTable)("webhook_endpoints", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)("organization_id")
        .notNull()
        .references(() => exports.organizations.id, { onDelete: "cascade" }),
    url: (0, pg_core_1.text)("url").notNull(),
    secret: (0, pg_core_1.text)("secret").notNull(),
    events: (0, pg_core_1.text)("events").array().notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [(0, pg_core_1.index)("webhook_endpoints_org_idx").on(t.organizationId)]);
/** Delivery log for each webhook event attempt. */
exports.webhookDeliveries = (0, pg_core_1.pgTable)("webhook_deliveries", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    webhookEndpointId: (0, pg_core_1.uuid)("webhook_endpoint_id")
        .notNull()
        .references(() => exports.webhookEndpoints.id, { onDelete: "cascade" }),
    event: (0, pg_core_1.text)("event").notNull(),
    payload: (0, pg_core_1.jsonb)("payload").notNull(),
    responseStatus: (0, pg_core_1.text)("response_status"),
    responseBody: (0, pg_core_1.text)("response_body"),
    deliveredAt: (0, pg_core_1.timestamp)("delivered_at", { withTimezone: true }),
    failedAt: (0, pg_core_1.timestamp)("failed_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [(0, pg_core_1.index)("webhook_deliveries_endpoint_idx").on(t.webhookEndpointId, t.createdAt)]);
/** Discord server (guild) an organization has connected; the bot itself is one shared app-wide bot. */
exports.discordIntegrations = (0, pg_core_1.pgTable)("discord_integrations", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    organizationId: (0, pg_core_1.uuid)("organization_id")
        .notNull()
        .references(() => exports.organizations.id, { onDelete: "cascade" }),
    guildId: (0, pg_core_1.text)("guild_id").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
}, (t) => [(0, pg_core_1.uniqueIndex)("discord_integrations_org_uidx").on(t.organizationId)]);
/** Long-lived, revocable credential for machine/agent clients (e.g. the MCP tool API). Raw key is shown once on creation; only its hash is stored. */
exports.apiKeys = (0, pg_core_1.pgTable)("api_keys", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.text)("name").notNull(),
    /** SHA-256 hex digest of the raw key; the raw key itself is never persisted. */
    keyHash: (0, pg_core_1.text)("key_hash").notNull().unique(),
    /** First few characters of the raw key, shown in the UI to help identify a key without revealing it. */
    keyPrefix: (0, pg_core_1.text)("key_prefix").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: (0, pg_core_1.timestamp)("last_used_at", { withTimezone: true }),
    revokedAt: (0, pg_core_1.timestamp)("revoked_at", { withTimezone: true }),
}, (t) => [(0, pg_core_1.index)("api_keys_user_idx").on(t.userId)]);
/** Time entries: manual or timer-based work log per task per user. */
exports.timeEntries = (0, pg_core_1.pgTable)("time_entries", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    taskId: (0, pg_core_1.uuid)("task_id")
        .notNull()
        .references(() => exports.tasks.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id")
        .notNull()
        .references(() => exports.user.id, { onDelete: "restrict" }),
    startedAt: (0, pg_core_1.timestamp)("started_at", { withTimezone: true }).notNull(),
    stoppedAt: (0, pg_core_1.timestamp)("stopped_at", { withTimezone: true }),
    /** Duration in seconds, set when timer stops or logged manually. */
    duration: (0, pg_core_1.text)("duration"),
    note: (0, pg_core_1.text)("note"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
    (0, pg_core_1.index)("time_entries_task_idx").on(t.taskId),
    (0, pg_core_1.index)("time_entries_user_idx").on(t.userId),
]);
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
exports.oauthApplicationsRelations = (0, drizzle_orm_1.relations)(exports.oauthApplication, ({ one, many }) => ({
    user: one(exports.user, { fields: [exports.oauthApplication.userId], references: [exports.user.id] }),
    accessTokens: many(exports.oauthAccessToken),
    consents: many(exports.oauthConsent),
}));
exports.oauthAccessTokensRelations = (0, drizzle_orm_1.relations)(exports.oauthAccessToken, ({ one }) => ({
    application: one(exports.oauthApplication, {
        fields: [exports.oauthAccessToken.clientId],
        references: [exports.oauthApplication.clientId],
    }),
    user: one(exports.user, { fields: [exports.oauthAccessToken.userId], references: [exports.user.id] }),
}));
exports.oauthConsentsRelations = (0, drizzle_orm_1.relations)(exports.oauthConsent, ({ one }) => ({
    application: one(exports.oauthApplication, {
        fields: [exports.oauthConsent.clientId],
        references: [exports.oauthApplication.clientId],
    }),
    user: one(exports.user, { fields: [exports.oauthConsent.userId], references: [exports.user.id] }),
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
exports.apiKeysRelations = (0, drizzle_orm_1.relations)(exports.apiKeys, ({ one }) => ({
    user: one(exports.user, { fields: [exports.apiKeys.userId], references: [exports.user.id] }),
}));
exports.taskDependenciesRelations = (0, drizzle_orm_1.relations)(exports.taskDependencies, ({ one }) => ({
    task: one(exports.tasks, { fields: [exports.taskDependencies.taskId], references: [exports.tasks.id], relationName: "blockedBy" }),
    dependsOn: one(exports.tasks, { fields: [exports.taskDependencies.dependsOnTaskId], references: [exports.tasks.id], relationName: "blocking" }),
}));
exports.goalsRelations = (0, drizzle_orm_1.relations)(exports.goals, ({ one, many }) => ({
    organization: one(exports.organizations, { fields: [exports.goals.organizationId], references: [exports.organizations.id] }),
    department: one(exports.departments, { fields: [exports.goals.departmentId], references: [exports.departments.id] }),
    owner: one(exports.user, { fields: [exports.goals.ownerId], references: [exports.user.id] }),
    milestones: many(exports.milestones),
}));
exports.milestonesRelations = (0, drizzle_orm_1.relations)(exports.milestones, ({ one, many }) => ({
    organization: one(exports.organizations, {
        fields: [exports.milestones.organizationId],
        references: [exports.organizations.id],
    }),
    department: one(exports.departments, { fields: [exports.milestones.departmentId], references: [exports.departments.id] }),
    goal: one(exports.goals, { fields: [exports.milestones.goalId], references: [exports.goals.id] }),
    parent: one(exports.milestones, {
        fields: [exports.milestones.parentId],
        references: [exports.milestones.id],
        relationName: "children",
    }),
    children: many(exports.milestones, { relationName: "children" }),
    owner: one(exports.user, { fields: [exports.milestones.ownerId], references: [exports.user.id] }),
    linkedTasks: many(exports.milestoneTasks),
}));
exports.milestoneTasksRelations = (0, drizzle_orm_1.relations)(exports.milestoneTasks, ({ one }) => ({
    milestone: one(exports.milestones, { fields: [exports.milestoneTasks.milestoneId], references: [exports.milestones.id] }),
    task: one(exports.tasks, { fields: [exports.milestoneTasks.taskId], references: [exports.tasks.id] }),
}));
exports.attachmentBlobsRelations = (0, drizzle_orm_1.relations)(exports.attachmentBlobs, ({ many }) => ({
    attachments: many(exports.taskAttachments),
}));
exports.taskAttachmentsRelations = (0, drizzle_orm_1.relations)(exports.taskAttachments, ({ one }) => ({
    task: one(exports.tasks, { fields: [exports.taskAttachments.taskId], references: [exports.tasks.id] }),
    blob: one(exports.attachmentBlobs, { fields: [exports.taskAttachments.blobId], references: [exports.attachmentBlobs.id] }),
    uploader: one(exports.user, { fields: [exports.taskAttachments.uploadedBy], references: [exports.user.id] }),
}));
exports.commentsRelations = (0, drizzle_orm_1.relations)(exports.comments, ({ one, many }) => ({
    task: one(exports.tasks, { fields: [exports.comments.taskId], references: [exports.tasks.id] }),
    author: one(exports.user, { fields: [exports.comments.authorId], references: [exports.user.id] }),
    parent: one(exports.comments, { fields: [exports.comments.parentCommentId], references: [exports.comments.id], relationName: "replies" }),
    replies: many(exports.comments, { relationName: "replies" }),
    mentions: many(exports.commentMentions),
}));
exports.commentMentionsRelations = (0, drizzle_orm_1.relations)(exports.commentMentions, ({ one }) => ({
    comment: one(exports.comments, { fields: [exports.commentMentions.commentId], references: [exports.comments.id] }),
    mentionedUser: one(exports.user, { fields: [exports.commentMentions.mentionedUserId], references: [exports.user.id] }),
}));
exports.timeEntriesRelations = (0, drizzle_orm_1.relations)(exports.timeEntries, ({ one }) => ({
    task: one(exports.tasks, { fields: [exports.timeEntries.taskId], references: [exports.tasks.id] }),
    user: one(exports.user, { fields: [exports.timeEntries.userId], references: [exports.user.id] }),
}));
exports.webhookEndpointsRelations = (0, drizzle_orm_1.relations)(exports.webhookEndpoints, ({ one, many }) => ({
    organization: one(exports.organizations, { fields: [exports.webhookEndpoints.organizationId], references: [exports.organizations.id] }),
    deliveries: many(exports.webhookDeliveries),
}));
exports.webhookDeliveriesRelations = (0, drizzle_orm_1.relations)(exports.webhookDeliveries, ({ one }) => ({
    endpoint: one(exports.webhookEndpoints, { fields: [exports.webhookDeliveries.webhookEndpointId], references: [exports.webhookEndpoints.id] }),
}));
exports.discordIntegrationsRelations = (0, drizzle_orm_1.relations)(exports.discordIntegrations, ({ one }) => ({
    organization: one(exports.organizations, { fields: [exports.discordIntegrations.organizationId], references: [exports.organizations.id] }),
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
    oauthApplication: exports.oauthApplication,
    oauthAccessToken: exports.oauthAccessToken,
    oauthConsent: exports.oauthConsent,
    usersRelations: exports.usersRelations,
    sessionsRelations: exports.sessionsRelations,
    accountsRelations: exports.accountsRelations,
    oauthApplicationsRelations: exports.oauthApplicationsRelations,
    oauthAccessTokensRelations: exports.oauthAccessTokensRelations,
    oauthConsentsRelations: exports.oauthConsentsRelations,
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
    taskDependencies: exports.taskDependencies,
    attachmentBlobs: exports.attachmentBlobs,
    taskAttachments: exports.taskAttachments,
    comments: exports.comments,
    commentMentions: exports.commentMentions,
    timeEntries: exports.timeEntries,
    webhookEndpoints: exports.webhookEndpoints,
    webhookDeliveries: exports.webhookDeliveries,
    discordIntegrations: exports.discordIntegrations,
    apiKeys: exports.apiKeys,
    goals: exports.goals,
    milestones: exports.milestones,
    milestoneTasks: exports.milestoneTasks,
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
    taskDependenciesRelations: exports.taskDependenciesRelations,
    attachmentBlobsRelations: exports.attachmentBlobsRelations,
    taskAttachmentsRelations: exports.taskAttachmentsRelations,
    commentsRelations: exports.commentsRelations,
    commentMentionsRelations: exports.commentMentionsRelations,
    timeEntriesRelations: exports.timeEntriesRelations,
    webhookEndpointsRelations: exports.webhookEndpointsRelations,
    webhookDeliveriesRelations: exports.webhookDeliveriesRelations,
    discordIntegrationsRelations: exports.discordIntegrationsRelations,
    apiKeysRelations: exports.apiKeysRelations,
    goalsRelations: exports.goalsRelations,
    milestonesRelations: exports.milestonesRelations,
    milestoneTasksRelations: exports.milestoneTasksRelations,
};
