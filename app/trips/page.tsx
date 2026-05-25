'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Trip = {
  id: string;
  vehicle_number: string;
  driver_id: string | null;
  customer_id: string | null;
  dropoff_id: string | null;
  requester: string | null;
  remarks: string | null;
  status: string;
  created_at: string;
  customers: { name: string; address: string | null } | null;
  locations: { name: string; address: string | null } | null;
  weigh_bridge: { net_weight: number }[];
  trip_bins: { id: string; bin_id: string; action: string; bins: { serial_number: string } | null }[];
};

type Vehicle = { plate_number: string };
type Driver = { employee_id: string; name: string };
type CustomerOption = { customer_id: number; name: string; address: string | null };
type LocationOption = { id: number; name: string; address: string | null };
type BinOption = { id: string; serial_number: string };
type BinAction = { bin_id: string; action: 'dropoff' | 'pickup' };

const emptyForm = {
  vehicle_number: '',
  driver_id: '',
  customer_id: '',
  dropoff_id: '',
  requester: '',
  remarks: '',
};

const emptyCustomerForm = { name: '', contact_person: '', contact_number: '', address: '' };

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [binOptions, setBinOptions] = useState<BinOption[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [binActions, setBinActions] = useState<BinAction[]>([]);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState(emptyCustomerForm);
  const [savingCustomer, setSavingCustomer] = useState(false);

  const fetchTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('id, vehicle_number, driver_id, customer_id, dropoff_id, requester, remarks, status, created_at, customers(name, address), locations(name, address), weigh_bridge(net_weight), trip_bins(id, bin_id, action, bins(serial_number))')
      .order('created_at', { ascending: false });
    if (data) setTrips(data as unknown as Trip[]);
  };

  const fetchLookups = async () => {
    const [v, d, c, l, b] = await Promise.all([
      supabase.from('vehicles').select('plate_number').order('plate_number'),
      supabase.from('drivers').select('employee_id, name').order('name'),
      supabase.from('customers').select('customer_id, name, address').order('name'),
      supabase.from('locations').select('id, name, address').order('name'),
      supabase.from('bins').select('id, serial_number').order('serial_number'),
    ]);
    if (v.data) setVehicles(v.data);
    if (d.data) setDrivers(d.data);
    if (c.data) setCustomerOptions(c.data);
    if (l.data) setLocationOptions(l.data);
    if (b.data) setBinOptions(b.data);
  };

  useEffect(() => {
    fetchTrips();
    fetchLookups();
  }, []);

  const selectedCustomerAddress = customerOptions.find(c => String(c.customer_id) === form.customer_id)?.address ?? '';
  const selectedDropoffAddress = locationOptions.find(l => String(l.id) === form.dropoff_id)?.address ?? '';

  const openCreate = () => {
    setForm(emptyForm);
    setEditingTrip(null);
    setShowNewCustomer(false);
    setNewCustomerForm(emptyCustomerForm);
    setBinActions([]);
    setShowModal(true);
  };

  const openEdit = (trip: Trip) => {
    setForm({
      vehicle_number: trip.vehicle_number,
      driver_id: trip.driver_id ?? '',
      customer_id: trip.customer_id != null ? String(trip.customer_id) : '',
      dropoff_id: trip.dropoff_id != null ? String(trip.dropoff_id) : '',
      requester: trip.requester ?? '',
      remarks: trip.remarks ?? '',
    });
    setBinActions(trip.trip_bins.map(tb => ({ bin_id: tb.bin_id, action: tb.action as 'dropoff' | 'pickup' })));
    setEditingTrip(trip);
    setShowNewCustomer(false);
    setNewCustomerForm(emptyCustomerForm);
    setShowModal(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'customer_id' && value === '__new__') {
      setShowNewCustomer(true);
      setForm(prev => ({ ...prev, customer_id: '' }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustomerForm.name.trim()) return;
    setSavingCustomer(true);
    const { data, error } = await supabase
      .from('customers')
      .insert(newCustomerForm)
      .select('customer_id, name, address')
      .single();
    setSavingCustomer(false);
    if (error) { alert('Error creating customer: ' + error.message); return; }
    if (data) {
      setCustomerOptions(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(prev => ({ ...prev, customer_id: String(data.customer_id) }));
      setShowNewCustomer(false);
      setNewCustomerForm(emptyCustomerForm);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      vehicle_number: form.vehicle_number,
      driver_id: form.driver_id || null,
      customer_id: form.customer_id ? parseInt(form.customer_id, 10) : null,
      dropoff_id: form.dropoff_id ? parseInt(form.dropoff_id, 10) : null,
      requester: form.requester || null,
      remarks: form.remarks || null,
    };

    let tripId = '';
    let saveError;

    if (editingTrip) {
      const { error } = await supabase.from('trips').update(payload).eq('id', editingTrip.id);
      saveError = error;
      tripId = editingTrip.id;
    } else {
      const { data, error } = await supabase.from('trips').insert(payload).select('id').single();
      saveError = error;
      tripId = data?.id ?? '';
    }

    if (saveError) {
      setLoading(false);
      alert('Error saving trip: ' + saveError.message);
      return;
    }

    if (editingTrip) {
      await supabase.from('trip_bins').delete().eq('trip_id', tripId);
    }
    const validBinActions = binActions.filter(ba => ba.bin_id);
    if (validBinActions.length > 0) {
      await supabase.from('trip_bins').insert(
        validBinActions.map(ba => ({ trip_id: tripId, bin_id: ba.bin_id, action: ba.action }))
      );
    }

    setLoading(false);
    setShowModal(false);
    fetchTrips();
  };

  const handleMarkComplete = async (id: string) => {
    const trip = trips.find(t => t.id === id);
    if (!trip) return;
    const { error } = await supabase.from('trips').update({ status: 'completed' }).eq('id', id);
    if (error) { alert('Error updating trip: ' + error.message); return; }

    for (const tb of trip.trip_bins) {
      if (tb.action === 'pickup') {
        await supabase.from('bins').update({
          location_id: trip.dropoff_id ? Number(trip.dropoff_id) : null,
          customer_id: null,
        }).eq('id', tb.bin_id);
      } else if (tb.action === 'dropoff') {
        await supabase.from('bins').update({
          customer_id: trip.customer_id ? Number(trip.customer_id) : null,
          location_id: null,
        }).eq('id', tb.bin_id);
      }
    }
    fetchTrips();
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this trip?')) return;
    const { error } = await supabase.from('trips').update({ status: 'cancelled' }).eq('id', id);
    if (!error) fetchTrips();
    else alert('Error cancelling trip: ' + error.message);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this trip?')) return;
    const { error } = await supabase.from('trips').delete().eq('id', id);
    if (!error) fetchTrips();
    else alert('Error deleting trip: ' + error.message);
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-600',
    };
    return `px-2 py-1 rounded text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-800'}`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' });

  const totalNetWeight = (trip: Trip) =>
    trip.weigh_bridge.reduce((sum, w) => sum + w.net_weight, 0);

  return (
    <main className="max-w-7xl mx-auto p-8 bg-white text-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Trips</h1>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700">
          + New Trip
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Vehicle</th>
              <th className="text-left px-4 py-3 font-medium">Customer</th>
              <th className="text-left px-4 py-3 font-medium">Dropoff</th>
              <th className="text-left px-4 py-3 font-medium">Bins</th>
              <th className="text-left px-4 py-3 font-medium">Net Weight</th>
              <th className="text-left px-4 py-3 font-medium">Requester</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center px-4 py-6 text-gray-400">No trips yet</td>
              </tr>
            )}
            {trips.map(t => {
              const netWeight = totalNetWeight(t);
              return (
                <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.vehicle_number}</td>
                  <td className="px-4 py-3 text-gray-600">{t.customers?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{t.locations?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {t.trip_bins.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {t.trip_bins.map(tb => (
                          <span key={tb.id} className="text-xs">
                            <span className={tb.action === 'dropoff' ? 'text-blue-600' : 'text-orange-600'}>
                              {tb.action === 'dropoff' ? '↓' : '↑'}
                            </span>
                            {' '}{tb.bins?.serial_number ?? '—'}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {netWeight > 0 ? `${netWeight.toFixed(3)} kg` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.requester ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(t.status)}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {t.status === 'open' && (
                      <>
                        <button onClick={() => handleMarkComplete(t.id)} className="text-green-600 hover:underline text-sm mr-3">
                          Complete
                        </button>
                        <button onClick={() => handleCancel(t.id)} className="text-orange-600 hover:underline text-sm mr-3">
                          Cancel
                        </button>
                      </>
                    )}
                    <button onClick={() => openEdit(t)} className="text-blue-600 hover:underline text-sm mr-3">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:underline text-sm">
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editingTrip ? 'Edit Trip' : 'New Trip'}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Vehicle</label>
                <select name="vehicle_number" value={form.vehicle_number} onChange={handleChange} required className="w-full border rounded px-3 py-2">
                  <option value="">Select vehicle</option>
                  {vehicles.map(v => <option key={v.plate_number} value={v.plate_number}>{v.plate_number}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Driver</label>
                <select name="driver_id" value={form.driver_id} onChange={handleChange} className="w-full border rounded px-3 py-2">
                  <option value="">— No driver —</option>
                  {drivers.map(d => <option key={d.employee_id} value={d.employee_id}>{d.name} ({d.employee_id})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Customer</label>
                <select
                  name="customer_id"
                  value={showNewCustomer ? '__new__' : form.customer_id}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">— No customer —</option>
                  {customerOptions.map(c => <option key={c.customer_id} value={String(c.customer_id)}>{c.name}</option>)}
                  <option value="__new__">+ Create new customer…</option>
                </select>

                {!showNewCustomer && selectedCustomerAddress && (
                  <div className="mt-2 px-3 py-2 bg-gray-50 border rounded text-sm text-gray-600">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mr-2">Pickup</span>
                    {selectedCustomerAddress}
                  </div>
                )}

                {showNewCustomer && (
                  <div className="mt-3 p-4 border border-blue-200 rounded-lg bg-blue-50 space-y-3">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">New Customer</p>
                    <div>
                      <label className="block text-sm font-medium mb-1">Company Name</label>
                      <input value={newCustomerForm.name} onChange={e => setNewCustomerForm(prev => ({ ...prev, name: e.target.value }))} className="w-full border rounded px-3 py-2 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Address (Pickup Location)</label>
                      <input value={newCustomerForm.address} onChange={e => setNewCustomerForm(prev => ({ ...prev, address: e.target.value }))} className="w-full border rounded px-3 py-2 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Contact Person</label>
                      <input value={newCustomerForm.contact_person} onChange={e => setNewCustomerForm(prev => ({ ...prev, contact_person: e.target.value }))} className="w-full border rounded px-3 py-2 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Contact Number</label>
                      <input value={newCustomerForm.contact_number} onChange={e => setNewCustomerForm(prev => ({ ...prev, contact_number: e.target.value }))} className="w-full border rounded px-3 py-2 bg-white" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleSaveNewCustomer} disabled={savingCustomer || !newCustomerForm.name.trim()} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                        {savingCustomer ? 'Saving...' : 'Save Customer'}
                      </button>
                      <button type="button" onClick={() => { setShowNewCustomer(false); setNewCustomerForm(emptyCustomerForm); }} className="border px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Dropoff Location</label>
                <select name="dropoff_id" value={form.dropoff_id} onChange={handleChange} className="w-full border rounded px-3 py-2">
                  <option value="">— No dropoff —</option>
                  {locationOptions.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                </select>

                {selectedDropoffAddress && (
                  <div className="mt-2 px-3 py-2 bg-gray-50 border rounded text-sm text-gray-600">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mr-2">Address</span>
                    {selectedDropoffAddress}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Requester</label>
                <input name="requester" value={form.requester} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Remarks</label>
                <textarea name="remarks" value={form.remarks} onChange={handleChange} rows={2} className="w-full border rounded px-3 py-2 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Bin Movements</label>
                <div className="space-y-2">
                  {binActions.map((ba, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select
                        value={ba.bin_id}
                        onChange={e => setBinActions(prev => prev.map((a, j) => j === i ? { ...a, bin_id: e.target.value } : a))}
                        className="flex-1 border rounded px-3 py-2 text-sm"
                      >
                        <option value="">Select bin</option>
                        {binOptions.map(b => <option key={b.id} value={b.id}>{b.serial_number}</option>)}
                      </select>
                      <select
                        value={ba.action}
                        onChange={e => setBinActions(prev => prev.map((a, j) => j === i ? { ...a, action: e.target.value as 'dropoff' | 'pickup' } : a))}
                        className="border rounded px-3 py-2 text-sm"
                      >
                        <option value="dropoff">Drop off</option>
                        <option value="pickup">Pick up</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setBinActions(prev => prev.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-700 px-1 text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBinActions(prev => [...prev, { bin_id: '', action: 'dropoff' }])}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + Add bin
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading || showNewCustomer} className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Saving...' : editingTrip ? 'Save Changes' : 'Create Trip'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="border px-6 py-2 rounded font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
