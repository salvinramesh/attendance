'use client';

import { useState, useMemo } from 'react';
import { format, parseISO, getDaysInMonth, isWeekend } from 'date-fns';

function formatHours(decimalHours: number | string) {
  const num = typeof decimalHours === 'string' ? parseFloat(decimalHours) : decimalHours;
  if (isNaN(num)) return '0h 0m';
  const h = Math.floor(Math.abs(num));
  const m = Math.round((Math.abs(num) - h) * 60);
  return `${h}h ${m}m`;
}

export default function EmployeeDetailClient({ user, allDays, holidays = [], initialLeaveBalances = [] }: { user: any, allDays: any[], holidays?: string[], initialLeaveBalances?: any[] }) {
  const [leaveBalances, setLeaveBalances] = useState(initialLeaveBalances);
  
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(leaveBalances.map(l => l.year))).sort((a, b) => b - a);
    if (years.length === 0) return [new Date().getFullYear()];
    return years;
  }, [leaveBalances]);
  
  const [selectedYear, setSelectedYear] = useState(availableYears[0]);
  const currentLeave = leaveBalances.find(l => l.year === selectedYear) || { planned: 0, emergency: 0, lop: 0, pending: 0, total: 0 };

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ planned: 0, emergency: 0, lop: 0, pending: 0, total: 0 });

  const openLeaveModal = () => {
    setLeaveForm({ 
      planned: currentLeave.planned, 
      emergency: currentLeave.emergency, 
      lop: currentLeave.lop, 
      pending: currentLeave.pending, 
      total: currentLeave.total 
    });
    setShowLeaveModal(true);
  };

  const saveLeaveBalances = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, year: selectedYear, ...leaveForm })
    });
    if (res.ok) {
      const updated = await res.json();
      setLeaveBalances(prev => {
        const idx = prev.findIndex(l => l.year === selectedYear);
        if (idx >= 0) { const copy = [...prev]; copy[idx] = updated; return copy; }
        return [...prev, updated];
      });
      setShowLeaveModal(false);
    } else {
      alert('Failed to save leave balances');
    }
  };
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    allDays.forEach(([date]) => {
      months.add(date.substring(0, 7)); 
    });
    return Array.from(months).sort().reverse();
  }, [allDays]);

  const [filterType, setFilterType] = useState<'month' | 'date' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || '');
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredDays = useMemo(() => {
    if (filterType === 'month') {
      if (!selectedMonth) return allDays;
      return allDays.filter(([date]) => date.startsWith(selectedMonth));
    } else if (filterType === 'range') {
      if (!startDate && !endDate) return allDays;
      return allDays.filter(([date]) => {
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      });
    } else {
      if (!selectedDate) return allDays;
      return allDays.filter(([date]) => date === selectedDate);
    }
  }, [allDays, filterType, selectedMonth, selectedDate, startDate, endDate]);

  const totalHours = useMemo(() => {
    return filteredDays.reduce((acc, [_, data]) => acc + data.hours, 0);
  }, [filteredDays]);

  const workingDaysInPeriod = useMemo(() => {
    if (filterType === 'month') {
      if (!selectedMonth) return 0;
      const [year, month] = selectedMonth.split('-').map(Number);
      const days = getDaysInMonth(new Date(year, month - 1));
      let workingDays = 0;
      for (let i = 1; i <= days; i++) {
         const date = new Date(year, month - 1, i);
         const dateStr = format(date, 'yyyy-MM-dd');
         if (!isWeekend(date) && !holidays.includes(dateStr)) workingDays++;
      }
      return workingDays;
    } else if (filterType === 'range') {
      if (!startDate || !endDate) return 0;
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (start > end) return 0;
      
      let workingDays = 0;
      const current = new Date(start);
      while (current <= end) {
        const dateStr = format(current, 'yyyy-MM-dd');
        if (!isWeekend(current) && !holidays.includes(dateStr)) {
          workingDays++;
        }
        current.setDate(current.getDate() + 1);
      }
      return workingDays;
    } else {
      if (!selectedDate) return 0;
      const date = parseISO(selectedDate);
      return (isWeekend(date) || holidays.includes(selectedDate)) ? 0 : 1;
    }
  }, [filterType, selectedMonth, selectedDate, startDate, endDate, holidays]);

  const expectedHours = workingDaysInPeriod * 9.5;
  const extraHours = totalHours - expectedHours;
  const avgHours = workingDaysInPeriod > 0 ? (totalHours / workingDaysInPeriod).toFixed(2) : '0.00';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3 className="label">Employee Name</h3>
            <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{user.name}</p>
          </div>
          <div>
            <h3 className="label">User ID</h3>
            <p style={{ fontSize: '1.1rem' }}>{user.username}</p>
          </div>
          <div>
            <h3 className="label">Biometric Enroll ID</h3>
            <p style={{ fontSize: '1.1rem' }}>{user.enrollId || '-'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(15, 23, 42, 0.4)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
          <label className="label" style={{ marginBottom: 0 }}>Filter:</label>
          <select className="input-field" style={{ minWidth: '120px', padding: '0.5rem' }} value={filterType} onChange={e => setFilterType(e.target.value as any)}>
            <option value="month">By Month</option>
            <option value="date">By Date</option>
            <option value="range">By Range</option>
          </select>

          {filterType === 'month' ? (
            <select 
              className="input-field" 
              style={{ padding: '0.5rem' }}
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{format(parseISO(`${m}-01`), 'MMMM yyyy')}</option>
              ))}
              {!availableMonths.length && <option value="">No Data</option>}
            </select>
          ) : filterType === 'range' ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="date" 
                className="input-field" 
                style={{ padding: '0.5rem' }}
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>to</span>
              <input 
                type="date" 
                className="input-field" 
                style={{ padding: '0.5rem' }}
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
              />
            </div>
          ) : (
            <input 
              type="date" 
              className="input-field" 
              style={{ padding: '0.5rem' }}
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)} 
            />
          )}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
         <div className="glass-panel animate-fade-in-up" style={{ textAlign: 'center', padding: '1.5rem' }}>
            <h3 className="label">Total Worked</h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
              {formatHours(totalHours)}
            </p>
         </div>
         <div className="glass-panel animate-fade-in-up" style={{ textAlign: 'center', padding: '1.5rem', animationDelay: '0.1s' }}>
            <h3 className="label">Expected Hours</h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)' }}>
              {formatHours(expectedHours)}
            </p>
            <small style={{ color: 'var(--text-muted)' }}>{workingDaysInPeriod} working days (9.5h/day)</small>
         </div>
         <div className="glass-panel animate-fade-in-up" style={{ textAlign: 'center', padding: '1.5rem', animationDelay: '0.2s' }}>
            <h3 className="label">{extraHours >= 0 ? 'Extra Hours' : 'Shortage'}</h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: extraHours >= 0 ? '#10b981' : '#ef4444' }}>
              {extraHours >= 0 ? '+' : '-'}{formatHours(Math.abs(extraHours))}
            </p>
         </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.6)' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Leave Balances</h3>
               <select className="input-field" style={{ padding: '0.2rem 0.5rem', width: 'auto' }} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                 {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
               </select>
            </div>
            <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }} onClick={openLeaveModal}>Edit Leaves</button>
         </div>
         <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
               <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Planned</h4>
               <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{currentLeave.planned}</p>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
               <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emergency</h4>
               <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{currentLeave.emergency}</p>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
               <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LOP</h4>
               <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{currentLeave.lop}</p>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
               <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</h4>
               <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{currentLeave.pending}</p>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
               <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Taken</h4>
               <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{currentLeave.total}</p>
            </div>
         </div>
      </div>

      <div className="table-container">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>First In</th>
              <th>Last Out</th>
              <th>Hours Calculated</th>
            </tr>
          </thead>
          <tbody>
            {filteredDays.map(([date, data]) => (
              <tr key={date}>
                <td>{date}</td>
                <td>{data.in === 'WFH' ? <span className="badge badge-warning">WFH</span> : data.in}</td>
                <td>{data.out === 'WFH' ? <span className="badge badge-warning">WFH</span> : data.out}</td>
                <td style={{ fontWeight: 600 }}>{formatHours(data.hours)}</td>
              </tr>
            ))}
            {filteredDays.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No attendance records found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showLeaveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '500px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Edit Leave Balances ({selectedYear})</h3>
            <form onSubmit={saveLeaveBalances} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="label">Planned Leaves</label>
                    <input type="number" step="0.5" className="input-field" value={leaveForm.planned} onChange={e => setLeaveForm({...leaveForm, planned: parseFloat(e.target.value)||0})} />
                  </div>
                  <div>
                    <label className="label">Emergency Leaves</label>
                    <input type="number" step="0.5" className="input-field" value={leaveForm.emergency} onChange={e => setLeaveForm({...leaveForm, emergency: parseFloat(e.target.value)||0})} />
                  </div>
                  <div>
                    <label className="label">LOP</label>
                    <input type="number" step="0.5" className="input-field" value={leaveForm.lop} onChange={e => setLeaveForm({...leaveForm, lop: parseFloat(e.target.value)||0})} />
                  </div>
                  <div>
                    <label className="label">Pending Approval</label>
                    <input type="number" step="0.5" className="input-field" value={leaveForm.pending} onChange={e => setLeaveForm({...leaveForm, pending: parseFloat(e.target.value)||0})} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="label">Total Leaves Taken</label>
                    <input type="number" step="0.5" className="input-field" value={leaveForm.total} onChange={e => setLeaveForm({...leaveForm, total: parseFloat(e.target.value)||0})} />
                  </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Balances</button>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowLeaveModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
