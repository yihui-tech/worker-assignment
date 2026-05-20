'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Worker = {
  employee_id: string;
  name: string;
  role: string;
};

type Project = {
  id: string;
  name: string;
  location: string;
};

type ShiftAssignment = {
  project_id: string;
  assignment_id?: string;
};

type WorkerAssignment = {
  mode: 'full_day' | 'split';
  full_day: ShiftAssignment;
  morning: ShiftAssignment;
  afternoon: ShiftAssignment;
};

type AssignmentMap = Record<string, WorkerAssignment>;

const emptyShift = (): ShiftAssignment => ({ project_id: '' });

const emptyAssignment = (): WorkerAssignment => ({
  mode: 'full_day',
  full_day: emptyShift(),
  morning: emptyShift(),
  afternoon: emptyShift(),
});

export default function AssignmentsPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<AssignmentMap>({});
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [w, p] = await Promise.all([
        supabase.from('workers').select('employee_id, name, role').eq('active', true).order('name'),
        supabase.from('projects').select('id, name, location').eq('status', 'active'),
      ]);
      if (w.data) setWorkers(w.data);
      if (p.data) setProjects(p.data);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchAssignments = async () => {
      const { data } = await supabase
        .from('assignments')
        .select('id, worker_id, project_id, shift')
        .eq('assigned_date', date);

      const map: AssignmentMap = {};

      if (data) {
        data.forEach(a => {
          if (!map[a.worker_id]) map[a.worker_id] = emptyAssignment();

          if (a.shift === 'full_day') {
            map[a.worker_id].mode = 'full_day';
            map[a.worker_id].full_day = { project_id: a.project_id, assignment_id: a.id };
          } else if (a.shift === 'morning') {
            map[a.worker_id].mode = 'split';
            map[a.worker_id].morning = { project_id: a.project_id, assignment_id: a.id };
          } else if (a.shift === 'afternoon') {
            map[a.worker_id].mode = 'split';
            map[a.worker_id].afternoon = { project_id: a.project_id, assignment_id: a.id };
          }
        });
      }

      setAssignments(map);
    };
    fetchAssignments();
  }, [date]);

  const getAssignment = (workerId: string): WorkerAssignment => {
    return assignments[workerId] || emptyAssignment();
  };

  const updateAssignment = (workerId: string, updates: Partial<WorkerAssignment>) => {
    setAssignments(prev => ({
      ...prev,
      [workerId]: { ...getAssignment(workerId), ...updates },
    }));
  };

  const toggleSplit = (workerId: string) => {
    const current = getAssignment(workerId);
    updateAssignment(workerId, {
      mode: current.mode === 'full_day' ? 'split' : 'full_day',
    });
  };

  const upsertShift = async (
    workerId: string,
    shift: 'full_day' | 'morning' | 'afternoon',
    projectId: string,
    assignmentId?: string
  ) => {
    if (!projectId) return;
    if (assignmentId) {
      await supabase.from('assignments').update({ project_id: projectId }).eq('id', assignmentId);
    } else {
      await supabase.from('assignments').insert({
        worker_id: workerId,
        project_id: projectId,
        assigned_date: date,
        shift,
      });
    }
  };

  const deleteShift = async (assignmentId?: string) => {
    if (assignmentId) {
      await supabase.from('assignments').delete().eq('id', assignmentId);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);

    for (const [workerId, a] of Object.entries(assignments)) {
      if (a.mode === 'full_day') {
        // Save full day, delete morning/afternoon if they exist
        await upsertShift(workerId, 'full_day', a.full_day.project_id, a.full_day.assignment_id);
        await deleteShift(a.morning.assignment_id);
        await deleteShift(a.afternoon.assignment_id);
      } else {
        // Save morning and afternoon, delete full_day if it exists
        await upsertShift(workerId, 'morning', a.morning.project_id, a.morning.assignment_id);
        await upsertShift(workerId, 'afternoon', a.afternoon.project_id, a.afternoon.assignment_id);
        await deleteShift(a.full_day.assignment_id);
      }
    }

    setLoading(false);
    setSuccess(true);
  };

  const assignedCount = Object.values(assignments).filter(a =>
    a.mode === 'full_day' ? a.full_day.project_id : a.morning.project_id || a.afternoon.project_id
  ).length;

  return (
    <main className="max-w-5xl mx-auto p-8 bg-white text-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Daily Assignments</h1>

      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Select Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div className="mt-5 text-sm text-gray-500">
          {assignedCount} of {workers.length} workers assigned
        </div>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
          Assignments saved successfully!
        </div>
      )}

      <div className="border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Worker</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Assignment</th>
              <th className="text-left px-4 py-3 font-medium">Split</th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center px-4 py-6 text-gray-400">
                  No workers found
                </td>
              </tr>
            )}
            {workers.map(w => {
              const a = getAssignment(w.employee_id);
              return (
                <tr key={w.employee_id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{w.name}</td>
                  <td className="px-4 py-3 text-gray-500">{w.role || '—'}</td>
                  <td className="px-4 py-3">
                    {a.mode === 'full_day' ? (
                      <select
                        value={a.full_day.project_id}
                        onChange={e => updateAssignment(w.employee_id, {
                          full_day: { ...a.full_day, project_id: e.target.value }
                        })}
                        className="border rounded px-3 py-1.5 text-sm w-full max-w-xs"
                      >
                        <option value="">— Not assigned —</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name} — {p.location}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16">Morning</span>
                          <select
                            value={a.morning.project_id}
                            onChange={e => updateAssignment(w.employee_id, {
                              morning: { ...a.morning, project_id: e.target.value }
                            })}
                            className="border rounded px-3 py-1.5 text-sm w-full max-w-xs"
                          >
                            <option value="">— Not assigned —</option>
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.name} — {p.location}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16">Afternoon</span>
                          <select
                            value={a.afternoon.project_id}
                            onChange={e => updateAssignment(w.employee_id, {
                              afternoon: { ...a.afternoon, project_id: e.target.value }
                            })}
                            className="border rounded px-3 py-1.5 text-sm w-full max-w-xs"
                          >
                            <option value="">— Not assigned —</option>
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.name} — {p.location}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSplit(w.employee_id)}
                      className={`text-xs px-3 py-1.5 rounded border font-medium ${
                        a.mode === 'split'
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {a.mode === 'split' ? 'Split ✓' : 'Split'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Assignments'}
      </button>
    </main>
  );
}