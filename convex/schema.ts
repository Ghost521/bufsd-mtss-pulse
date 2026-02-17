import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tenantCollections: defineTable({
    tenantKey: v.string(),
    domain: v.string(),
    rows: v.array(v.any()),
    updatedAt: v.string(),
  }).index("by_tenant_domain", ["tenantKey", "domain"]),
  tenantAuditEntries: defineTable({
    tenantKey: v.string(),
    entry: v.any(),
    at: v.string(),
  }).index("by_tenant", ["tenantKey"]),
});
