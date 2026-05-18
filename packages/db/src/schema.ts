import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Better Auth — core user */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Better Auth JWT plugin — JWKS storage */
export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const orgRoleEnum = pgEnum("org_role", ["owner", "manager", "member"]);
export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "pending",
  "assigned",
  "in_progress",
  "done",
  "late",
  "cancelled",
]);
export const taskPriorityEnum = pgEnum("task_priority", ["high", "medium", "low"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  /** URL segment for web routes (`/<slug>/…`). Immutable after create. */
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("departments_org_idx").on(t.organizationId)],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull(),
    /**
     * Legacy column: first managed level when role is `manager`.
     * Canonical many-to-many is `organization_member_managed_departments`.
     */
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_members_org_user_idx").on(t.organizationId, t.userId),
    index("organization_members_user_idx").on(t.userId),
  ],
);

/** Levels a manager covers (role `manager`); empty for owner/member. */
export const organizationMemberManagedDepartments = pgTable(
  "organization_member_managed_departments",
  {
    organizationMemberId: uuid("organization_member_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationMemberId, t.departmentId] }),
    index("organization_member_managed_departments_dept_idx").on(t.departmentId),
  ],
);

export const lists = pgTable(
  "lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("lists_org_idx").on(t.organizationId),
    index("lists_department_idx").on(t.departmentId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    assignerId: text("assigner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    status: taskStatusEnum("status").notNull().default("pending"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    /** `daily` | `weekly` | `monthly` | `yearly`; null = none. */
    dueRepeat: text("due_repeat"),
    /** Group id for recurring chain; set when the task has `due_repeat` (see migration backfill). */
    recurringSeriesId: uuid("recurring_series_id"),
    /** If this row was created as the next cycle of a recurring task, parent task id. */
    spawnedFromTaskId: uuid("spawned_from_task_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("tasks_org_idx").on(t.organizationId),
    index("tasks_list_idx").on(t.listId),
    index("tasks_assigner_idx").on(t.assignerId),
    index("tasks_recurring_series_idx").on(t.recurringSeriesId),
    uniqueIndex("tasks_spawned_from_parent_uidx")
      .on(t.spawnedFromTaskId)
      .where(sql`${t.spawnedFromTaskId} is not null`),
  ],
);

export const subtasks = pgTable(
  "subtasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: boolean("done").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("subtasks_task_idx").on(t.taskId)],
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("task_assignees_task_user_idx").on(t.taskId, t.userId),
    index("task_assignees_user_idx").on(t.userId),
  ],
);

export const ledgerTypeEnum = pgEnum("ledger_type", [
  "ack",
  "note",
  "reschedule",
  "status_change",
  "assignee_change",
  "archive",
]);

export const activityLedger = pgTable(
  "activity_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    type: ledgerTypeEnum("type").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    clientMutationId: text("client_mutation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_ledger_task_created_idx").on(t.taskId, t.createdAt)],
);

/** Blocking relationship: taskId is blocked by dependsOnTaskId. */
export const taskDependencies = pgTable(
  "task_dependencies",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.dependsOnTaskId] }),
    index("task_deps_depends_on_idx").on(t.dependsOnTaskId),
  ],
);

/** Files uploaded to tasks, stored in Cloudflare R2 via presigned PUT. */
export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    fileName: text("file_name").notNull(),
    fileSize: text("file_size").notNull(), // stored as string to avoid integer overflow on large files
    mimeType: text("mime_type").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_attachments_task_idx").on(t.taskId)],
);

/** Task comments (threaded, soft-deletable). */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    parentCommentId: uuid("parent_comment_id"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("comments_task_created_idx").on(t.taskId, t.createdAt),
    index("comments_parent_idx").on(t.parentCommentId),
  ],
);

/** Mention records inside a comment — each @[name](userId) becomes a row. */
export const commentMentions = pgTable(
  "comment_mentions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    mentionedUserId: text("mentioned_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comment_mentions_user_idx").on(t.mentionedUserId)],
);

/** Outbound webhook endpoints registered per organization. */
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    events: text("events").array().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_endpoints_org_idx").on(t.organizationId)],
);

/** Delivery log for each webhook event attempt. */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    webhookEndpointId: uuid("webhook_endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull(),
    responseStatus: text("response_status"),
    responseBody: text("response_body"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_deliveries_endpoint_idx").on(t.webhookEndpointId, t.createdAt)],
);

/** Time entries: manual or timer-based work log per task per user. */
export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    /** Duration in seconds, set when timer stops or logged manually. */
    duration: text("duration"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("time_entries_task_idx").on(t.taskId),
    index("time_entries_user_idx").on(t.userId),
  ],
);

