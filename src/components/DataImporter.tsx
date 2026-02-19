
import React, { useMemo, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Database,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BrainCircuit,
  ChevronRight,
  LayoutList,
  FileText,
  Image as ImageIcon,
  ClipboardPaste,
  Users,
  Link2,
} from "lucide-react";
import { read, utils } from "xlsx";
import type { ImportAnalysisResult } from "../services/geminiService";
import { analyzeImportedBatch, extractDataFromDocument } from "../services/geminiService";
import { Tier, UserRole } from "../types";
import type { StaffRosterItem } from "../types";
import { SidebarToggleButton } from "./SidebarToggleButton";

interface DataImporterProps {
  onMenuClick: () => void;
  onImportComplete?: () => void;
  currentUserRole: UserRole;
}

type ImportStep = "source" | "upload" | "mapping" | "preview" | "complete";
type SourceType = "FILE" | "PASTE" | "IREADY" | "BRANCHING_MINDS" | "POWERSCHOOL";
type ImportRow = Record<string, unknown>;

type ConnectorSource = Extract<SourceType, "IREADY" | "BRANCHING_MINDS" | "POWERSCHOOL">;
type ConnectorStatus = "not_connected" | "connecting" | "connected";

interface MappedColumn {
  sourceHeader: string;
  targetField: string;
}

interface BatchError {
  index: number;
  reason: string;
}

interface BatchCommitResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: BatchError[];
}

interface TargetField {
  id: string;
  label: string;
  required: boolean;
}

const STUDENT_TARGET_FIELDS: TargetField[] = [
  { id: "name", label: "Student Name", required: true },
  { id: "id", label: "Student ID", required: true },
  { id: "grade", label: "Grade Level", required: true },
  { id: "attendance", label: "Attendance %", required: false },
  { id: "readingLevel", label: "Reading Level", required: false },
  { id: "gpa", label: "GPA / Score", required: false },
  { id: "tier", label: "Tier", required: false },
  { id: "comments", label: "Comments / Notes", required: false },
];

const STAFF_TARGET_FIELDS: TargetField[] = [
  { id: "name", label: "Staff Name", required: true },
  { id: "id", label: "Staff ID", required: true },
  { id: "role", label: "Role (Teacher/Admin)", required: true },
  { id: "email", label: "Email Address", required: false },
  { id: "grade", label: "Assigned Grade", required: false },
  { id: "department", label: "Department", required: false },
  { id: "attendanceRate", label: "Attendance Rate", required: false },
  { id: "studentCount", label: "Student Count", required: false },
  { id: "performanceMetric", label: "Performance Metric", required: false },
  { id: "mtssFidelityScore", label: "MTSS Fidelity", required: false },
  { id: "activeInterventions", label: "Active Interventions", required: false },
  { id: "flaggedStudents", label: "Flagged Students", required: false },
];

const SOURCE_OPTIONS: Array<{ id: SourceType; label: string; desc: string; isConnector?: boolean }> = [
  { id: "FILE", label: "File Upload", desc: "CSV, XLSX, PDF, image, or Word files." },
  { id: "PASTE", label: "Paste Data", desc: "Paste directly from spreadsheets." },
  { id: "IREADY", label: "i-Ready", desc: "OAuth connection shell. Sync pipeline coming soon.", isConnector: true },
  { id: "BRANCHING_MINDS", label: "Branching Minds", desc: "OAuth connection shell. Sync pipeline coming soon.", isConnector: true },
  { id: "POWERSCHOOL", label: "PowerSchool", desc: "OAuth connection shell. Sync pipeline coming soon.", isConnector: true },
];

const CONNECTOR_SOURCES: ConnectorSource[] = ["IREADY", "BRANCHING_MINDS", "POWERSCHOOL"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toDisplayString = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const normalizeHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const buildAutoMappings = (headers: string[], targetFields: TargetField[]): MappedColumn[] =>
  headers.map((header) => {
    const normalizedHeader = normalizeHeader(header);
    const match = targetFields.find((field) => {
      const normalizedId = normalizeHeader(field.id);
      const normalizedLabel = normalizeHeader(field.label);
      return (
        normalizedHeader.includes(normalizedId) ||
        normalizedId.includes(normalizedHeader) ||
        normalizedLabel.includes(normalizedHeader)
      );
    });

    return {
      sourceHeader: header,
      targetField: match ? match.id : "",
    };
  });

const parseDelimitedRows = (raw: string): ImportRow[] => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("The file must include headers and at least one data row.");
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0]
    .split(delimiter)
    .map((header) => header.trim().replace(/^"|"$/g, ""))
    .filter((header) => header.length > 0);

  if (headers.length === 0) {
    throw new Error("Could not detect column headers in this file.");
  }

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter);
    const row: ImportRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim().replace(/^"|"$/g, "") ?? "";
    });
    return row;
  });
};

