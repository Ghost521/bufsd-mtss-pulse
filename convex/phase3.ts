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