/** In-app notification inbox for users. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'mention' | 'comment' | 'status_change' | 'assignment' | 'dependency_unblocked' | 'webhook_fail'
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_org_idx").on(t.userId, t.organizationId),
    index("notifications_unread_idx").on(t.readAt),
  ],
);

/** Browser Web Push subscriptions (FCM/Apple/APNs via browser endpoint). */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_uidx").on(t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);

export const usersRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  pushSubscriptions: many(pushSubscriptions),
}));

export const sessionsRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountsRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  departments: many(departments),
  lists: many(lists),
  tasks: many(tasks),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(user, { fields: [organizationMembers.userId], references: [user.id] }),
  managedDepartments: many(organizationMemberManagedDepartments),
}));

export const organizationMemberManagedDepartmentsRelations = relations(
  organizationMemberManagedDepartments,
  ({ one }) => ({
    member: one(organizationMembers, {
      fields: [organizationMemberManagedDepartments.organizationMemberId],
      references: [organizationMembers.id],
    }),
    department: one(departments, {
      fields: [organizationMemberManagedDepartments.departmentId],
      references: [departments.id],
    }),
  }),
);

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [departments.organizationId],
    references: [organizations.id],
  }),
  lists: many(lists),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [lists.organizationId],
    references: [organizations.id],
  }),
  department: one(departments, {
    fields: [lists.departmentId],
    references: [departments.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tasks.organizationId],
    references: [organizations.id],
  }),
  list: one(lists, {
    fields: [tasks.listId],
    references: [lists.id],
  }),
  assigner: one(user, { fields: [tasks.assignerId], references: [user.id] }),
  assignees: many(taskAssignees),
  subtasks: many(subtasks),
  ledgerEntries: many(activityLedger),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, { fields: [taskAssignees.taskId], references: [tasks.id] }),
  user: one(user, { fields: [taskAssignees.userId], references: [user.id] }),
}));

export const activityLedgerRelations = relations(activityLedger, ({ one }) => ({
  task: one(tasks, { fields: [activityLedger.taskId], references: [tasks.id] }),
  actor: one(user, { fields: [activityLedger.actorId], references: [user.id] }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(user, { fields: [pushSubscriptions.userId], references: [user.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, { fields: [notifications.userId], references: [user.id] }),
  organization: one(organizations, { fields: [notifications.organizationId], references: [organizations.id] }),
  task: one(tasks, { fields: [notifications.taskId], references: [tasks.id] }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, { fields: [taskDependencies.taskId], references: [tasks.id], relationName: "blockedBy" }),
  dependsOn: one(tasks, { fields: [taskDependencies.dependsOnTaskId], references: [tasks.id], relationName: "blocking" }),
}));

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, { fields: [taskAttachments.taskId], references: [tasks.id] }),
  uploader: one(user, { fields: [taskAttachments.uploadedBy], references: [user.id] }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
  author: one(user, { fields: [comments.authorId], references: [user.id] }),
  parent: one(comments, { fields: [comments.parentCommentId], references: [comments.id], relationName: "replies" }),
  replies: many(comments, { relationName: "replies" }),
  mentions: many(commentMentions),
}));

export const commentMentionsRelations = relations(commentMentions, ({ one }) => ({
  comment: one(comments, { fields: [commentMentions.commentId], references: [comments.id] }),
  mentionedUser: one(user, { fields: [commentMentions.mentionedUserId], references: [user.id] }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  task: one(tasks, { fields: [timeEntries.taskId], references: [tasks.id] }),
  user: one(user, { fields: [timeEntries.userId], references: [user.id] }),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  organization: one(organizations, { fields: [webhookEndpoints.organizationId], references: [organizations.id] }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, { fields: [webhookDeliveries.webhookEndpointId], references: [webhookEndpoints.id] }),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, { fields: [subtasks.taskId], references: [tasks.id] }),
}));

export const authSchema = {
  user,
  session,
  account,
  verification,
  jwks,
  usersRelations,
  sessionsRelations,
  accountsRelations,
};

export const appSchema = {
  organizations,
  organizationMembers,
  organizationMemberManagedDepartments,
  departments,
  lists,
  tasks,
  subtasks,
  taskAssignees,
  activityLedger,
  pushSubscriptions,
  notifications,
  taskDependencies,
  taskAttachments,
  comments,
  commentMentions,
  timeEntries,
  webhookEndpoints,
  webhookDeliveries,
  organizationsRelations,
  organizationMembersRelations,
  organizationMemberManagedDepartmentsRelations,
  departmentsRelations,
  listsRelations,
  tasksRelations,
  subtasksRelations,
  taskAssigneesRelations,
  activityLedgerRelations,
  pushSubscriptionsRelations,
  notificationsRelations,
  taskDependenciesRelations,
  taskAttachmentsRelations,
  commentsRelations,
  commentMentionsRelations,
  timeEntriesRelations,
  webhookEndpointsRelations,
  webhookDeliveriesRelations,
};
