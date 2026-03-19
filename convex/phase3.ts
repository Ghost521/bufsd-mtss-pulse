import { queryGeneric as query, mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";

export const getTenantCollection = query({
  args: {
    tenantKey: v.string(),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("tenantCollections")
      .withIndex("by_tenant_domain")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("domain"), args.domain),
        )
      )
      .unique();

    return record?.rows ?? null;
  },
});

export const setTenantCollection = mutation({
  args: {
    tenantKey: v.string(),
    domain: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantCollections")
      .withIndex("by_tenant_domain")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("domain"), args.domain),
        )
      )
      .unique();

    const next = {
      tenantKey: args.tenantKey,
      domain: args.domain,
      rows: args.rows,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("tenantCollections", next);
  },
});

export const appendAuditEntry = mutation({
  args: {
    tenantKey: v.string(),
    entry: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tenantAuditEntries", {
      tenantKey: args.tenantKey,
      entry: args.entry,
      at: new Date().toISOString(),
    });
  },
});

export const listInterventionRows = query({
  args: {
    tenantKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantInterventionRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    return rows
      .sort((left, right) => {
        if (left.position !== right.position) return left.position - right.position;
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map((record) => record.row);
  },
});

export const replaceInterventionRows = mutation({
  args: {
    tenantKey: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantInterventionRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }

    const now = new Date().toISOString();
    for (let index = 0; index < args.rows.length; index += 1) {
      const row = args.rows[index];
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) continue;
      await ctx.db.insert("tenantInterventionRecords", {
        tenantKey: args.tenantKey,
        interventionId: candidate.id,
        row,
        position: index,
        updatedAt: now,
      });
    }

    return args.rows.length;
  },
});

export const upsertInterventionRow = mutation({
  args: {
    tenantKey: v.string(),
    row: v.any(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const candidate = args.row as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
      throw new Error("Intervention row must include a string id.");
    }
    const interventionId = candidate.id;

    const existing = await ctx.db
      .query("tenantInterventionRecords")
      .withIndex("by_tenant_intervention")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("interventionId"), interventionId),
        )
      )
      .unique();

    let position = typeof args.position === "number" && Number.isFinite(args.position)
      ? Math.floor(args.position)
      : existing?.position;

    if (position === undefined) {
      const siblings = await ctx.db
        .query("tenantInterventionRecords")
        .withIndex("by_tenant")
        .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
        .collect();
      const minPosition = siblings.reduce(
        (minimum, row) => Math.min(minimum, row.position),
        0,
      );
      position = siblings.length > 0 ? minPosition - 1 : 0;
    }

    const next = {
      tenantKey: args.tenantKey,
      interventionId,
      row: args.row,
      position,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("tenantInterventionRecords", next);
  },
});

