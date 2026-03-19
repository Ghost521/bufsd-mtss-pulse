import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tenantCollections: defineTable({
    tenantKey: v.string(),
    domain: v.string(),
    rows: v.array(v.any()),
    updatedAt: v.string(),
  }).index("by_tenant_domain", ["tenantKey", "domain"]),
  tenantInterventionRecords: defineTable({
    tenantKey: v.string(),
    interventionId: v.string(),
    row: v.any(),
    position: v.number(),
    updatedAt: v.string(),
  })
    .index("by_tenant", ["tenantKey"])
    .index("by_tenant_intervention", ["tenantKey", "interventionId"]),
  tenantCalendarRecords: defineTable({
    tenantKey: v.string(),
    eventId: v.string(),
    row: v.any(),
    position: v.number(),
    updatedAt: v.string(),
  })
    .index("by_tenant", ["tenantKey"])
    .index("by_tenant_event", ["tenantKey", "eventId"]),
  tenantReferralRecords: defineTable({
    tenantKey: v.string(),
    referralId: v.string(),
    row: v.any(),
    position: v.number(),
    updatedAt: v.string(),
  })
    .index("by_tenant", ["tenantKey"])
    .index("by_tenant_referral", ["tenantKey", "referralId"]),
  tenantStudentRecords: defineTable({
    tenantKey: v.string(),
    scope: v.string(),
    studentId: v.string(),
    row: v.any(),
    updatedAt: v.string(),
  })
    .index("by_tenant_scope", ["tenantKey", "scope"])
    .index("by_tenant_scope_student", ["tenantKey", "scope", "studentId"]),
  tenantAuditEntries: defineTable({
    tenantKey: v.string(),
    entry: v.any(),
    at: v.string(),
  }).index("by_tenant", ["tenantKey"]),
});
