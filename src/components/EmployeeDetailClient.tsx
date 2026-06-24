'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, parseISO, getDaysInMonth, isWeekend } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';

function formatHours(decimalHours: number | string) {
  const num = typeof decimalHours === 'string' ? parseFloat(decimalHours) : decimalHours;
  if (isNaN(num)) return '0h 0m';
  const h = Math.floor(Math.abs(num));
  const m = Math.round((Math.abs(num) - h) * 60);
  return `${h}h ${m}m`;
}

export default function EmployeeDetailClient({ 
  user, 
  allDays, 
  holidays = [], 
  initialLeaveBalances = [], 
  initialLeaveRecords = [],
  adminUser
}: { 
  user: any, 
  allDays: any[], 
  holidays?: string[], 
  initialLeaveBalances?: any[], 
  initialLeaveRecords?: any[],
  adminUser?: any
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(user);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({ 
    id: user.id, 
    username: user.username, 
    password: '', 
    name: user.name, 
    dept: user.dept || '', 
    enrollId: user.enrollId || '' 
  });

  // Edit Timings States
  const [showEditTimingsModal, setShowEditTimingsModal] = useState(false);
  const [editTimingsDate, setEditTimingsDate] = useState('');
  const [editTimingsForm, setEditTimingsForm] = useState({ firstIn: '', lastOut: '' });
  const [isSubmittingTimings, setIsSubmittingTimings] = useState(false);
  const [isAddingTiming, setIsAddingTiming] = useState(false);

  const handleSaveTimings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTimingsDate) {
      alert('Please specify a valid date.');
      return;
    }
    setIsSubmittingTimings(true);
    try {
      const res = await fetch('/api/admin/adjust-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'edit-day-timings',
          userId: currentUser.id,
          date: editTimingsDate,
          firstIn: editTimingsForm.firstIn,
          lastOut: editTimingsForm.lastOut
        })
      });
      if (res.ok) {
        setShowEditTimingsModal(false);
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save timings');
      }
    } catch {
      alert('Request failed');
    }
    setIsSubmittingTimings(false);
  };

  useEffect(() => {
    setCurrentUser(user);
    setEditFormData({
      id: user.id,
      username: user.username,
      password: '',
      name: user.name,
      dept: user.dept || '',
      enrollId: user.enrollId || ''
    });
  }, [user]);

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editFormData)
    });
    if (res.ok) {
      const updatedUser = await res.json();
      setCurrentUser(updatedUser);
      setShowEditModal(false);
      router.refresh();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to update employee');
    }
  };

  const [leaveBalances, setLeaveBalances] = useState(initialLeaveBalances);
  const [leaveRecords] = useState(initialLeaveRecords);
  
  // Shift configurations
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [graceMins, setGraceMins] = useState(15);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedStart = localStorage.getItem('shiftStart');
      const storedEnd = localStorage.getItem('shiftEnd');
      const storedGrace = localStorage.getItem('graceMins');
      if (storedStart) setShiftStart(storedStart);
      if (storedEnd) setShiftEnd(storedEnd);
      if (storedGrace) setGraceMins(parseInt(storedGrace, 10));
    }
  }, []);

  const getLateMinutes = (inTime: string, start: string, grace: number) => {
    if (!inTime || inTime.includes('WFH') || !inTime.includes(':')) return 0;
    const [inH, inM] = inTime.split(':').map(Number);
    const [shH, shM] = start.split(':').map(Number);
    if (isNaN(inH) || isNaN(shH)) return 0;
    const inMins = inH * 60 + inM;
    const shMins = shH * 60 + shM;
    const diff = inMins - shMins;
    return diff > grace ? diff : 0;
  };

  const getOvertimeMinutes = (inTime: string, outTime: string, end: string) => {
    if (!outTime || outTime.includes('WFH') || !outTime.includes(':') || inTime === outTime) return 0;
    const [outH, outM] = outTime.split(':').map(Number);
    const [seH, seM] = end.split(':').map(Number);
    if (isNaN(outH) || isNaN(seH)) return 0;
    const outMins = outH * 60 + outM;
    const seMins = seH * 60 + seM;
    const diff = outMins - seMins;
    return diff > 0 ? diff : 0;
  };

  const [filterType, setFilterType] = useState<'month' | 'date' | 'range'>('month');

  const allYears = useMemo(() => {
    const years = Array.from(new Set(leaveBalances.map(l => l.year))).sort((a, b) => b - a);
    if (years.length === 0) return [new Date().getFullYear()];
    return years;
  }, [leaveBalances]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    allDays.forEach(([date]) => {
      months.add(date.substring(0, 7)); 
    });
    return Array.from(months).sort().reverse();
  }, [allDays]);

  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || '');
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { currentYear, currentMonth } = useMemo(() => {
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1; // 1-12
    if (filterType === 'month' && selectedMonth) {
      const parts = selectedMonth.split('-');
      year = parseInt(parts[0]) || year;
      month = parseInt(parts[1]) || month;
    } else if (filterType === 'range' && startDate) {
      const parts = startDate.split('-');
      year = parseInt(parts[0]) || year;
      month = parseInt(parts[1]) || month;
    } else if (filterType === 'date' && selectedDate) {
      const parts = selectedDate.split('-');
      year = parseInt(parts[0]) || year;
      month = parseInt(parts[1]) || month;
    }
    return { currentYear: year, currentMonth: month };
  }, [filterType, selectedMonth, selectedDate, startDate]);

  const currentLeave = useMemo(() => {
    return leaveBalances.find(l => l.year === currentYear && l.month === currentMonth) || { planned: 0, emergency: 0, lop: 0, pending: 0, total: 0 };
  }, [leaveBalances, currentYear, currentMonth]);

  const yearlyTotalLeaves = useMemo(() => {
    const yearBalances = leaveBalances.filter(l => l.year === currentYear);
    const monthlyRecords = yearBalances.filter(l => l.month >= 1 && l.month <= 12);
    if (monthlyRecords.length > 0) {
      return monthlyRecords.reduce((acc, curr) => acc + (curr.total || 0), 0);
    }
    const yearlyRecord = yearBalances.find(l => l.month === 0);
    return yearlyRecord ? yearlyRecord.total : 0;
  }, [leaveBalances, currentYear]);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [editingMonth, setEditingMonth] = useState<number>(0);
  const [leaveForm, setLeaveForm] = useState({ planned: 0, emergency: 0, lop: 0, pending: 0, total: 0 });

  const openLeaveModal = (monthNum: number) => {
    setEditingMonth(monthNum);
    const targetLeave = monthNum === 0 
      ? (leaveBalances.find(l => l.year === currentYear && l.month === 0) || { planned: 0, emergency: 0, lop: 0, pending: 0, total: 0 })
      : currentLeave;
    setLeaveForm({ 
      planned: targetLeave.planned, 
      emergency: targetLeave.emergency, 
      lop: targetLeave.lop, 
      pending: targetLeave.pending, 
      total: targetLeave.total 
    });
    setShowLeaveModal(true);
  };

  const saveLeaveBalances = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, year: currentYear, month: editingMonth, ...leaveForm })
    });
    if (res.ok) {
      const updated = await res.json();
      setLeaveBalances(prev => {
        const idx = prev.findIndex(l => l.year === currentYear && l.month === editingMonth);
        if (idx >= 0) { const copy = [...prev]; copy[idx] = updated; return copy; }
        return [...prev, updated];
      });
      setShowLeaveModal(false);
    } else {
      alert('Failed to save leave balances');
    }
  };

  const selectedMonthName = useMemo(() => {
    try {
      if (filterType === 'month' && selectedMonth) {
        return format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy');
      }
      return format(new Date(currentYear, currentMonth - 1, 1), 'MMMM yyyy');
    } catch {
      return `${currentYear}`;
    }
  }, [filterType, selectedMonth, currentYear, currentMonth]);

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

  const { totalWorkingDays, approvedLeavesCount } = useMemo(() => {
    let totalWD = 0;
    if (filterType === 'month') {
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-').map(Number);
        const days = getDaysInMonth(new Date(year, month - 1));
        for (let i = 1; i <= days; i++) {
           const d = new Date(year, month - 1, i);
           const dateStr = format(d, 'yyyy-MM-dd');
           if (!isWeekend(d) && !holidays.includes(dateStr)) totalWD++;
        }
      }
    } else if (filterType === 'range') {
      if (startDate && endDate) {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        if (start <= end) {
          const current = new Date(start);
          while (current <= end) {
            const dateStr = format(current, 'yyyy-MM-dd');
            if (!isWeekend(current) && !holidays.includes(dateStr)) {
              totalWD++;
            }
            current.setDate(current.getDate() + 1);
          }
        }
      }
    } else {
      if (selectedDate) {
        const d = parseISO(selectedDate);
        totalWD = (isWeekend(d) || holidays.includes(selectedDate)) ? 0 : 1;
      }
    }

    // Count approved leaves ('PL' or 'EL') in the filtered period
    let leavesCount = 0;
    leaveRecords.forEach(rec => {
      const isApproved = rec.type === 'PL' || rec.type === 'EL' || rec.type === 'PL_HALF' || rec.type === 'EL_HALF';
      if (!isApproved) return;

      let inside = false;
      if (filterType === 'month') {
        inside = rec.date.startsWith(selectedMonth);
      } else if (filterType === 'range') {
        inside = rec.date >= startDate && rec.date <= endDate;
      } else {
        inside = rec.date === selectedDate;
      }

      if (inside) {
        const d = parseISO(rec.date);
        if (!isWeekend(d) && !holidays.includes(rec.date)) {
          if (rec.type.endsWith('_HALF')) {
            leavesCount += 0.5;
          } else {
            leavesCount++;
          }
        }
      }
    });

    let finalLeavesCount = leavesCount;
    // Fallback: if there are no date-specific LeaveRecord entries at all, use LeaveBalance
    if (leaveRecords.length === 0) {
      if (filterType === 'month' && selectedMonth) {
        const [y, m] = selectedMonth.split('-').map(Number);
        const balance = leaveBalances.find(b => b.year === y && b.month === m);
        if (balance) {
          const approved = (balance.planned || 0) + (balance.emergency || 0);
          finalLeavesCount = Math.min(totalWD, approved);
        } else {
          finalLeavesCount = 0;
        }
      } else if (filterType === 'range' && startDate && endDate) {
        let totalLeavesInRange = 0;
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        if (start <= end) {
          const monthWorkingDaysMap: Record<string, number> = {};
          const current = new Date(start);
          while (current <= end) {
            const dateStr = format(current, 'yyyy-MM-dd');
            if (!isWeekend(current) && !holidays.includes(dateStr)) {
              const mKey = dateStr.substring(0, 7);
              monthWorkingDaysMap[mKey] = (monthWorkingDaysMap[mKey] || 0) + 1;
            }
            current.setDate(current.getDate() + 1);
          }

          for (const mKey of Object.keys(monthWorkingDaysMap)) {
            const [y, m] = mKey.split('-').map(Number);
            const wd = monthWorkingDaysMap[mKey];
            const balance = leaveBalances.find(b => b.year === y && b.month === m);
            if (balance) {
              const approved = (balance.planned || 0) + (balance.emergency || 0);
              totalLeavesInRange += Math.min(wd, approved);
            }
          }
        }
        finalLeavesCount = totalLeavesInRange;
      } else if (filterType === 'date' && selectedDate) {
        const [y, m] = selectedDate.split('-').map(Number);
        const balance = leaveBalances.find(b => b.year === y && b.month === m);
        if (balance) {
          const approved = (balance.planned || 0) + (balance.emergency || 0);
          finalLeavesCount = Math.min(totalWD, approved);
        } else {
          finalLeavesCount = 0;
        }
      }
    } else {
      finalLeavesCount = Math.min(totalWD, leavesCount);
    }

    return { totalWorkingDays: totalWD, approvedLeavesCount: finalLeavesCount };
  }, [filterType, selectedMonth, selectedDate, startDate, endDate, holidays, leaveRecords, leaveBalances]);

  const workingDaysInPeriod = Math.max(0, totalWorkingDays - approvedLeavesCount);

  const expectedHours = workingDaysInPeriod * 9.5;
  const extraHours = totalHours - expectedHours;
  const avgHours = workingDaysInPeriod > 0 ? (totalHours / workingDaysInPeriod).toFixed(2) : '0.00';

  // Period stats calculation for Late and Overtime
  const periodStats = useMemo(() => {
    let lateDays = 0;
    let otMins = 0;

    filteredDays.forEach(([_, data]) => {
      const lm = getLateMinutes(data.in, shiftStart, graceMins);
      const om = getOvertimeMinutes(data.in, data.out, shiftEnd);
      if (lm > 0) lateDays++;
      otMins += om;
    });

    return { lateDays, otMins };
  }, [filteredDays, shiftStart, shiftEnd, graceMins]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3 className="label">Employee Name</h3>
            <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{currentUser.name}</p>
          </div>
          <div>
            <h3 className="label">User ID</h3>
            <p style={{ fontSize: '1.1rem' }}>{currentUser.username}</p>
          </div>
          <div>
            <h3 className="label">Biometric Enroll ID</h3>
            <p style={{ fontSize: '1.1rem' }}>{currentUser.enrollId || '-'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', border: '1px solid rgba(255,255,255,0.1)' }} 
            onClick={() => setShowEditModal(true)}
          >
            Edit Profile
          </button>

          {adminUser?.username === 'admin' && (
            <button 
              className="btn btn-primary" 
              style={{ 
                padding: '0.5rem 1rem', 
                fontSize: '0.9rem', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.25rem' 
              }} 
              onClick={() => {
                setEditTimingsDate('');
                setEditTimingsForm({ firstIn: '', lastOut: '' });
                setIsAddingTiming(true);
                setShowEditTimingsModal(true);
              }}
            >
              <Plus size={16} /> Add Timing
            </button>
          )}

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
      </div>

      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '600px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Edit Employee</h3>
            <form onSubmit={handleEditEmployee} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input className="input-field" placeholder="Employee ID (for login)" required value={editFormData.username} onChange={e => setEditFormData({...editFormData, username: e.target.value})} />
              <input className="input-field" placeholder="New Password (optional)" type="password" value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} />
              <input className="input-field" placeholder="Full Name" required value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
              <input className="input-field" placeholder="Department (Optional)" value={editFormData.dept} onChange={e => setEditFormData({...editFormData, dept: e.target.value})} />
              <input className="input-field" placeholder="Biometric Enroll ID (Optional)" value={editFormData.enrollId} onChange={e => setEditFormData({...editFormData, enrollId: e.target.value})} />
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowEditModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
         <div className="glass-panel animate-fade-in-up" style={{ textAlign: 'center', padding: '1.5rem' }}>
            <h3 className="label">Total Worked</h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
              {formatHours(totalHours)}
            </p>
         </div>
         <div className="glass-panel animate-fade-in-up" style={{ textAlign: 'center', padding: '1.5rem', animationDelay: '0.05s' }}>
            <h3 className="label">Expected Hours</h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {formatHours(expectedHours)}
            </p>
            <small style={{ color: 'var(--text-muted)' }}>
              {approvedLeavesCount > 0
                ? `${workingDaysInPeriod} working day${workingDaysInPeriod !== 1 ? 's' : ''} (${totalWorkingDays} total, ${approvedLeavesCount} leave${approvedLeavesCount !== 1 ? 's' : ''})`
                : `${workingDaysInPeriod} working day${workingDaysInPeriod !== 1 ? 's' : ''}`
              }
            </small>
         </div>
         <div className="glass-panel animate-fade-in-up" style={{ textAlign: 'center', padding: '1.5rem', animationDelay: '0.1s' }}>
            <h3 className="label">{extraHours >= 0 ? 'Extra Hours' : 'Shortage'}</h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: extraHours >= 0 ? '#10b981' : '#ef4444' }}>
              {extraHours >= 0 ? '+' : '-'}{formatHours(Math.abs(extraHours))}
            </p>
         </div>
         <div className="glass-panel animate-fade-in-up" style={{ textAlign: 'center', padding: '1.5rem', animationDelay: '0.15s' }}>
            <h3 className="label">Late Arrivals</h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: periodStats.lateDays > 0 ? '#ef4444' : 'var(--text-main)' }}>
              {periodStats.lateDays} days
            </p>
         </div>
         <div className="glass-panel animate-fade-in-up" style={{ textAlign: 'center', padding: '1.5rem', animationDelay: '0.2s' }}>
            <h3 className="label">OT Accumulated</h3>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: periodStats.otMins > 0 ? '#10b981' : 'var(--text-main)' }}>
              {formatHours(periodStats.otMins / 60)}
            </p>
         </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.6)' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Leave Balances for {selectedMonthName}</h3>
            </div>
            <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }} onClick={() => openLeaveModal(currentMonth)}>Edit Leaves</button>
         </div>
         <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
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
               <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Total</h4>
               <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{currentLeave.total}</p>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                 <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yearly Total</h4>
                 <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', margin: 0 }}>{yearlyTotalLeaves}</p>
               </div>
               <button 
                 className="btn btn-outline" 
                 style={{ marginTop: '0.5rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem', height: 'auto', lineHeight: 1 }} 
                 onClick={() => openLeaveModal(0)}
               >
                 Edit Yearly
               </button>
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
              {adminUser?.username === 'admin' && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredDays.map(([date, data]) => {
              const lm = getLateMinutes(data.in, shiftStart, graceMins);
              const om = getOvertimeMinutes(data.in, data.out, shiftEnd);
              return (
                <tr key={date}>
                  <td>{date}</td>
                  <td>
                    {data.in === 'WFH' || data.in === 'WFH IN' ? (
                      <span className="badge badge-warning">WFH</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{data.in}</span>
                        {lm > 0 && (
                          <span className="badge badge-error" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            Late {lm}m
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {data.out === 'WFH' || data.out === 'WFH OUT' ? (
                      <span className="badge badge-warning">WFH</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{data.out}</span>
                        {om > 0 && (
                          <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            OT {formatHours(om / 60)}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatHours(data.hours)}</td>
                  {adminUser?.username === 'admin' && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          setEditTimingsDate(date);
                          setEditTimingsForm({
                            firstIn: data.in === '-' || data.in.includes('WFH') ? '' : data.in,
                            lastOut: data.out === '-' || data.out.includes('WFH') ? '' : data.out
                          });
                          setIsAddingTiming(false);
                          setShowEditTimingsModal(true);
                        }}
                        style={{
                          padding: '0.2rem 0.6rem',
                          fontSize: '0.75rem',
                          height: 'auto',
                          lineHeight: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {filteredDays.length === 0 && (
              <tr>
                <td colSpan={adminUser?.username === 'admin' ? 5 : 4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
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
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
              {editingMonth === 0 ? `Edit Yearly Leave Balances (${currentYear})` : `Edit Leave Balances (${selectedMonthName})`}
            </h3>
            <form onSubmit={saveLeaveBalances} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="label">Planned Leaves</label>
                    <input 
                      type="number" 
                      step="0.5" 
                      className="input-field" 
                      value={leaveForm.planned} 
                      onChange={e => {
                        const plannedVal = parseFloat(e.target.value) || 0;
                        setLeaveForm(prev => ({
                          ...prev,
                          planned: plannedVal,
                          total: plannedVal + prev.emergency + prev.lop + prev.pending
                        }));
                      }} 
                    />
                  </div>
                  <div>
                    <label className="label">Emergency Leaves</label>
                    <input 
                      type="number" 
                      step="0.5" 
                      className="input-field" 
                      value={leaveForm.emergency} 
                      onChange={e => {
                        const emergencyVal = parseFloat(e.target.value) || 0;
                        setLeaveForm(prev => ({
                          ...prev,
                          emergency: emergencyVal,
                          total: prev.planned + emergencyVal + prev.lop + prev.pending
                        }));
                      }} 
                    />
                  </div>
                  <div>
                    <label className="label">LOP</label>
                    <input 
                      type="number" 
                      step="0.5" 
                      className="input-field" 
                      value={leaveForm.lop} 
                      onChange={e => {
                        const lopVal = parseFloat(e.target.value) || 0;
                        setLeaveForm(prev => ({
                          ...prev,
                          lop: lopVal,
                          total: prev.planned + prev.emergency + lopVal + prev.pending
                        }));
                      }} 
                    />
                  </div>
                  <div>
                    <label className="label">Pending Approval</label>
                    <input 
                      type="number" 
                      step="0.5" 
                      className="input-field" 
                      value={leaveForm.pending} 
                      onChange={e => {
                        const pendingVal = parseFloat(e.target.value) || 0;
                        setLeaveForm(prev => ({
                          ...prev,
                          pending: pendingVal,
                          total: prev.planned + prev.emergency + prev.lop + pendingVal
                        }));
                      }} 
                    />
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

      {/* Edit Timings Modal */}
      {showEditTimingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '420px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.4rem', fontWeight: 700 }}>
              {isAddingTiming ? 'Add Daily Timings' : 'Edit Timings'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {isAddingTiming 
                ? 'Create a manual attendance record for a specific date.' 
                : <>Adjust First In & Last Out timings for <strong>{editTimingsDate}</strong></>
              }
            </p>
            <form onSubmit={handleSaveTimings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {isAddingTiming && (
                <div>
                  <label className="label">Date</label>
                  <input 
                    type="date" 
                    required
                    className="input-field" 
                    value={editTimingsDate} 
                    onChange={e => setEditTimingsDate(e.target.value)} 
                  />
                </div>
              )}
              <div>
                <label className="label">First In (Check-in)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 09:00:00 (HH:MM:SS)"
                  className="input-field" 
                  value={editTimingsForm.firstIn} 
                  onChange={e => setEditTimingsForm({ ...editTimingsForm, firstIn: e.target.value })} 
                />
              </div>
              <div>
                <label className="label">Last Out (Check-out)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 18:00:00 (HH:MM:SS)"
                  className="input-field" 
                  value={editTimingsForm.lastOut} 
                  onChange={e => setEditTimingsForm({ ...editTimingsForm, lastOut: e.target.value })} 
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(239, 68, 68, 0.05)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)', margin: '0.25rem 0' }}>
                ⚠️ Save will delete existing punches for this date and create manual check-in/out records. Leave a field blank or "-" to exclude it.
              </p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmittingTimings}>
                  {isSubmittingTimings ? 'Saving...' : 'Save Timings'}
                </button>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowEditTimingsModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