export const deleteInterventionRow = mutation({
  args: {
    tenantKey: v.string(),
    interventionId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantInterventionRecords")
      .withIndex("by_tenant_intervention")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("interventionId"), args.interventionId),
        )
      )
      .unique();

    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const listCalendarRows = query({
  args: {
    tenantKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantCalendarRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    return rows
      .sort((left, right) => {
        if (left.position !== right.position) return left.position - right.position;
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map((record) => record.row);
  },
});

export const listNotificationRows = query({
  args: {
    tenantKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantNotificationRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    return rows
      .sort((left, right) => {
        if (left.position !== right.position) return left.position - right.position;
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map((record) => record.row);
  },
});

export const listMessageRows = query({
  args: {
    tenantKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantMessageRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    return rows
      .sort((left, right) => {
        if (left.position !== right.position) return left.position - right.position;
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map((record) => record.row);
  },
});

export const listDocumentRows = query({
  args: {
    tenantKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantDocumentRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    return rows
      .sort((left, right) => {
        if (left.position !== right.position) return left.position - right.position;
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map((record) => record.row);
  },
});

export const listGradebookAssignmentRows = query({
  args: {
    tenantKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantGradebookAssignmentRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    return rows
      .sort((left, right) => {
        if (left.position !== right.position) return left.position - right.position;
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map((record) => record.row);
  },
});

export const listGradebookGradeRows = query({
  args: {
    tenantKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantGradebookGradeRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    return rows
      .sort((left, right) => {
        if (left.position !== right.position) return left.position - right.position;
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map((record) => record.row);
  },
});

export const replaceNotificationRows = mutation({
  args: {
    tenantKey: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantNotificationRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }

    const now = new Date().toISOString();
    for (let index = 0; index < args.rows.length; index += 1) {
      const row = args.rows[index];
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) continue;
      await ctx.db.insert("tenantNotificationRecords", {
        tenantKey: args.tenantKey,
        notificationId: candidate.id,
        row,
        position: index,
        updatedAt: now,
      });
    }

    return args.rows.length;
  },
});

export const replaceGradebookAssignmentRows = mutation({
  args: {
    tenantKey: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantGradebookAssignmentRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }

    const now = new Date().toISOString();
    for (let index = 0; index < args.rows.length; index += 1) {
      const row = args.rows[index];
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) continue;
      await ctx.db.insert("tenantGradebookAssignmentRecords", {
        tenantKey: args.tenantKey,
        assignmentId: candidate.id,
        row,
        position: index,
        updatedAt: now,
      });
    }

    return args.rows.length;
  },
});

export const replaceGradebookGradeRows = mutation({
  args: {
    tenantKey: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantGradebookGradeRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }

    const now = new Date().toISOString();
    for (let index = 0; index < args.rows.length; index += 1) {
      const row = args.rows[index];
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) continue;
      await ctx.db.insert("tenantGradebookGradeRecords", {
        tenantKey: args.tenantKey,
        gradeId: candidate.id,
        row,
        position: index,
        updatedAt: now,
      });
    }

    return args.rows.length;
  },
});

export const replaceDocumentRows = mutation({
  args: {
    tenantKey: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantDocumentRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }

    const now = new Date().toISOString();
    for (let index = 0; index < args.rows.length; index += 1) {
      const row = args.rows[index];
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) continue;
      await ctx.db.insert("tenantDocumentRecords", {
        tenantKey: args.tenantKey,
        documentId: candidate.id,
        row,
        position: index,
        updatedAt: now,
      });
    }

    return args.rows.length;
  },
});

export const replaceMessageRows = mutation({
  args: {
    tenantKey: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantMessageRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }

    const now = new Date().toISOString();
    for (let index = 0; index < args.rows.length; index += 1) {
      const row = args.rows[index];
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) continue;
      await ctx.db.insert("tenantMessageRecords", {
        tenantKey: args.tenantKey,
        conversationId: candidate.id,
        row,
        position: index,
        updatedAt: now,
      });
    }

    return args.rows.length;
  },
});

export const upsertNotificationRow = mutation({
  args: {
    tenantKey: v.string(),
    row: v.any(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const candidate = args.row as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
      throw new Error("Notification row must include a string id.");
    }
    const notificationId = candidate.id;

    const existing = await ctx.db
      .query("tenantNotificationRecords")
      .withIndex("by_tenant_notification")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("notificationId"), notificationId),
        )
      )
      .unique();

    let position = typeof args.position === "number" && Number.isFinite(args.position)
      ? Math.floor(args.position)
      : existing?.position;

    if (position === undefined) {
      const siblings = await ctx.db
        .query("tenantNotificationRecords")
        .withIndex("by_tenant")
        .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
        .collect();
      const minPosition = siblings.reduce((minimum, row) => Math.min(minimum, row.position), 0);
      position = siblings.length > 0 ? minPosition - 1 : 0;
    }

    const next = {
      tenantKey: args.tenantKey,
      notificationId,
      row: args.row,
      position,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("tenantNotificationRecords", next);
  },
});

export const upsertMessageRow = mutation({
  args: {
    tenantKey: v.string(),
    row: v.any(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const candidate = args.row as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
      throw new Error("Message row must include a string id.");
    }
    const conversationId = candidate.id;

    const existing = await ctx.db
      .query("tenantMessageRecords")
      .withIndex("by_tenant_conversation")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("conversationId"), conversationId),
        )
      )
      .unique();

    let position = typeof args.position === "number" && Number.isFinite(args.position)
      ? Math.floor(args.position)
      : existing?.position;

    if (position === undefined) {
      const siblings = await ctx.db
        .query("tenantMessageRecords")
        .withIndex("by_tenant")
        .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
        .collect();
      const minPosition = siblings.reduce((minimum, row) => Math.min(minimum, row.position), 0);
      position = siblings.length > 0 ? minPosition - 1 : 0;
    }

    const next = {
      tenantKey: args.tenantKey,
      conversationId,
      row: args.row,
      position,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("tenantMessageRecords", next);
  },
});

