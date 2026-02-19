import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useStudents, type CreateStudentPayload } from "../hooks/useStudents";
import { Tier, type StudentRosterItem } from "../types";

const columnHelper = createColumnHelper<StudentRosterItem>();

type StudentFormState = {
  name: string;
  grade: string;
  tier: Tier;
  gpa: string;
  attendance: string;
  readingLevel: string;
};

const DEFAULT_FORM: StudentFormState = {
  name: "",
  grade: "4th",
  tier: Tier.TIER_2,
  gpa: "3.0",
  attendance: "95",
  readingLevel: "M",
};

const toAttendance = (value: string): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const toCreatePayload = (form: StudentFormState): CreateStudentPayload => ({
  name: form.name.trim(),
  grade: form.grade.trim(),
  tier: form.tier,
  gpa: form.gpa.trim(),
  attendance: toAttendance(form.attendance),
  readingLevel: form.readingLevel.trim().toUpperCase(),
});

const toUpdatePatch = (form: StudentFormState): Partial<CreateStudentPayload> => ({
  name: form.name.trim(),
  grade: form.grade.trim(),
  tier: form.tier,
  gpa: form.gpa.trim(),
  attendance: toAttendance(form.attendance),
  readingLevel: form.readingLevel.trim().toUpperCase(),
});

export const Route = createFileRoute("/roster-table")({
  component: RosterTableRoute,
});

function RosterTableRoute() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [createForm, setCreateForm] = useState<StudentFormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StudentFormState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { studentsQuery, createMutation, updateMutation, deleteMutation, mutationError, resetMutationState } = useStudents("master");

  useEffect(() => {
    if (mutationError) {
      setActionError(mutationError.message);
    }
  }, [mutationError]);

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const beginEdit = (student: StudentRosterItem) => {
    setEditingId(student.id);
    setEditForm({
      name: student.name,
      grade: student.grade,
      tier: student.tier,
      gpa: student.gpa,
      attendance: String(student.attendance),
      readingLevel: student.readingLevel,
    });
    setActionError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleCreate = () => {
    const payload = toCreatePayload(createForm);
    if (!payload.name) {
      setActionError("Student name is required.");
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        setCreateForm(DEFAULT_FORM);
        setActionError(null);
      },
    });
  };

  const handleSaveEdit = () => {
    if (!editingId || !editForm) return;
    const patch = toUpdatePatch(editForm);
    if (!patch.name) {
      setActionError("Student name is required.");
      return;
    }

    updateMutation.mutate(
      { id: editingId, patch },
      {
        onSuccess: () => {
          cancelEdit();
          setActionError(null);
        },
      }
    );
  };

  const handleDelete = (student: StudentRosterItem) => {
    if (typeof window !== "undefined") {
      const approved = window.confirm(`Delete ${student.name}?`);
      if (!approved) return;
    }

    deleteMutation.mutate({ id: student.id }, { onSuccess: () => setActionError(null) });
  };

  const columns = [
    columnHelper.accessor("name", { header: "Student" }),
    columnHelper.accessor("grade", { header: "Grade" }),
    columnHelper.accessor("tier", { header: "Tier" }),
    columnHelper.accessor("gpa", { header: "GPA" }),
    columnHelper.accessor("attendance", { header: "Attendance %" }),
    columnHelper.accessor("readingLevel", { header: "Reading" }),
    columnHelper.accessor("activeInterventions", { header: "Interventions" }),
    columnHelper.accessor("alerts", { header: "Alerts" }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => beginEdit(row.original)}
            disabled={isMutating}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row.original)}
            disabled={isMutating}
            className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: studentsQuery.data?.rows ?? [],
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <main className="mx-auto max-w-[1600px] p-6 md:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Master Student Roster (TanStack Table)</h1>
        <p className="text-sm text-slate-500">
          This route uses <code>@tanstack/react-query</code> + <code>@tanstack/react-table</code> for sortable, filterable roster data.
        </p>
      </header>

      {actionError ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{actionError}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => studentsQuery.refetch()}
              className="rounded border border-rose-300 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
            >
              Retry fetch
            </button>
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                resetMutationState();
              }}
              className="rounded border border-rose-300 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Create Student</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input
            value={createForm.name}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Student name"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          />
          <input
            value={createForm.grade}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, grade: event.target.value }))}
            placeholder="Grade"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          />
          <select
            value={createForm.tier}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, tier: event.target.value as Tier }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          >
            {Object.values(Tier).map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
          <input
            value={createForm.gpa}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, gpa: event.target.value }))}
            placeholder="GPA"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          />
          <input
            value={createForm.attendance}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, attendance: event.target.value }))}
            placeholder="Attendance"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
          />
          <div className="flex gap-2">
            <input
              value={createForm.readingLevel}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, readingLevel: event.target.value }))}
              placeholder="Reading"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="rounded-lg border border-indigo-600 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </div>
      </section>

      {editingId && editForm ? (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Edit Student</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <input
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
            <input
              value={editForm.grade}
              onChange={(event) => setEditForm((prev) => (prev ? { ...prev, grade: event.target.value } : prev))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
            <select
              value={editForm.tier}
              onChange={(event) => setEditForm((prev) => (prev ? { ...prev, tier: event.target.value as Tier } : prev))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            >
              {Object.values(Tier).map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
            <input
              value={editForm.gpa}
              onChange={(event) => setEditForm((prev) => (prev ? { ...prev, gpa: event.target.value } : prev))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
            <input
              value={editForm.attendance}
              onChange={(event) => setEditForm((prev) => (prev ? { ...prev, attendance: event.target.value } : prev))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
            <div className="flex gap-2">
              <input
                value={editForm.readingLevel}
                onChange={(event) => setEditForm((prev) => (prev ? { ...prev, readingLevel: event.target.value } : prev))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
              />
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="rounded-lg border border-indigo-600 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-3">
        <input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="Filter all columns..."
          className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
        />
        <button
          onClick={() => studentsQuery.refetch()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {studentsQuery.isPending ? <p className="p-4 text-sm text-slate-600">Loading students…</p> : null}
        {studentsQuery.isError ? (
          <p className="p-4 text-sm text-rose-600">
            Error: {studentsQuery.error instanceof Error ? studentsQuery.error.message : "Unknown error"}
          </p>
        ) : null}

        {!studentsQuery.isPending && !studentsQuery.isError ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-left font-semibold text-slate-700">
                      {header.isPlaceholder ? null : (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-indigo-600"
                          type="button"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: "↑",
                            desc: "↓",
                          }[header.column.getIsSorted() as string] ?? ""}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-500">
                    No students match the current filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {"<<"}
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {"<"}
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {">"}
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}
        >
          {">>"}
        </button>
        <span>
          Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of <strong>{table.getPageCount()}</strong>
        </span>
        <span className="ml-auto">
          {studentsQuery.data?.total ?? 0} total students
        </span>
      </div>
    </main>
  );
}
