'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, subDays, parseISO, getDaysInMonth, isWeekend } from 'date-fns';

function formatHours(decimalHours: number | string) {
  const num = typeof decimalHours === 'string' ? parseFloat(decimalHours) : decimalHours;
  if (isNaN(num)) return '0h 0m';
  const h = Math.floor(num);
  const m = Math.round((num - h) * 60);
  return `${h}h ${m}m`;
}

export default function EmployeeDashboardClient({ allDays, user, holidays = [], leaveBalances = [] }: { allDays: any[], user: any, holidays?: string[], leaveBalances?: any[] }) {
  const router = useRouter();
  
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(leaveBalances.map(l => l.year))).sort((a, b) => b - a);
    if (years.length === 0) return [new Date().getFullYear()];
    return years;
  }, [leaveBalances]);
  
  const [selectedYear, setSelectedYear] = useState(availableYears[0]);
  const currentLeave = leaveBalances.find(l => l.year === selectedYear) || { planned: 0, emergency: 0, lop: 0, pending: 0, total: 0 };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    allDays.forEach(([date]) => {
      months.add(date.substring(0, 7)); 
    });
    return Array.from(months).sort().reverse();
  }, [allDays]);

  const [filterType, setFilterType] = useState<'month' | 'date'>('month');
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || '');
  const [selectedDate, setSelectedDate] = useState('');

  const filteredDays = useMemo(() => {
    if (filterType === 'month') {
      if (!selectedMonth) return allDays;
      return allDays.filter(([date]) => date.startsWith(selectedMonth));
    } else {
      if (!selectedDate) return allDays;
      return allDays.filter(([date]) => date === selectedDate);
    }
  }, [allDays, filterType, selectedMonth, selectedDate]);

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
    } else {
      if (!selectedDate) return 0;
      const date = parseISO(selectedDate);
      return (isWeekend(date) || holidays.includes(selectedDate)) ? 0 : 1;
    }
  }, [filterType, selectedMonth, selectedDate, holidays]);

  const expectedHours = workingDaysInPeriod * 9.5;
  const extraHours = totalHours - expectedHours;
  const avgHours = workingDaysInPeriod > 0 ? (totalHours / workingDaysInPeriod).toFixed(2) : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (date !== todayStr && date !== yesterdayStr) {
      setError('You can only submit WFH hours for today or yesterday.');
      return;
    }

    try {
      const res = await fetch('/api/employee/wfh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, startTime, endTime, remarks })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit WFH request');
      } else {
        alert('WFH log recorded successfully');
        setStartTime('');
        setEndTime('');
        setRemarks('');
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem 0' }}>
      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
         <div>
           <h3 className="label">Welcome back,</h3>
           <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{user.name}</p>
         </div>

         <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(15, 23, 42, 0.4)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
          <label className="label" style={{ marginBottom: 0 }}>Filter:</label>
          <select className="input-field" style={{ minWidth: '120px', padding: '0.5rem' }} value={filterType} onChange={e => setFilterType(e.target.value as any)}>
            <option value="month">By Month</option>
            <option value="date">By Date</option>
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

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
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
         <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Leave Balances</h3>
            <select className="input-field" style={{ padding: '0.2rem 0.5rem', width: 'auto' }} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
        <div className="glass-panel animate-fade-in-up" style={{ flex: '1 1 300px' }}>
           <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 600 }}>Mark WFH Hours</h3>
           {error && <div className="badge badge-error" style={{ marginBottom: '1rem', display: 'block', padding: '0.5rem' }}>{error}</div>}
           <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <div>
               <label className="label">Date</label>
               <input 
                 type="date" 
                 className="input-field" 
                 value={date} 
                 min={yesterdayStr} 
                 max={todayStr}
                 onChange={e => setDate(e.target.value)} 
                 required 
               />
               <small style={{ color: 'var(--primary)', marginTop: '0.25rem', display: 'block' }}>Only today and yesterday allowed.</small>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
               <div>
                 <label className="label">Start Time</label>
                 <input 
                   type="time" 
                   className="input-field" 
                   value={startTime} 
                   onChange={e => setStartTime(e.target.value)} 
                   required 
                 />
               </div>
               <div>
                 <label className="label">End Time</label>
                 <input 
                   type="time" 
                   className="input-field" 
                   value={endTime} 
                   onChange={e => setEndTime(e.target.value)} 
                   required 
                 />
               </div>
             </div>
             <div>
               <label className="label">Remarks (Optional)</label>
               <input 
                 type="text" 
                 className="input-field" 
                 value={remarks} 
                 onChange={e => setRemarks(e.target.value)} 
                 placeholder="Tasks completed..."
               />
             </div>
             <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Submit WFH Log</button>
           </form>
        </div>

        <div className="table-container" style={{ flex: '2 1 500px' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Punch In</th>
                <th>Punch Out</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {filteredDays.map(([dateStr, data]) => (
                <tr key={dateStr}>
                  <td>{dateStr}</td>
                  <td>{data.in === 'WFH' ? <span className="badge badge-warning">WFH</span> : data.in}</td>
                  <td>{data.out === 'WFH' ? <span className="badge badge-warning">WFH</span> : data.out}</td>
                  <td style={{ fontWeight: 600 }}>{formatHours(data.hours)}</td>
                </tr>
              ))}
              {filteredDays.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No attendance records found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