const toPreviewRows = (rows: ImportRow[]): ImportRow[] => rows.slice(0, 5);

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file contents."));
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });

const isConnectorSource = (sourceType: SourceType): sourceType is ConnectorSource =>
  CONNECTOR_SOURCES.includes(sourceType as ConnectorSource);

export const DataImporter: React.FC<DataImporterProps> = ({
  onMenuClick,
  onImportComplete,
  currentUserRole,
}) => {
  const [step, setStep] = useState<ImportStep>("source");
  const [sourceType, setSourceType] = useState<SourceType>("FILE");
  const [dataType, setDataType] = useState<"STUDENTS" | "STAFF">("STUDENTS");

  const [pastedText, setPastedText] = useState("");
  const [sourceLabel, setSourceLabel] = useState<string>("");
  const [fullData, setFullData] = useState<ImportRow[]>([]);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [mappings, setMappings] = useState<MappedColumn[]>([]);

  const [importError, setImportError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImportAnalysisResult | null>(null);

  const [isCommitting, setIsCommitting] = useState(false);
  const [commitPlannedTotal, setCommitPlannedTotal] = useState(0);
  const [commitResult, setCommitResult] = useState<BatchCommitResult | null>(null);

  const [connectorStatus, setConnectorStatus] = useState<Record<ConnectorSource, ConnectorStatus>>({
    IREADY: "not_connected",
    BRANCHING_MINDS: "not_connected",
    POWERSCHOOL: "not_connected",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canImportStaff = currentUserRole === UserRole.PRINCIPAL || currentUserRole === UserRole.DISTRICT;

  const targetFields = useMemo<TargetField[]>(
    () => (dataType === "STUDENTS" ? STUDENT_TARGET_FIELDS : STAFF_TARGET_FIELDS),
    [dataType]
  );

  const requiredTargetIds = useMemo(
    () => targetFields.filter((field) => field.required).map((field) => field.id),
    [targetFields]
  );

  const mappedTargetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    mappings.forEach((mapping) => {
      if (!mapping.targetField) return;
      counts.set(mapping.targetField, (counts.get(mapping.targetField) ?? 0) + 1);
    });
    return counts;
  }, [mappings]);

  const duplicateTargetIds = useMemo(
    () => Array.from(mappedTargetCounts.entries()).filter(([, count]) => count > 1).map(([id]) => id),
    [mappedTargetCounts]
  );

  const mappingValidationIssues = useMemo(() => {
    const issues: string[] = [];
    const mappedTargetIds = mappings
      .filter((mapping) => mapping.targetField)
      .map((mapping) => mapping.targetField);

    if (mappedTargetIds.length === 0) {
      issues.push("Map at least one source column before continuing.");
    }

    const missingRequired = requiredTargetIds.filter((required) => !mappedTargetIds.includes(required));
    if (missingRequired.length > 0) {
      const labels = missingRequired
        .map((id) => targetFields.find((field) => field.id === id)?.label ?? id)
        .join(", ");
      issues.push(`Map required fields: ${labels}.`);
    }

    if (duplicateTargetIds.length > 0) {
      const labels = duplicateTargetIds
        .map((id) => targetFields.find((field) => field.id === id)?.label ?? id)
        .join(", ");
      issues.push(`Each target field can only be mapped once. Resolve duplicates for: ${labels}.`);
    }

    return issues;
  }, [duplicateTargetIds, mappings, requiredTargetIds, targetFields]);

  const canReviewData = mappingValidationIssues.length === 0 && fullData.length > 0;
  const currentStepIndex = useMemo(() => ["source", "upload", "mapping", "preview"].indexOf(step), [step]);

  const resetImportData = () => {
    setPastedText("");
    setSourceLabel("");
    setFullData([]);
    setPreviewData([]);
    setMappings([]);
    setImportError(null);
    setCommitError(null);
    setAnalysisResult(null);
    setCommitResult(null);
    setCommitPlannedTotal(0);
    setIsExtracting(false);
    setIsAnalyzing(false);
    setIsCommitting(false);
  };

  const confirmLeaveCurrentWork = (): boolean => {
    const hasWork = fullData.length > 0 || pastedText.trim().length > 0 || mappings.length > 0;
    if (!hasWork) return true;
    return window.confirm("Leave this import flow and discard the current batch?");
  };

  const setLoadedRows = (rows: ImportRow[], label?: string) => {
    if (rows.length === 0) {
      setImportError("No records were found in this source.");
      return;
    }

    const headers = Object.keys(rows[0] ?? {});
    if (headers.length === 0) {
      setImportError("No usable headers were detected in this source.");
      return;
    }

    setImportError(null);
    setCommitError(null);
    setAnalysisResult(null);
    setCommitResult(null);
    setSourceLabel(label ?? "Imported data");
    setFullData(rows);
    setPreviewData(toPreviewRows(rows));
    setMappings(buildAutoMappings(headers, targetFields));
    setStep("mapping");
  };

  const handleSourceSelect = (type: SourceType) => {
    setSourceType(type);
    setImportError(null);
    setStep("upload");
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      setImportError("Paste your data before processing.");
      return;
    }

    try {
      const rows = parseDelimitedRows(pastedText);
      setLoadedRows(rows, "Pasted data");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not parse pasted data.");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    event.target.value = "";
    if (!uploadedFile) return;

    setImportError(null);
    setAnalysisResult(null);
    setCommitResult(null);

    const fileName = uploadedFile.name;
    const lowerName = fileName.toLowerCase();
    const isCsv =
      lowerName.endsWith(".csv") ||
      uploadedFile.type === "text/csv" ||
      uploadedFile.type === "application/vnd.ms-excel";
    const isXlsx =
      lowerName.endsWith(".xlsx") ||
      uploadedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    try {
      if (isCsv) {
        const text = await uploadedFile.text();
        const rows = parseDelimitedRows(text);
        setLoadedRows(rows, fileName);
        return;
      }

      if (isXlsx) {
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const workbook = read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("The spreadsheet does not contain any sheets.");
        }

        const firstSheet = workbook.Sheets[firstSheetName];
        const parsedRows = utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
          defval: "",
          raw: false,
        });
        const rows = parsedRows.filter(isRecord);
        if (rows.length === 0) {
          throw new Error("No rows were found in the spreadsheet.");
        }

        setLoadedRows(rows, fileName);
        return;
      }

      setIsExtracting(true);
      const base64String = await readAsDataUrl(uploadedFile);
      const base64Data = base64String.split(",")[1];
      if (!base64Data) {
        throw new Error("Could not read file contents for extraction.");
      }

      const extractedData = await extractDataFromDocument(base64Data, uploadedFile.type);
      const rows = extractedData.filter(isRecord);
      if (rows.length === 0) {
        throw new Error("No tabular records were extracted from this file.");
      }

      setLoadedRows(rows, fileName);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not process the selected file.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConnectorConnect = async (connector: ConnectorSource) => {
    if (connectorStatus[connector] === "connecting") return;

    setImportError(null);
    setIsConnecting(true);
    setConnectorStatus((prev) => ({ ...prev, [connector]: "connecting" }));

    await new Promise((resolve) => setTimeout(resolve, 1200));

    setConnectorStatus((prev) => ({ ...prev, [connector]: "connected" }));
    setIsConnecting(false);
  };

  const updateMapping = (sourceHeader: string, targetField: string) => {
    setMappings((prev) =>
      prev.map((mapping) => (mapping.sourceHeader === sourceHeader ? { ...mapping, targetField } : mapping))
    );
    if (commitError) setCommitError(null);
  };

  const runAnalysis = async () => {
    if (fullData.length === 0) {
      setImportError("Load data before running analysis.");
      return;
    }

    setIsAnalyzing(true);
    setImportError(null);
    try {
      const sample = fullData.slice(0, 100);
      const result = await analyzeImportedBatch(sample, sourceType);
      setAnalysisResult(result);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to run AI analysis right now.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getMappedValue = (row: ImportRow, targetField: string): string => {
    const mapping = mappings.find((candidate) => candidate.targetField === targetField);
    if (!mapping) return "";
    return toDisplayString(row[mapping.sourceHeader]);
  };

  const mapRowsToStudentsPayload = () =>
    fullData
      .map((row) => {
        const tierRaw = getMappedValue(row, "tier").toLowerCase();
        const tier = tierRaw.includes("3") ? Tier.TIER_3 : tierRaw.includes("2") ? Tier.TIER_2 : Tier.TIER_1;

        const attendanceRaw = Number(getMappedValue(row, "attendance"));
        const attendance = Number.isFinite(attendanceRaw)
          ? Math.max(0, Math.min(100, Math.round(attendanceRaw)))
          : 95;

        return {
          name: getMappedValue(row, "name"),
          grade: getMappedValue(row, "grade") || "4th",
          tier,
          gpa: getMappedValue(row, "gpa") || "3.0",
          attendance,
          readingLevel: getMappedValue(row, "readingLevel") || "M",
        };
      })
      .filter((row) => row.name.length > 0);

  const mapRowsToStaffPayload = (): StaffRosterItem[] =>
    fullData
      .map((row, index) => {
        const name =
          getMappedValue(row, "name") ||
          getMappedValue(row, "staffName") ||
          getMappedValue(row, "teacher");
        const roleRaw = getMappedValue(row, "role").toLowerCase();
        const role: StaffRosterItem["role"] = roleRaw.includes("consult")
          ? "Consultant"
          : roleRaw.includes("special")
            ? "Specialist"
            : "Teacher";

        const attendanceRaw = Number(
          getMappedValue(row, "attendanceRate") || getMappedValue(row, "attendance")
        );
        const fidelityRaw = Number(
          getMappedValue(row, "mtssFidelityScore") || getMappedValue(row, "fidelity")
        );
        const interventionRaw = Number(
          getMappedValue(row, "activeInterventions") || getMappedValue(row, "interventions")
        );
        const flaggedRaw = Number(getMappedValue(row, "flaggedStudents") || getMappedValue(row, "flags"));
        const studentCountRaw = Number(getMappedValue(row, "studentCount") || getMappedValue(row, "caseload"));

        return {
          id: getMappedValue(row, "id") || `staff-${Date.now()}-${index}`,
          name,
          role,
          grade: getMappedValue(row, "grade") || getMappedValue(row, "department") || undefined,
          studentCount: Number.isFinite(studentCountRaw) ? Math.max(0, Math.round(studentCountRaw)) : 0,
          attendanceRate: Number.isFinite(attendanceRaw)
            ? Math.max(0, Math.min(100, Math.round(attendanceRaw)))
            : 95,
          performanceMetric:
            getMappedValue(row, "performanceMetric") ||
            getMappedValue(row, "performance") ||
            "Imported staff record",
          mtssFidelityScore: Number.isFinite(fidelityRaw)
            ? Math.max(0, Math.min(100, Math.round(fidelityRaw)))
            : 85,
          activeInterventions: Number.isFinite(interventionRaw) ? Math.max(0, Math.round(interventionRaw)) : 0,
          flaggedStudents: Number.isFinite(flaggedRaw) ? Math.max(0, Math.round(flaggedRaw)) : 0,
          avatarSeed: name ? name.replace(/\s+/g, "") : `Staff${index + 1}`,
        };
      })
      .filter((row) => row.name.length > 0);

  const handleFinishImport = async () => {
    setCommitError(null);
    setImportError(null);
    setCommitResult(null);

    const payloadRows = dataType === "STUDENTS" ? mapRowsToStudentsPayload() : mapRowsToStaffPayload();
    if (payloadRows.length === 0) {
      setCommitError("No valid mapped rows were found to import.");
      return;
    }

    setIsCommitting(true);
    setCommitPlannedTotal(payloadRows.length);

    try {
      const response = await fetch(dataType === "STUDENTS" ? "/api/students" : "/api/data/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payloadRows }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        total?: number;
        succeeded?: number;
        failed?: number;
        errors?: BatchError[];
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Import commit failed.");
      }

      const total = typeof payload?.total === "number" ? payload.total : payloadRows.length;
      const succeeded = typeof payload?.succeeded === "number" ? payload.succeeded : total;
      const failed = typeof payload?.failed === "number" ? payload.failed : Math.max(0, total - succeeded);
      const errors = Array.isArray(payload?.errors) ? payload.errors : [];

      setCommitResult({ total, succeeded, failed, errors });
      setStep("complete");
    } catch (error) {
      setCommitError(error instanceof Error ? error.message : "Import commit failed.");
    } finally {
      setIsCommitting(false);
      setCommitPlannedTotal(0);
    }
  };

  const getSourceIcon = (type: SourceType) => {
    switch (type) {
      case "FILE":
        return (
          <div className="flex gap-1 justify-center">
            <FileText size={24} className="text-indigo-600" />
            <ImageIcon size={24} className="text-emerald-600" />
            <FileSpreadsheet size={24} className="text-blue-600" />
          </div>
        );
      case "PASTE":
        return (
          <div className="text-2xl font-bold text-slate-600">
            <ClipboardPaste size={32} />
          </div>
        );
      case "IREADY":
        return <div className="text-2xl font-bold text-blue-600">i-Ready</div>;
      case "BRANCHING_MINDS":
        return (
          <div className="text-xl font-bold text-indigo-600">
            Branching
            <br />
            Minds
          </div>
        );
      case "POWERSCHOOL":
        return <div className="text-xl font-bold text-slate-700">PowerSchool</div>;
      default:
        return <Database size={32} />;
    }
  };

  const connectorSource = isConnectorSource(sourceType) ? sourceType : null;

  return (
    <div className="app-responsive-pane flex h-full min-w-0 flex-col bg-white animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-4 sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarToggleButton
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-slate-600 transition-colors hover:bg-slate-100 rounded-lg"
          />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Data Import</h2>
            <p className="text-slate-500 text-sm">
              Import student or staff records from files, pasted data, or connected systems.
            </p>
          </div>
        </div>

        <div className="hidden md:flex md:flex-wrap md:items-center md:justify-end md:gap-2">
          {["Select Source", "Load Data", "Map Columns", "Review"].map((label, idx) => {
            const isActive = currentStepIndex === idx;
            const isCompleted = currentStepIndex > idx;

            return (
              <React.Fragment key={label}>
                <div
                  className={`flex items-center gap-2 ${
                    isActive
                      ? "text-indigo-600 font-bold"
                      : isCompleted
                        ? "text-emerald-600"
                        : "text-slate-300"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${
                      isActive
                        ? "border-indigo-600 bg-indigo-50"
                        : isCompleted
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-slate-300"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
                  </div>
                  <span className="text-sm">{label}</span>
                </div>
                {idx < 3 && <div className="w-8 h-px bg-slate-200" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500 md:hidden sm:px-6">
        Step {Math.max(1, currentStepIndex + 1)} of 4
      </div>

      <div className="app-responsive-content flex-1 bg-slate-50/30 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {importError && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {step === "source" && (
            <div className="space-y-6">
              <div className="flex justify-center mb-4">
                <div className="bg-slate-200 p-1 rounded-xl flex">
                  <button
                    type="button"
                    onClick={() => setDataType("STUDENTS")}
                    className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                      dataType === "STUDENTS"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    <LayoutList size={16} /> Student Roster
                  </button>
                  {canImportStaff && (
                    <button
                      type="button"
                      onClick={() => setDataType("STAFF")}
                      className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                        dataType === "STAFF"
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      <Users size={16} /> Staff Roster
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSourceSelect(option.id)}
                    className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all group text-center h-52"
                  >
                    <div className="mb-4 opacity-80 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-300">
                      {getSourceIcon(option.id)}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-700">
                      {option.label}
                    </h3>
                    <p className="text-sm text-slate-500 mt-2">{option.desc}</p>
                    {option.isConnector && (
                      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Link2 size={12} /> OAuth Shell
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
              {sourceType === "FILE" ? (
                <>
                  {isExtracting ? (
                    <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-indigo-100 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 border-t-4 border-indigo-600 rounded-full animate-spin"></div>
                        <BrainCircuit size={24} className="absolute inset-0 m-auto text-indigo-500 animate-pulse" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-bold text-indigo-900">Extracting Tabular Data</h3>
                        <p className="text-sm text-indigo-600">
                          Reading document contents and preparing records...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-6">
                        <Upload size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
                        Upload {dataType === "STUDENTS" ? "Student" : "Staff"} Data File
                      </h3>
                      <p className="text-slate-500 mb-8 text-center max-w-sm">
                        Drag and drop or click to browse.
                        <br />
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded mt-2 inline-block">
                          Supports: CSV, XLSX, PDF, image, DOCX, DOC
                        </span>
                      </p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(event) => {
                          void handleFileUpload(event);
                        }}
                        accept=".csv,.xlsx,.pdf,image/*,.docx,.doc"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-all"
                      >
                        Select File
                      </button>
                    </>
                  )}
                </>
              ) : sourceType === "PASTE" ? (
                <div className="w-full max-w-2xl px-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <ClipboardPaste size={24} className="text-indigo-600" />
                    Paste Data
                  </h3>
                  <p className="text-slate-500 mb-4 text-sm">
                    Paste rows from Excel or Google Sheets. The first row must contain headers.
                  </p>
                  <textarea
                    value={pastedText}
                    onChange={(event) => setPastedText(event.target.value)}
                    className="w-full h-64 p-4 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none mb-4"
                    placeholder={`Name\tID\tGrade\nJohn Doe\t123\t4th\nJane Smith\t124\t4th`}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handlePasteSubmit}
                      disabled={!pastedText.trim()}
                      className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      Process Data
                    </button>
                  </div>
                </div>
              ) : connectorSource ? (
                <div className="w-full max-w-xl px-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Link2 size={18} className="text-indigo-600" /> {sourceType.replace("_", " ")} OAuth Connection
                      </h3>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                          connectorStatus[connectorSource] === "connected"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : connectorStatus[connectorSource] === "connecting"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {connectorStatus[connectorSource] === "connected"
                          ? "Connected"
                          : connectorStatus[connectorSource] === "connecting"
                            ? "Connecting"
                            : "Not connected"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      This release includes the connection shell only. Scheduled sync and live data pull are coming
                      soon.
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      Use File Upload or Paste Data for immediate imports.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleConnectorConnect(connectorSource);
                        }}
                        disabled={connectorStatus[connectorSource] === "connecting" || isConnecting}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
                      >
                        {connectorStatus[connectorSource] === "connecting" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Link2 size={14} />
                        )}
                        {connectorStatus[connectorSource] === "connected"
                          ? "Reconnect Account"
                          : "Connect Account"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSourceType("FILE");
                          setImportError(null);
                        }}
                        className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-white"
                      >
                        Upload File Instead
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSourceType("PASTE");
                          setImportError(null);
                        }}
                        className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-white"
                      >
                        Paste Data Instead
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {!isExtracting && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmLeaveCurrentWork()) return;
                    resetImportData();
                    setStep("source");
                  }}
                  className="mt-8 text-slate-400 hover:text-slate-600 text-sm"
                >
                  Back to Source Selection
                </button>
              )}
            </div>
          )}

          {step === "mapping" && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Map Columns</h3>
                <p className="text-sm text-slate-500">
                  Match source fields to BUFSD {dataType === "STUDENTS" ? "student" : "staff"} fields.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Loaded {fullData.length} rows{sourceLabel ? ` from ${sourceLabel}` : ""}.
                </p>
              </div>

              {mappingValidationIssues.length > 0 && (
                <div className="mx-6 mt-4 p-3 rounded-lg border border-amber-100 bg-amber-50 text-amber-800 text-sm">
                  <p className="font-semibold mb-1">Fix these mapping issues before review:</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {mappingValidationIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-6 space-y-4">
                {mappings.map((mapping, index) => {
                  const isDuplicate = Boolean(mapping.targetField) && duplicateTargetIds.includes(mapping.targetField);
                  return (
                    <div
                      key={`${mapping.sourceHeader}-${index}`}
                      className={`flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:gap-4 ${
                        isDuplicate ? "border-rose-200 bg-rose-50" : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                          Source Header
                        </label>
                        <div className="truncate text-sm font-medium text-slate-700">{mapping.sourceHeader}</div>
                      </div>
                      <ArrowRight size={16} className="hidden text-slate-300 md:block" />
                      <div className="min-w-0 flex-1">
                        <label className="text-xs font-bold text-indigo-500 uppercase block mb-1">
                          Target Field
                        </label>
                        <select
                          value={mapping.targetField}
                          onChange={(event) => updateMapping(mapping.sourceHeader, event.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">-- Ignore --</option>
                          {targetFields.map((field) => (
                            <option key={field.id} value={field.id}>
                              {field.label}
                              {field.required ? " *" : ""}
                            </option>
                          ))}
                        </select>
                        {isDuplicate && (
                          <p className="mt-1 text-xs text-rose-700">
                            This target field is mapped more than once.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmLeaveCurrentWork()) return;
                    resetImportData();
                    setStep("source");
                  }}
                  className="px-4 py-2 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep("preview")}
                  disabled={!canReviewData}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  Review Data
                </button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <LayoutList size={18} className="text-indigo-500" /> Data Preview
                  </h3>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {fullData.length} Rows Ready
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                      <tr>
                        {mappings
                          .filter((mapping) => mapping.targetField)
                          .map((mapping) => (
                            <th key={mapping.sourceHeader} className="px-4 py-3 border-b border-slate-200">
                              {mapping.targetField}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-slate-50">
                          {mappings
                            .filter((mapping) => mapping.targetField)
                            .map((mapping) => (
                              <td key={mapping.sourceHeader} className="px-4 py-3 text-slate-700">
                                {String(row[mapping.sourceHeader] ?? "")}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 text-xs text-center text-slate-400 italic bg-slate-50 border-t border-slate-100">
                    Showing first 5 rows only. Import will process all {fullData.length} rows.
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100 p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <BrainCircuit size={120} />
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-indigo-900">Pre-Import AI Analysis</h3>
                      <p className="text-sm text-indigo-700/80">Analyze a sample of this batch before commit.</p>
                    </div>
                    {!analysisResult && (
                      <button
                        type="button"
                        onClick={() => {
                          void runAnalysis();
                        }}
                        disabled={isAnalyzing}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2"
                      >
                        {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                        Run Analysis
                      </button>
                    )}
                  </div>

                  {isAnalyzing && (
                    <div className="py-8 flex flex-col items-center justify-center text-indigo-600 gap-3">
                      <Loader2 size={32} className="animate-spin" />
                      <p className="text-sm font-medium">Detecting trends and anomalies...</p>
                    </div>
                  )}

                  {analysisResult && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                      <div className="p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-indigo-100">
                        <p className="text-sm text-slate-800 leading-relaxed font-medium">{analysisResult.summary}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-rose-50 rounded-lg border border-rose-100">
                          <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <AlertCircle size={14} /> Anomalies Detected
                          </h4>
                          <ul className="list-disc pl-4 space-y-1">
                            {analysisResult.anomalies.map((anomaly, index) => (
                              <li key={index} className="text-xs text-rose-800">
                                {anomaly}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                          <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <CheckCircle2 size={14} /> Recommendations
                          </h4>
                          <ul className="list-disc pl-4 space-y-1">
                            {analysisResult.recommendations.map((recommendation, index) => (
                              <li key={index} className="text-xs text-emerald-800">
                                {recommendation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {commitError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {commitError}
                </div>
              )}

              <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep("mapping")}
                  className="px-6 py-2.5 text-slate-600 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleFinishImport();
                  }}
                  disabled={isCommitting}
                  className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCommitting ? `Committing ${commitPlannedTotal} rows...` : "Confirm Import"}{" "}
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === "complete" && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300 ${
                  commitResult?.failed ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                }`}
              >
                {commitResult?.failed ? <AlertCircle size={44} /> : <CheckCircle2 size={48} />}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                {commitResult?.failed ? "Import Completed with Issues" : "Import Successful"}
              </h3>
              <p className="text-slate-500 mb-4">
                {commitResult?.succeeded ?? 0} of {commitResult?.total ?? 0} records were imported.
              </p>

              {commitResult && commitResult.failed > 0 && (
                <div className="w-full max-w-2xl text-left mb-8 p-4 border border-amber-100 bg-amber-50 rounded-xl">
                  <p className="text-sm font-semibold text-amber-800 mb-2">Failed rows: {commitResult.failed}</p>
                  <ul className="space-y-1 text-sm text-amber-900 max-h-48 overflow-y-auto pr-1">
                    {commitResult.errors.slice(0, 12).map((errorItem) => (
                      <li key={`${errorItem.index}-${errorItem.reason}`}>
                        Row {errorItem.index + 1}: {errorItem.reason}
                      </li>
                    ))}
                    {commitResult.errors.length > 12 && (
                      <li className="text-amber-700">+ {commitResult.errors.length - 12} more errors.</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    resetImportData();
                    setStep("source");
                  }}
                  className="px-8 py-3 bg-slate-900 text-white rounded-lg font-bold shadow-md hover:bg-slate-800"
                >
                  Import Another Batch
                </button>
                {onImportComplete && (
                  <button
                    type="button"
                    onClick={onImportComplete}
                    className="px-8 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg font-semibold hover:bg-slate-50"
                  >
                    Back to Dashboard
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
