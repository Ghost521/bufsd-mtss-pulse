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
