import React, { useMemo, useState } from 'react';
import { Search, MapPin, Users, TrendingUp, AlertCircle, School } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { SchoolNode, StudentRosterItem } from '../types';
import { SidebarToggleButton } from './SidebarToggleButton';
import { useStudents } from '../hooks/useStudents';
import { useTenantCollection } from '../hooks/useTenantCollection';

interface SchoolsMapViewProps {
  onMenuClick: () => void;
}

type StudentRow = StudentRosterItem & { schoolId?: string };
type ReferralRecord = { id: string; studentId: string; urgency: string };

const SCHOOL_META: Record<
  string,
  { name: string; principal: string; type: 'Elementary' | 'Middle' | 'High'; coordinates: { x: number; y: number } }
> = {
  'sch-ne': { name: 'Northeast Elementary', principal: 'Rosa Cortese', type: 'Elementary', coordinates: { x: 25, y: 35 } },
  'sch-west': { name: 'West Middle School', principal: 'Sarah Jenkins', type: 'Middle', coordinates: { x: 65, y: 25 } },
  'sch-south': { name: 'South High School', principal: 'Marcus Thorne', type: 'High', coordinates: { x: 45, y: 75 } },
  'sch-lake': { name: 'Lakeview Elementary', principal: 'Emily Blunt', type: 'Elementary', coordinates: { x: 80, y: 60 } },
  'sch-river': { name: 'Riverbend Middle', principal: 'Andrew Myers', type: 'Middle', coordinates: { x: 18, y: 62 } },
};

const statusFromMetrics = (attendance: number, tier3Ratio: number): 'On Track' | 'Watch' | 'Critical' => {
  if (attendance < 90 || tier3Ratio > 0.12) return 'Critical';
  if (attendance < 93 || tier3Ratio > 0.08) return 'Watch';
  return 'On Track';
};

export const SchoolsMapView: React.FC<SchoolsMapViewProps> = ({ onMenuClick }) => {
  const [selectedSchool, setSelectedSchool] = useState<SchoolNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const studentsApi = useStudents('master');
  const referralsCollection = useTenantCollection<ReferralRecord>('referrals');

  const students = useMemo(
    () => (studentsApi.studentsQuery.data?.rows ?? []) as StudentRow[],
    [studentsApi.studentsQuery.data?.rows]
  );
  const referrals = useMemo(
    () => referralsCollection.query.data?.rows ?? [],
    [referralsCollection.query.data?.rows]
  );

  const schools = useMemo<SchoolNode[]>(() => {
    const grouped = new Map<string, StudentRow[]>();
    students.forEach((student) => {
      const key = student.schoolId ?? 'sch-ne';
      const list = grouped.get(key) ?? [];
      list.push(student);
      grouped.set(key, list);
    });

    return Array.from(grouped.entries()).map(([schoolId, rows]) => {
      const meta = SCHOOL_META[schoolId] ?? {
        name: schoolId,
        principal: 'School Admin',
        type: 'Elementary' as const,
        coordinates: { x: 50, y: 50 },
      };
      const studentCount = rows.length;
      const attendanceRate =
        studentCount === 0 ? 0 : Math.round(rows.reduce((sum, row) => sum + row.attendance, 0) / studentCount);
      const tier1 = rows.filter((row) => row.tier === 'Tier 1').length;
      const tier2 = rows.filter((row) => row.tier === 'Tier 2').length;
      const tier3 = rows.filter((row) => row.tier === 'Tier 3').length;
      const studentIds = new Set(rows.map((row) => row.id));
      const alerts = referrals.filter((referral) => studentIds.has(referral.studentId)).length;
      const status = statusFromMetrics(attendanceRate, tier3 / Math.max(1, studentCount));

      return {
        id: schoolId,
        name: meta.name,
        type: meta.type,
        principal: meta.principal,
        studentCount,
        attendanceRate,
        tier3Count: tier3,
        tierDistribution: [
          { name: 'Tier 1', value: tier1, color: '#34d399' },
          { name: 'Tier 2', value: tier2, color: '#facc15' },
          { name: 'Tier 3', value: tier3, color: '#f87171' },
        ],
        status,
        coordinates: meta.coordinates,
        alerts,
      };
    });
  }, [referrals, students]);

  const filteredSchools = schools.filter((school) => school.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <SidebarToggleButton onClick={onMenuClick} className="lg:hidden -ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">District Map</h2>
            <p className="mt-1 text-slate-500">Real-time status of {schools.length} schools.</p>
          </div>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Find school..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 gap-6 lg:flex">
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {filteredSchools.map((school) => (
            <button
              key={school.id}
              onClick={() => setSelectedSchool(school)}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${school.coordinates.x}%`, top: `${school.coordinates.y}%` }}
            >
              <div className="rounded-full border-4 border-white bg-indigo-600 p-3 text-white shadow-lg">
                <School size={18} />
              </div>
              <div className="mt-2 rounded-lg border border-slate-100 bg-white px-2 py-1 text-xs font-bold text-slate-700 shadow">
                {school.name}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 w-full rounded-2xl border border-slate-200 bg-white shadow-sm lg:mt-0 lg:w-96">
          {selectedSchool ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-100 p-6">
                <p className="text-xs font-bold uppercase text-slate-500">{selectedSchool.status}</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedSchool.name}</h3>
                <p className="mt-1 text-sm text-slate-500">Principal {selectedSchool.principal}</p>
              </div>
              <div className="flex-1 space-y-5 p-6">
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={selectedSchool.tierDistribution} dataKey="value" nameKey="name" innerRadius={35} outerRadius={56}>
                        {selectedSchool.tierDistribution.map((tier) => (
                          <Cell key={tier.name} fill={tier.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                    <p className="text-[10px] font-bold uppercase text-indigo-400">Attendance</p>
                    <p className="text-2xl font-bold text-indigo-900">{selectedSchool.attendanceRate}%</p>
                  </div>
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                    <p className="text-[10px] font-bold uppercase text-rose-400">Tier 3 Cases</p>
                    <p className="text-2xl font-bold text-rose-900">{selectedSchool.tier3Count}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
                  <p className="flex items-center gap-2"><Users size={14} /> Student Count: {selectedSchool.studentCount}</p>
                  <p className="mt-2 flex items-center gap-2"><AlertCircle size={14} /> Active Alerts: {selectedSchool.alerts}</p>
                  <p className="mt-2 flex items-center gap-2"><TrendingUp size={14} /> Status: {selectedSchool.status}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-500">
              <MapPin size={40} className="mb-3 opacity-30" />
              <p className="font-semibold text-slate-700">Select a School</p>
              <p className="text-sm">Click a school pin to view metrics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
