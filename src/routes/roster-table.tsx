import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import type { StudentRosterItem } from "../types";

type StudentsResponse = {
  rows: StudentRosterItem[];
  total: number;
};

const columnHelper = createColumnHelper<StudentRosterItem>();

export const Route = createFileRoute("/roster-table")({
  component: RosterTableRoute,
});

function RosterTableRoute() {
  const [globalFilter, setGlobalFilter] = useState("");

  const studentsQuery = useQuery({
    queryKey: ["students", "master"],
    queryFn: async () => {
      const response = await fetch("/api/students?scope=master");
      if (!response.ok) {
        throw new Error(`Students endpoint failed (${response.status})`);
      }
      return (await response.json()) as StudentsResponse;
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", { header: "Student" }),
      columnHelper.accessor("grade", { header: "Grade" }),
      columnHelper.accessor("tier", { header: "Tier" }),
      columnHelper.accessor("gpa", { header: "GPA" }),
      columnHelper.accessor("attendance", { header: "Attendance %" }),
      columnHelper.accessor("readingLevel", { header: "Reading" }),
      columnHelper.accessor("activeInterventions", { header: "Interventions" }),
      columnHelper.accessor("alerts", { header: "Alerts" }),
    ],
    []
  );

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