export const upsertDocumentRow = mutation({
  args: {
    tenantKey: v.string(),
    row: v.any(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const candidate = args.row as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
      throw new Error("Document row must include a string id.");
    }
    const documentId = candidate.id;

    const existing = await ctx.db
      .query("tenantDocumentRecords")
      .withIndex("by_tenant_document")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("documentId"), documentId),
        )
      )
      .unique();

    let position = typeof args.position === "number" && Number.isFinite(args.position)
      ? Math.floor(args.position)
      : existing?.position;

    if (position === undefined) {
      const siblings = await ctx.db
        .query("tenantDocumentRecords")
        .withIndex("by_tenant")
        .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
        .collect();
      const minPosition = siblings.reduce((minimum, row) => Math.min(minimum, row.position), 0);
      position = siblings.length > 0 ? minPosition - 1 : 0;
    }

    const next = {
      tenantKey: args.tenantKey,
      documentId,
      row: args.row,
      position,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("tenantDocumentRecords", next);
  },
});

export const upsertGradebookAssignmentRow = mutation({
  args: {
    tenantKey: v.string(),
    row: v.any(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const candidate = args.row as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
      throw new Error("Gradebook assignment row must include a string id.");
    }
    const assignmentId = candidate.id;

    const existing = await ctx.db
      .query("tenantGradebookAssignmentRecords")
      .withIndex("by_tenant_assignment")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("assignmentId"), assignmentId),
        )
      )
      .unique();

    let position = typeof args.position === "number" && Number.isFinite(args.position)
      ? Math.floor(args.position)
      : existing?.position;

    if (position === undefined) {
      const siblings = await ctx.db
        .query("tenantGradebookAssignmentRecords")
        .withIndex("by_tenant")
        .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
        .collect();
      const minPosition = siblings.reduce((minimum, row) => Math.min(minimum, row.position), 0);
      position = siblings.length > 0 ? minPosition - 1 : 0;
    }

    const next = {
      tenantKey: args.tenantKey,
      assignmentId,
      row: args.row,
      position,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("tenantGradebookAssignmentRecords", next);
  },
});

export const upsertGradebookGradeRow = mutation({
  args: {
    tenantKey: v.string(),
    row: v.any(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const candidate = args.row as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
      throw new Error("Gradebook grade row must include a string id.");
    }
    const gradeId = candidate.id;

    const existing = await ctx.db
      .query("tenantGradebookGradeRecords")
      .withIndex("by_tenant_grade")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("gradeId"), gradeId),
        )
      )
      .unique();

    let position = typeof args.position === "number" && Number.isFinite(args.position)
      ? Math.floor(args.position)
      : existing?.position;

    if (position === undefined) {
      const siblings = await ctx.db
        .query("tenantGradebookGradeRecords")
        .withIndex("by_tenant")
        .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
        .collect();
      const minPosition = siblings.reduce((minimum, row) => Math.min(minimum, row.position), 0);
      position = siblings.length > 0 ? minPosition - 1 : 0;
    }

    const next = {
      tenantKey: args.tenantKey,
      gradeId,
      row: args.row,
      position,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("tenantGradebookGradeRecords", next);
  },
});

