import { describe, expect, it } from "vitest";
import { BarChart2, FolderOpen, MessageSquare, School } from "lucide-react";

import { ROLE_ALLOWED_PAGES, type WorkspacePageId } from "../src/lib/workspaceRoutes";
import { ICON_SIZE_PX, getRouteIcon, iconSize, ROUTE_ICON_BY_PAGE } from "../src/lib/ui/icons";

describe("icon system", () => {
  it("covers every workspace page in canonical route icon map", () => {
    const pagesFromRoles = new Set<WorkspacePageId>(Object.values(ROLE_ALLOWED_PAGES).flat());
    const mappedPages = Object.keys(ROUTE_ICON_BY_PAGE).sort();

    expect(mappedPages).toEqual([...pagesFromRoles].sort());
  });

  it("returns expected canonical icons for key routes", () => {
    expect(getRouteIcon("messages")).toBe(MessageSquare);
    expect(getRouteIcon("map")).toBe(School);
    expect(getRouteIcon("reports")).toBe(BarChart2);
    expect(getRouteIcon("documents")).toBe(FolderOpen);
  });

  it("uses stable icon size tokens", () => {
    expect(iconSize("xs")).toBe(12);
    expect(iconSize("sm")).toBe(14);
    expect(iconSize("md")).toBe(16);
    expect(iconSize("lg")).toBe(18);
    expect(iconSize("xl")).toBe(20);
    expect(ICON_SIZE_PX).toEqual({ xs: 12, sm: 14, md: 16, lg: 18, xl: 20 });
  });
});

