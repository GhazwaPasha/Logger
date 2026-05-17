import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { lists, organizationMembers, taskTemplates } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";

type SubtaskDraft = { title: string };

@Injectable()
export class TemplatesService {
  constructor(@Inject(DRIZZLE) private readonly db: AppDatabase) {}

  async list(userId: string, orgId: string) {
    await this.assertMember(userId, orgId);
    return this.db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.organizationId, orgId));
  }

  async create(
    userId: string,
    orgId: string,
    body: {
      name: string;
      defaultTitle?: string;
      defaultPriority?: string;
      defaultDueRepeat?: string;
      defaultListId?: string;
      defaultSubtasks?: SubtaskDraft[];
    },
  ) {
    await this.assertMember(userId, orgId);

    if (body.defaultListId) {
      const [lst] = await this.db
        .select({ id: lists.id })
        .from(lists)
        .where(and(eq(lists.id, body.defaultListId), eq(lists.organizationId, orgId)))
        .limit(1);
      if (!lst) throw new NotFoundException("List not found in this organization");
    }

    const [template] = await this.db
      .insert(taskTemplates)
      .values({
        organizationId: orgId,
        createdBy: userId,
        name: body.name,
        defaultTitle: body.defaultTitle ?? null,
        defaultPriority: body.defaultPriority ?? null,
        defaultDueRepeat: body.defaultDueRepeat ?? null,
        defaultListId: body.defaultListId ?? null,
        defaultSubtasks: body.defaultSubtasks ?? [],
      })
      .returning();

    return template;
  }

  async remove(userId: string, orgId: string, templateId: string) {
    const [template] = await this.db
      .select()
      .from(taskTemplates)
      .where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.organizationId, orgId)))
      .limit(1);

    if (!template) throw new NotFoundException("Template not found");

    const [member] = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
      .limit(1);

    const isOwner = member?.role === "owner";
    const isCreator = template.createdBy === userId;
    if (!isOwner && !isCreator) throw new ForbiddenException("Only the creator or org owner can delete a template");

    await this.db.delete(taskTemplates).where(eq(taskTemplates.id, templateId));
  }

  async apply(userId: string, orgId: string, templateId: string) {
    await this.assertMember(userId, orgId);
    const [template] = await this.db
      .select()
      .from(taskTemplates)
      .where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.organizationId, orgId)))
      .limit(1);

    if (!template) throw new NotFoundException("Template not found");

    return {
      title: template.defaultTitle ?? "",
      priority: template.defaultPriority ?? "medium",
      dueRepeat: template.defaultDueRepeat ?? null,
      listId: template.defaultListId ?? null,
      subtasks: (template.defaultSubtasks as SubtaskDraft[]) ?? [],
    };
  }

  private async assertMember(userId: string, orgId: string) {
    const [member] = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
      .limit(1);
    if (!member) throw new ForbiddenException("Not a member of this organization");
  }
}
