import React, { useEffect, useMemo, useState } from "react";
import { Search, MapPin, Users, TrendingUp, AlertCircle, School, List, Map as MapIcon, MessageSquare, CalendarDays, FileText } from "lucide-react";
import type { StudentRosterItem } from "../types";
import type { WorkspacePageId } from "../lib/workspaceRoutes";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { useStudents } from "../hooks/useStudents";
import { useTenantCollection } from "../hooks/useTenantCollection";
import { useSchools } from "../hooks/useSchools";
import { Button } from "./ui/Button";
import { SimpleDonutChart } from "./SimpleCharts";

interface SchoolsMapViewProps {
  onMenuClick: () => void;
  onNavigate?: (page: WorkspacePageId) => void;
}

type StudentRow = StudentRosterItem & { schoolId?: string };
type ReferralRecord = { id: string; studentId: string; urgency: string };
type SchoolStatus = "On Track" | "Watch" | "Critical";

type SchoolViewModel = {
  id: string;
  districtId: string;
  name: string;
  type: "Elementary" | "Middle" | "High";
  principal: string;
  studentCount: number;
  attendanceRate: number;
  tier3Count: number;
  tierDistribution: Array<{ name: "Tier 1" | "Tier 2" | "Tier 3"; value: number; color: string }>;
  status: SchoolStatus;
  alerts: number;
  latitude: number | null;
  longitude: number | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

type MapBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

const statusFromMetrics = (attendance: number, tier3Ratio: number): SchoolStatus => {
  if (attendance < 90 || tier3Ratio > 0.12) return "Critical";
  if (attendance < 93 || tier3Ratio > 0.08) return "Watch";
  return "On Track";
};

const statusColorTokens: Record<SchoolStatus, { marker: string; badge: string; text: string }> = {
  "On Track": {
    marker: "bg-emerald-600",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    text: "text-emerald-700",
  },
  Watch: {
    marker: "bg-amber-500",
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    text: "text-amber-700",
  },
  Critical: {
    marker: "bg-rose-600",
    badge: "bg-rose-100 text-rose-900 border-rose-200",
    text: "text-rose-700",
  },
};

const tierColors = {
  tier1: "#10b981",
  tier2: "#f59e0b",
  tier3: "#ef4444",
};

const toAddressLabel = (school: SchoolViewModel): string => {
  const parts = [school.addressLine1, school.city, school.state, school.postalCode]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : "Address unavailable";
};

const toQueryErrorMessage = (value: unknown, fallback: string): string => {
  if (value instanceof Error && value.message.trim().length > 0) return value.message;
  return fallback;
};

const toValidCoordinate = (value: number | null | undefined, min: number, max: number): number | null => {
  if (!Number.isFinite(value)) return null;
  const candidate = value as number;
  if (candidate < min || candidate > max) return null;
  return candidate;
};

const withMapPadding = (bounds: MapBounds): MapBounds => {
  const latSpan = Math.max(0.06, bounds.maxLat - bounds.minLat);
  const lngSpan = Math.max(0.06, bounds.maxLng - bounds.minLng);
  const latPad = latSpan * 0.2;
  const lngPad = lngSpan * 0.2;
  return {
    minLat: bounds.minLat - latPad,
    maxLat: bounds.maxLat + latPad,
    minLng: bounds.minLng - lngPad,
    maxLng: bounds.maxLng + lngPad,
  };
};

const buildOsmEmbedUrl = (bounds: MapBounds): string => {
  const params = new URLSearchParams({
    bbox: `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}`,
    layer: "mapnik",
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
};

export const SchoolsMapView: React.FC<SchoolsMapViewProps> = ({ onMenuClick, onNavigate }) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMode, setMobileMode] = useState<"map" | "list">("map");

  const studentsApi = useStudents("master");
  const referralsCollection = useTenantCollection<ReferralRecord>("referrals");
  const schoolsQuery = useSchools();

  const students = useMemo(
    () => (studentsApi.studentsQuery.data?.rows ?? []) as StudentRow[],
    [studentsApi.studentsQuery.data?.rows]
  );
  const referrals = useMemo(
    () => referralsCollection.query.data?.rows ?? [],
    [referralsCollection.query.data?.rows]
  );
  const schoolDirectory = useMemo(
    () => schoolsQuery.data?.rows ?? [],
    [schoolsQuery.data?.rows]
  );

  const schools = useMemo<SchoolViewModel[]>(() => {
    const bySchool = new Map<string, StudentRow[]>();
    students.forEach((student) => {
      const schoolId = student.schoolId?.trim() || "unmapped";
      const bucket = bySchool.get(schoolId) ?? [];
      bucket.push(student);
      bySchool.set(schoolId, bucket);
    });

    const studentSchoolById = new Map<string, string>(
      students.map((student): [string, string] => [student.id, student.schoolId?.trim() || "unmapped"])
    );
    const alertsBySchool = new Map<string, number>();
    referrals.forEach((referral) => {
      const schoolId = studentSchoolById.get(referral.studentId);
      if (!schoolId) return;
      alertsBySchool.set(schoolId, (alertsBySchool.get(schoolId) ?? 0) + 1);
    });

    const nodes: SchoolViewModel[] = schoolDirectory.map((school) => {
      const rows = bySchool.get(school.id) ?? [];
      const studentCount = rows.length;
      const attendanceRate =
        studentCount === 0 ? 0 : Math.round(rows.reduce((sum, row) => sum + row.attendance, 0) / studentCount);
      const tier1 = rows.filter((row) => row.tier === "Tier 1").length;
      const tier2 = rows.filter((row) => row.tier === "Tier 2").length;
      const tier3 = rows.filter((row) => row.tier === "Tier 3").length;
      const status = statusFromMetrics(attendanceRate, tier3 / Math.max(1, studentCount));

      return {
        id: school.id,
        districtId: school.districtId,
        name: school.name,
        type: school.type,
        principal: school.principalName,
        studentCount,
        attendanceRate,
        tier3Count: tier3,
        tierDistribution: [
          { name: "Tier 1", value: tier1, color: tierColors.tier1 },
          { name: "Tier 2", value: tier2, color: tierColors.tier2 },
          { name: "Tier 3", value: tier3, color: tierColors.tier3 },
        ],
        status,
        alerts: alertsBySchool.get(school.id) ?? 0,
        latitude: toValidCoordinate(school.latitude, -90, 90),
        longitude: toValidCoordinate(school.longitude, -180, 180),
        addressLine1: school.addressLine1,
        city: school.city,
        state: school.state,
        postalCode: school.postalCode,
      };
    });

    bySchool.forEach((rows, schoolId) => {
      if (schoolDirectory.some((school) => school.id === schoolId)) return;
      const studentCount = rows.length;
      const attendanceRate =
        studentCount === 0 ? 0 : Math.round(rows.reduce((sum, row) => sum + row.attendance, 0) / studentCount);
      const tier1 = rows.filter((row) => row.tier === "Tier 1").length;
      const tier2 = rows.filter((row) => row.tier === "Tier 2").length;
      const tier3 = rows.filter((row) => row.tier === "Tier 3").length;
      nodes.push({
        id: schoolId,
        districtId: "unknown",
        name: schoolId === "unmapped" ? "Unmapped School" : schoolId,
        type: "Elementary",
        principal: "No principal assigned",
        studentCount,
        attendanceRate,
        tier3Count: tier3,
        tierDistribution: [
          { name: "Tier 1", value: tier1, color: tierColors.tier1 },
          { name: "Tier 2", value: tier2, color: tierColors.tier2 },
          { name: "Tier 3", value: tier3, color: tierColors.tier3 },
        ],
        status: statusFromMetrics(attendanceRate, tier3 / Math.max(1, studentCount)),
        alerts: alertsBySchool.get(schoolId) ?? 0,
        latitude: null,
        longitude: null,
        addressLine1: null,
        city: null,
        state: null,
        postalCode: null,
      });
    });

    return nodes.sort((left, right) => left.name.localeCompare(right.name));
  }, [referrals, schoolDirectory, students]);

  const filteredSchools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return schools;
    return schools.filter((school) => {
      const haystack = `${school.name} ${school.principal} ${toAddressLabel(school)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [schools, searchQuery]);

  const schoolsWithCoordinates = useMemo(
    () => filteredSchools.filter((school) => school.latitude !== null && school.longitude !== null),
    [filteredSchools]
  );

  const mapBounds = useMemo<MapBounds | null>(() => {
    if (schoolsWithCoordinates.length === 0) return null;
    const latitudes = schoolsWithCoordinates.map((school) => school.latitude as number);
    const longitudes = schoolsWithCoordinates.map((school) => school.longitude as number);
    return withMapPadding({
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLng: Math.min(...longitudes),
      maxLng: Math.max(...longitudes),
    });
  }, [schoolsWithCoordinates]);

  const markerPositions = useMemo(() => {
    if (!mapBounds) return [];
    const latSpan = Math.max(0.000001, mapBounds.maxLat - mapBounds.minLat);
    const lngSpan = Math.max(0.000001, mapBounds.maxLng - mapBounds.minLng);
    return schoolsWithCoordinates.map((school) => {
      const latitude = school.latitude as number;
      const longitude = school.longitude as number;
      return {
        school,
        left: ((longitude - mapBounds.minLng) / lngSpan) * 100,
        top: ((mapBounds.maxLat - latitude) / latSpan) * 100,
      };
    });
  }, [mapBounds, schoolsWithCoordinates]);

  const selectedSchool = useMemo(
    () => filteredSchools.find((school) => school.id === selectedSchoolId) ?? null,
    [filteredSchools, selectedSchoolId]
  );

  useEffect(() => {
    if (selectedSchoolId && filteredSchools.some((school) => school.id === selectedSchoolId)) return;
    setSelectedSchoolId(filteredSchools[0]?.id ?? null);
  }, [filteredSchools, selectedSchoolId]);

  const isLoading = schoolsQuery.isLoading || studentsApi.studentsQuery.isLoading || referralsCollection.query.isLoading;
  const errorMessage =
    (schoolsQuery.isError && toQueryErrorMessage(schoolsQuery.error, "Unable to load school directory.")) ||
    (studentsApi.studentsQuery.isError && toQueryErrorMessage(studentsApi.studentsQuery.error, "Unable to load student metrics.")) ||
    (referralsCollection.query.isError && toQueryErrorMessage(referralsCollection.query.error, "Unable to load referral alerts.")) ||
    null;

  return (
    <div className="flex min-h-[calc(100vh-130px)] flex-col">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <SidebarToggleButton
            onClick={onMenuClick}
            className="lg:hidden -ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">District Map</h2>
            <p className="mt-1 text-sm text-slate-600">
              Address-based view of {schools.length} schools with live MTSS risk indicators.
            </p>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search school, principal, or address"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMode("map")}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${mobileMode === "map" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              <span className="inline-flex items-center gap-1">
                <MapIcon size={12} />
                Map
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMode("list")}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${mobileMode === "list" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              <span className="inline-flex items-center gap-1">
                <List size={12} />
                List
              </span>
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[420px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100 lg:h-full" />
          <div className="h-[420px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100 lg:h-full" />
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <p className="text-sm font-semibold">Could not load district map.</p>
          <p className="mt-1 text-sm">{errorMessage}</p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => {
              void schoolsQuery.refetch();
              void studentsApi.studentsQuery.refetch();
              void referralsCollection.query.refetch();
            }}
          >
            Try Again
          </Button>
        </div>
      ) : schools.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <School size={28} className="text-slate-400" />
          <p className="mt-3 text-base font-semibold text-slate-800">No schools are available for this tenant scope.</p>
          <p className="mt-1 text-sm text-slate-600">Once school records are provisioned, they will appear on this map.</p>
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Search size={28} className="text-slate-400" />
          <p className="mt-3 text-base font-semibold text-slate-800">No schools match your search.</p>
          <p className="mt-1 text-sm text-slate-600">Try a school name, principal name, or city/state.</p>
        </div>
      ) : (
        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className={`${mobileMode === "list" ? "hidden md:block" : ""}`}>
            <div className="relative h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm lg:h-full">
              {mapBounds ? (
                <>
                  <iframe
                    title="District schools map"
                    src={buildOsmEmbedUrl(mapBounds)}
                    className="h-full w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="pointer-events-none absolute inset-0">
                    {markerPositions.map(({ school, left, top }) => {
                      const tokens = statusColorTokens[school.status];
                      const isSelected = school.id === selectedSchoolId;
                      return (
                        <button
                          key={school.id}
                          type="button"
                          onClick={() => setSelectedSchoolId(school.id)}
                          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                          style={{ left: `${left}%`, top: `${top}%` }}
                          aria-label={`${school.name}, ${school.status}, ${school.studentCount} students`}
                          aria-pressed={isSelected}
                        >
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-white shadow-lg ${tokens.marker} ${
                              isSelected ? "ring-4 ring-white/90 ring-offset-2 ring-offset-black/20" : ""
                            }`}
                          >
                            <School size={15} />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="absolute bottom-3 left-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">School Status</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                        On Track
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        Watch
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                        Critical
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
                  <MapPin size={34} className="opacity-40" />
                  <p className="mt-3 text-base font-semibold text-slate-700">Map coordinates unavailable</p>
                  <p className="mt-1 text-sm">Add school addresses or coordinates in district configuration.</p>
                </div>
              )}
            </div>
          </div>

          <div className={`flex min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm ${mobileMode === "map" ? "hidden md:flex" : "flex"}`}>
            {selectedSchool ? (
              <>
                <div className="border-b border-slate-100 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{selectedSchool.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">{selectedSchool.type}</p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusColorTokens[selectedSchool.status].badge}`}
                    >
                      {selectedSchool.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">Principal: {selectedSchool.principal}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin size={13} />
                    {toAddressLabel(selectedSchool)}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 border-b border-slate-100 p-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-600">Attendance</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{selectedSchool.attendanceRate}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-600">Tier 3</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{selectedSchool.tier3Count}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-600">Alerts</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{selectedSchool.alerts}</p>
                  </div>
                </div>

                <div className="grid flex-1 gap-3 p-4 sm:grid-cols-[1fr_auto]">
                  <div className="flex h-40 items-center justify-center">
                    <SimpleDonutChart
                      data={selectedSchool.tierDistribution.map((tier) => ({
                        name: tier.name,
                        value: tier.value,
                        color: tier.color,
                      }))}
                      size={144}
                      strokeWidth={22}
                    />
                  </div>
                  <div className="space-y-2 text-xs text-slate-700">
                    {selectedSchool.tierDistribution.map((tier) => (
                      <p key={tier.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tier.color }} />
                        {tier.name}: <strong>{tier.value}</strong>
                      </p>
                    ))}
                    <p className={`pt-2 text-xs font-semibold ${statusColorTokens[selectedSchool.status].text}`}>
                      Risk status: {selectedSchool.status}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<TrendingUp size={14} />}
                    onClick={() => onNavigate?.("reports")}
                    disabled={!onNavigate}
                  >
                    Reports
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<MessageSquare size={14} />}
                    onClick={() => onNavigate?.("messages")}
                    disabled={!onNavigate}
                  >
                    Message Team
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<CalendarDays size={14} />}
                    onClick={() => onNavigate?.("calendar")}
                    disabled={!onNavigate}
                  >
                    Calendar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<FileText size={14} />}
                    onClick={() => onNavigate?.("documents")}
                    disabled={!onNavigate}
                  >
                    Documents
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
                <MapPin size={36} className="mb-2 opacity-35" />
                <p className="font-semibold text-slate-700">Select a school</p>
                <p className="mt-1 text-sm">Choose a map marker or list row to view details.</p>
              </div>
            )}
          </div>

          <div className={`rounded-2xl border border-slate-200 bg-white p-3 md:hidden ${mobileMode === "list" ? "block" : "hidden"}`}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schools</p>
              <p className="text-xs text-slate-500">{filteredSchools.length}</p>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {filteredSchools.map((school) => {
                const isSelected = school.id === selectedSchoolId;
                return (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => {
                      setSelectedSchoolId(school.id);
                      setMobileMode("list");
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${isSelected ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"}`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{school.name}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{toAddressLabel(school)}</p>
                    <p className="mt-1 text-xs text-slate-700">
                      {school.studentCount} students • {school.tier3Count} Tier 3 • {school.attendanceRate}% attendance
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <Users size={13} />
          Students: {filteredSchools.reduce((sum, school) => sum + school.studentCount, 0)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <AlertCircle size={13} />
          Alerts: {filteredSchools.reduce((sum, school) => sum + school.alerts, 0)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={13} />
          Address-mapped schools: {schoolsWithCoordinates.length}/{filteredSchools.length}
        </span>
      </div>
    </div>
  );
};