export const deleteNotificationRow = mutation({
  args: {
    tenantKey: v.string(),
    notificationId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantNotificationRecords")
      .withIndex("by_tenant_notification")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("notificationId"), args.notificationId),
        )
      )
      .unique();

    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const deleteGradebookAssignmentRow = mutation({
  args: {
    tenantKey: v.string(),
    assignmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantGradebookAssignmentRecords")
      .withIndex("by_tenant_assignment")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("assignmentId"), args.assignmentId),
        )
      )
      .unique();

    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const deleteGradebookGradeRow = mutation({
  args: {
    tenantKey: v.string(),
    gradeId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantGradebookGradeRecords")
      .withIndex("by_tenant_grade")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("gradeId"), args.gradeId),
        )
      )
      .unique();

    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const deleteDocumentRow = mutation({
  args: {
    tenantKey: v.string(),
    documentId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantDocumentRecords")
      .withIndex("by_tenant_document")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("documentId"), args.documentId),
        )
      )
      .unique();

    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const deleteMessageRow = mutation({
  args: {
    tenantKey: v.string(),
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantMessageRecords")
      .withIndex("by_tenant_conversation")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("conversationId"), args.conversationId),
        )
      )
      .unique();

    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const replaceCalendarRows = mutation({
  args: {
    tenantKey: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantCalendarRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }

    const now = new Date().toISOString();
    for (let index = 0; index < args.rows.length; index += 1) {
      const row = args.rows[index];
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) continue;
      await ctx.db.insert("tenantCalendarRecords", {
        tenantKey: args.tenantKey,
        eventId: candidate.id,
        row,
        position: index,
        updatedAt: now,
      });
    }

    return args.rows.length;
  },
});

export const upsertCalendarRow = mutation({
  args: {
    tenantKey: v.string(),
    row: v.any(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const candidate = args.row as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
      throw new Error("Calendar row must include a string id.");
    }
    const eventId = candidate.id;

    const existing = await ctx.db
      .query("tenantCalendarRecords")
      .withIndex("by_tenant_event")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("eventId"), eventId),
        )
      )
      .unique();

    let position = typeof args.position === "number" && Number.isFinite(args.position)
      ? Math.floor(args.position)
      : existing?.position;

    if (position === undefined) {
      const siblings = await ctx.db
        .query("tenantCalendarRecords")
        .withIndex("by_tenant")
        .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
        .collect();
      const minPosition = siblings.reduce((minimum, row) => Math.min(minimum, row.position), 0);
      position = siblings.length > 0 ? minPosition - 1 : 0;
    }

    const next = {
      tenantKey: args.tenantKey,
      eventId,
      row: args.row,
      position,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("tenantCalendarRecords", next);
  },
});

export const deleteCalendarRow = mutation({
  args: {
    tenantKey: v.string(),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantCalendarRecords")
      .withIndex("by_tenant_event")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("eventId"), args.eventId),
        )
      )
      .unique();

    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const listReferralRows = query({
  args: {
    tenantKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantReferralRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    return rows
      .sort((left, right) => {
        if (left.position !== right.position) return left.position - right.position;
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map((record) => record.row);
  },
});

export const replaceReferralRows = mutation({
  args: {
    tenantKey: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantReferralRecords")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }

    const now = new Date().toISOString();
    for (let index = 0; index < args.rows.length; index += 1) {
      const row = args.rows[index];
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) continue;
      await ctx.db.insert("tenantReferralRecords", {
        tenantKey: args.tenantKey,
        referralId: candidate.id,
        row,
        position: index,
        updatedAt: now,
      });
    }

    return args.rows.length;
  },
});

export const upsertReferralRow = mutation({
  args: {
    tenantKey: v.string(),
    row: v.any(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const candidate = args.row as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
      throw new Error("Referral row must include a string id.");
    }
    const referralId = candidate.id;

    const existing = await ctx.db
      .query("tenantReferralRecords")
      .withIndex("by_tenant_referral")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("referralId"), referralId),
        )
      )
      .unique();

    let position = typeof args.position === "number" && Number.isFinite(args.position)
      ? Math.floor(args.position)
      : existing?.position;

    if (position === undefined) {
      const siblings = await ctx.db
        .query("tenantReferralRecords")
        .withIndex("by_tenant")
        .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
        .collect();
      const minPosition = siblings.reduce((minimum, row) => Math.min(minimum, row.position), 0);
      position = siblings.length > 0 ? minPosition - 1 : 0;
    }

    const next = {
      tenantKey: args.tenantKey,
      referralId,
      row: args.row,
      position,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("tenantReferralRecords", next);
  },
});

export const deleteReferralRow = mutation({
  args: {
    tenantKey: v.string(),
    referralId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantReferralRecords")
      .withIndex("by_tenant_referral")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("referralId"), args.referralId),
        )
      )
      .unique();

    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const listStudentRows = query({
  args: {
    tenantKey: v.string(),
    scope: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantStudentRecords")
      .withIndex("by_tenant_scope")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("scope"), args.scope),
        )
      )
      .collect();

    return rows.map((record) => record.row);
  },
});

export const replaceStudentRows = mutation({
  args: {
    tenantKey: v.string(),
    scope: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantStudentRecords")
      .withIndex("by_tenant_scope")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("scope"), args.scope),
        )
      )
      .collect();

    for (const record of existing) {
      await ctx.db.delete(record._id);
    }

    const now = new Date().toISOString();
    for (const row of args.rows) {
      const candidate = row as Record<string, unknown>;
      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) continue;
      await ctx.db.insert("tenantStudentRecords", {
        tenantKey: args.tenantKey,
        scope: args.scope,
        studentId: candidate.id,
        row,
        updatedAt: now,
      });
    }

    return args.rows.length;
  },
});

export const upsertStudentRow = mutation({
  args: {
    tenantKey: v.string(),
    scope: v.string(),
    row: v.any(),
  },
  handler: async (ctx, args) => {
    const candidate = args.row as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
      throw new Error("Student row must include a string id.");
    }
    const studentId = candidate.id;

    const existing = await ctx.db
      .query("tenantStudentRecords")
      .withIndex("by_tenant_scope_student")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("scope"), args.scope),
          q.eq(q.field("studentId"), studentId),
        )
      )
      .unique();

    const next = {
      tenantKey: args.tenantKey,
      scope: args.scope,
      studentId,
      row: args.row,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("tenantStudentRecords", next);
  },
});

export const deleteStudentRow = mutation({
  args: {
    tenantKey: v.string(),
    scope: v.string(),
    studentId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantStudentRecords")
      .withIndex("by_tenant_scope_student")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantKey"), args.tenantKey),
          q.eq(q.field("scope"), args.scope),
          q.eq(q.field("studentId"), args.studentId),
        )
      )
      .unique();

    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const countAuditEntries = query({
  args: {
    tenantKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantAuditEntries")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    return rows.length;
  },
});

export const listAuditEntries = query({
  args: {
    tenantKey: v.string(),
    actorUserId: v.optional(v.string()),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    action: v.optional(v.string()),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tenantAuditEntries")
      .withIndex("by_tenant")
      .filter((q) => q.eq(q.field("tenantKey"), args.tenantKey))
      .collect();

    const fromTime = args.from ? Date.parse(args.from) : Number.NEGATIVE_INFINITY;
    const toTime = args.to ? Date.parse(args.to) : Number.POSITIVE_INFINITY;

    const filtered = rows
      .map((row) => row.entry)
      .filter((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
        const record = entry as Record<string, unknown>;
        if (args.actorUserId && record.actorUserId !== args.actorUserId) return false;
        if (args.resourceType && record.resourceType !== args.resourceType) return false;
        if (args.resourceId && record.resourceId !== args.resourceId) return false;
        if (args.action && record.action !== args.action) return false;

        const timestamp = typeof record.timestamp === "string" ? Date.parse(record.timestamp) : Number.NaN;
        if (Number.isFinite(fromTime) && Number.isFinite(timestamp) && timestamp < fromTime) return false;
        if (Number.isFinite(toTime) && Number.isFinite(timestamp) && timestamp > toTime) return false;
        return true;
      })
      .sort((left, right) => {
        const leftRecord = left as Record<string, unknown>;
        const rightRecord = right as Record<string, unknown>;
        const leftTimestamp = typeof leftRecord.timestamp === "string" ? Date.parse(leftRecord.timestamp) : 0;
        const rightTimestamp = typeof rightRecord.timestamp === "string" ? Date.parse(rightRecord.timestamp) : 0;
        return rightTimestamp - leftTimestamp;
      });

    const limit = typeof args.limit === "number" && Number.isFinite(args.limit)
      ? Math.max(1, Math.floor(args.limit))
      : 50;

    return filtered.slice(0, limit);
  },
});
