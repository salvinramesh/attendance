'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { format, subDays, parseISO } from 'date-fns';
import { Users, Calendar, MapPin, Briefcase, Clock, FileText, CheckCircle, XCircle, AlertCircle, Home } from 'lucide-react';

export default function AdminDashboardClient({ 
  initialEmployees, 
  initialHolidays = [],
  attendanceLogs = [],
  wfhLogs = [],
  leaveRecords = []
}: { 
  initialEmployees: any[], 
  initialHolidays?: any[],
  attendanceLogs?: any[],
  wfhLogs?: any[],
  leaveRecords?: any[]
}) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees'>('dashboard');
  const [employees, setEmployees] = useState(initialEmployees);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showMassEmpModal, setShowMassEmpModal] = useState(false);
  const [showMassLeavesModal, setShowMassLeavesModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingEmp, setUploadingEmp] = useState(false);
  const [uploadingLeaves, setUploadingLeaves] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const empFileInputRef = useRef<HTMLInputElement>(null);
  const leavesFileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Add Employee Form State
  const [formData, setFormData] = useState({ username: '', password: '', name: '', dept: '', enrollId: '' });
  // Edit Employee Form State
  const [editFormData, setEditFormData] = useState({ id: 0, username: '', password: '', name: '', dept: '', enrollId: '' });
  // Holiday Form State
  const [holidayFormData, setHolidayFormData] = useState({ date: '', name: '' });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      try {
        const res = await fetch('/api/admin/upload-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data })
        });
        if (res.ok) {
          alert('Attendance records uploaded successfully');
          router.refresh();
        } else {
          alert('Upload failed');
        }
      } catch (err) {
        alert('An error occurred during upload.');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      const newEmp = await res.json();
      setEmployees([newEmp, ...employees]);
      setShowAddModal(false);
      setFormData({ username: '', password: '', name: '', dept: '', enrollId: '' });
      router.refresh();
    } else {
      alert('Failed to add employee');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    const res = await fetch(`/api/admin/employees?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setEmployees(employees.filter(emp => emp.id !== id));
      router.refresh();
    }
  };

  const openEditModal = (emp: any) => {
    setEditFormData({ id: emp.id, username: emp.username, password: '', name: emp.name, dept: emp.dept || '', enrollId: emp.enrollId || '' });
    setShowEditModal(false); // Close if re-opened to trigger transition (optional)
    setShowEditModal(true);
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editFormData)
    });
    if (res.ok) {
      const updatedUser = await res.json();
      setEmployees(employees.map(emp => emp.id === updatedUser.id ? updatedUser : emp));
      setShowEditModal(false);
      router.refresh();
    } else {
      alert('Failed to update employee');
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holidayFormData)
    });
    if (res.ok) {
      const newHol = await res.json();
      setHolidays([...holidays, newHol].sort((a, b) => a.date.localeCompare(b.date)));
      setHolidayFormData({ date: '', name: '' });
      router.refresh();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('Delete this holiday?')) return;
    const res = await fetch(`/api/admin/holidays?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setHolidays(holidays.filter(h => h.id !== id));
      router.refresh();
    }
  };

  const handleEmpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingEmp(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/admin/upload-employees', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully provisioned ${data.count} employees!`);
        setShowMassEmpModal(false);
        const refreshEmployees = await fetch('/api/admin/employees').then(r => r.json()).catch(() => null);
        if (refreshEmployees) setEmployees(refreshEmployees);
        else router.refresh();
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch {
      alert('Upload failed');
    } finally {
      setUploadingEmp(false);
      e.target.value = '';
    }
  };

  const handleLeavesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLeaves(true);
    const formData = new FormData();
    formData.append('file', file);
    // You could also add a year selector in the modal, but default to current year
    formData.append('year', new Date().getFullYear().toString());
    
    try {
      const res = await fetch('/api/admin/upload-leaves', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully imported leave balances for ${data.count} employees!`);
        setShowMassLeavesModal(false);
        router.refresh();
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch {
      alert('Upload failed');
    } finally {
      setUploadingLeaves(false);
      e.target.value = '';
    }
  };

  // Memoized stats for the dashboard tab
  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Total Employees
    const totalEmp = employees.length;
    
    // Active Today: swiped in today
    const swipedToday = new Set(
      attendanceLogs
        .filter((l: any) => l.date === today)
        .map((l: any) => l.enrollId)
        .filter(Boolean)
    );
    
    // WFH Today
    const wfhToday = new Set(
      wfhLogs
        .filter((l: any) => l.date === today)
        .map((l: any) => l.userId)
    );
    
    // On Leave Today
    const leaveToday = new Set(
      leaveRecords
        .filter((l: any) => l.date === today && l.type !== 'Pending')
        .map((l: any) => l.userId)
    );
    
    // Map user.id to enrollId
    const userMap = new Map<number, string>();
    employees.forEach(e => {
      if (e.enrollId) userMap.set(e.id, e.enrollId);
    });
    
    // Present counts
    const presentOfficeCount = swipedToday.size;
    const presentWfhCount = wfhToday.size;
    const leaveCount = leaveToday.size;
    const activeCount = new Set([
      ...Array.from(swipedToday),
      ...Array.from(wfhToday).map(id => userMap.get(id)).filter(Boolean) as string[]
    ]).size;
    const absentCount = Math.max(0, totalEmp - activeCount - leaveCount);
    
    // Last 7 Days trend
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), i);
      return format(d, 'yyyy-MM-dd');
    }).reverse();
    
    const trendData = last7Days.map(dateStr => {
      const swiped = new Set(
        attendanceLogs
          .filter((l: any) => l.date === dateStr)
          .map((l: any) => l.enrollId)
          .filter(Boolean)
      );
      const wfh = new Set(
        wfhLogs
          .filter((l: any) => l.date === dateStr)
          .map((l: any) => l.userId)
      );
      const uniqueActive = new Set([
        ...Array.from(swiped),
        ...Array.from(wfh).map(id => userMap.get(id)).filter(Boolean) as string[]
      ]);
      const rate = totalEmp > 0 ? Math.round((uniqueActive.size / totalEmp) * 100) : 0;
      return {
        date: format(parseISO(dateStr), 'dd MMM'),
        count: uniqueActive.size,
        rate: rate
      };
    });
    
    // Department breakdown
    const deptCounts: { [key: string]: number } = {};
    employees.forEach(e => {
      const d = e.dept || 'Unassigned';
      deptCounts[d] = (deptCounts[d] || 0) + 1;
    });
    const deptData = Object.entries(deptCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    
    return {
      totalEmp,
      presentOfficeCount,
      presentWfhCount,
      leaveCount,
      absentCount,
      trendData,
      deptData
    };
  }, [employees, attendanceLogs, wfhLogs, leaveRecords]);

  // Recent timeline feed
  const recentActivity = useMemo(() => {
    const activities: any[] = [];
    
    attendanceLogs.slice(0, 15).forEach((l: any) => {
      activities.push({
        type: 'swipe',
        name: l.name || `User (${l.enrollId})`,
        details: `Punched in/out at ${l.time}`,
        dateStr: l.date,
        timeStr: l.time || '',
        rawDate: parseISO(`${l.date}T${l.time || '00:00'}`)
      });
    });
    
    wfhLogs.slice(0, 15).forEach((l: any) => {
      activities.push({
        type: 'wfh',
        name: l.user?.name || `Employee ${l.userId}`,
        details: `Logged ${l.hours}h WFH - ${l.remarks || 'No remarks'}`,
        dateStr: l.date,
        timeStr: l.startTime || '',
        rawDate: parseISO(`${l.date}T${l.startTime || '00:00'}`)
      });
    });

    leaveRecords.slice(0, 15).forEach((l: any) => {
      activities.push({
        type: 'leave',
        name: l.user?.name || `Employee ${l.userId}`,
        details: `Logged ${l.type} Leave`,
        dateStr: l.date,
        timeStr: '',
        rawDate: parseISO(`${l.date}T00:00`)
      });
    });

    return activities
      .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
      .slice(0, 6);
  }, [attendanceLogs, wfhLogs, leaveRecords]);

  const filteredEmployees = employees.filter(emp => 
    emp.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (emp.dept && emp.dept.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (emp.enrollId && emp.enrollId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / rowsPerPage));
  const startIdx = (currentPage - 1) * rowsPerPage;
  const currentEmployees = filteredEmployees.slice(startIdx, startIdx + rowsPerPage);

  // SVG trend chart variables
  const chartWidth = 500;
  const chartHeight = 180;
  const chartPadding = 35;
  const points = stats.trendData.map((d, i) => {
    const x = chartPadding + (i * (chartWidth - 2 * chartPadding)) / 6;
    const y = chartHeight - chartPadding - (d.rate * (chartHeight - 2 * chartPadding)) / 100;
    return { x, y, ...d };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - chartPadding} L ${points[0].x} ${chartHeight - chartPadding} Z` 
    : '';

  // Donut values for today's status
  const donutR = 36;
  const donutCirc = 2 * Math.PI * donutR;
  const totalToday = stats.totalEmp || 1;

  const strokeOffice = (stats.presentOfficeCount / totalToday) * donutCirc;
  const strokeWfh = (stats.presentWfhCount / totalToday) * donutCirc;
  const strokeLeave = (stats.leaveCount / totalToday) * donutCirc;
  const strokeAbsent = (stats.absentCount / totalToday) * donutCirc;

  const offsetOffice = 0;
  const offsetWfh = -strokeOffice;
  const offsetLeave = -(strokeOffice + strokeWfh);
  const offsetAbsent = -(strokeOffice + strokeWfh + strokeLeave);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Tabs Header */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.25rem' }}>
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className="btn"
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'dashboard' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'dashboard' ? '3px solid var(--primary)' : '3px solid transparent',
            borderRadius: 0,
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Home size={18} />
          Console Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('employees')} 
          className="btn"
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'employees' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'employees' ? '3px solid var(--primary)' : '3px solid transparent',
            borderRadius: 0,
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Users size={18} />
          Employee Overview
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeInUp 0.4s ease' }}>
          
          {/* Key Metric Cards */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '1rem', borderRadius: '1rem' }}>
                <Users size={28} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Total Employees</h4>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.totalEmp}</p>
              </div>
            </div>

            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--secondary)', padding: '1rem', borderRadius: '1rem' }}>
                <CheckCircle size={28} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Present (Office)</h4>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--secondary)' }}>{stats.presentOfficeCount}</p>
              </div>
            </div>

            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '1rem', borderRadius: '1rem' }}>
                <Home size={28} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Working From Home</h4>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{stats.presentWfhCount}</p>
              </div>
            </div>

            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '1rem', borderRadius: '1rem' }}>
                <Calendar size={28} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>On Leave Today</h4>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>{stats.leaveCount}</p>
              </div>
            </div>
          </div>

          {/* Visual Charts section */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            
            {/* SVG Line Graph (Trend) */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Attendance Rate Trend</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Daily activity over the last 7 days</p>
              </div>
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {[0, 25, 50, 75, 100].map(val => {
                    const y = chartPadding + ((100 - val) * (chartHeight - 2 * chartPadding)) / 100;
                    return (
                      <g key={val}>
                        <line x1={chartPadding} y1={y} x2={chartWidth - chartPadding} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                        <text x={chartPadding - 8} y={y + 3} fill="var(--text-muted)" fontSize="9" textAnchor="end">{val}%</text>
                      </g>
                    );
                  })}
                  <path d={areaPath} fill="url(#chart-glow)" />
                  <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-dark)" stroke="var(--primary)" strokeWidth="2" />
                      <text x={p.x} y={p.y - 10} fill="var(--text-main)" fontSize="9" fontWeight="600" textAnchor="middle">{p.rate}%</text>
                      <text x={p.x} y={chartHeight - chartPadding + 16} fill="var(--text-muted)" fontSize="9" textAnchor="middle">{p.date}</text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* SVG Donut + Dept stats */}
            <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, textAlign: 'center', width: '100%' }}>{"Today's Status"}</h3>
                <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                  <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r={donutR} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                    
                    {stats.presentOfficeCount > 0 && (
                      <circle cx="50" cy="50" r={donutR} fill="none" stroke="var(--primary)" strokeWidth="10"
                        strokeDasharray={`${strokeOffice} ${donutCirc}`} strokeDashoffset={offsetOffice} strokeLinecap="round" />
                    )}
                    {stats.presentWfhCount > 0 && (
                      <circle cx="50" cy="50" r={donutR} fill="none" stroke="#f59e0b" strokeWidth="10"
                        strokeDasharray={`${strokeWfh} ${donutCirc}`} strokeDashoffset={offsetWfh} strokeLinecap="round" />
                    )}
                    {stats.leaveCount > 0 && (
                      <circle cx="50" cy="50" r={donutR} fill="none" stroke="#ef4444" strokeWidth="10"
                        strokeDasharray={`${strokeLeave} ${donutCirc}`} strokeDashoffset={offsetLeave} strokeLinecap="round" />
                    )}
                    {stats.absentCount > 0 && (
                      <circle cx="50" cy="50" r={donutR} fill="none" stroke="#64748b" strokeWidth="10"
                        strokeDasharray={`${strokeAbsent} ${donutCirc}`} strokeDashoffset={offsetAbsent} strokeLinecap="round" />
                    )}
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.presentOfficeCount + stats.presentWfhCount}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Present</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', background: 'var(--primary)', borderRadius: '50%' }} />
                  <span>Office: <strong>{stats.presentOfficeCount}</strong> ({Math.round(stats.presentOfficeCount / totalToday * 100)}%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '50%' }} />
                  <span>WFH: <strong>{stats.presentWfhCount}</strong> ({Math.round(stats.presentWfhCount / totalToday * 100)}%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%' }} />
                  <span>On Leave: <strong>{stats.leaveCount}</strong> ({Math.round(stats.leaveCount / totalToday * 100)}%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '10px', height: '10px', background: '#64748b', borderRadius: '50%' }} />
                  <span>Absent: <strong>{stats.absentCount}</strong> ({Math.round(stats.absentCount / totalToday * 100)}%)</span>
                </div>
              </div>
            </div>

          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            
            {/* Department bar chart */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Departments</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Employee allocation by department</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {stats.deptData.map(dept => {
                  const maxCount = Math.max(...stats.deptData.map(d => d.count), 1);
                  const percentage = (dept.count / maxCount) * 100;
                  return (
                    <div key={dept.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 500 }}>{dept.name}</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{dept.count}</span>
                      </div>
                      <div style={{ background: 'rgba(255, 255, 255, 0.05)', height: '8px', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)', 
                            width: `${percentage}%`, 
                            height: '100%', 
                            borderRadius: '9999px'
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
                {stats.deptData.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>No department data available.</p>
                )}
              </div>
            </div>

            {/* Recent activity timeline */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Recent Console Activity</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Timeline of swipes, leaves, and WFH logs</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '220px', overflowY: 'auto' }}>
                {recentActivity.map((act, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.75rem' }}>
                    <div style={{ 
                      background: act.type === 'swipe' ? 'rgba(16, 185, 129, 0.15)' : act.type === 'wfh' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: act.type === 'swipe' ? 'var(--secondary)' : act.type === 'wfh' ? '#f59e0b' : '#ef4444',
                      padding: '0.4rem',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {act.type === 'swipe' ? <Clock size={16} /> : act.type === 'wfh' ? <Home size={16} /> : <Calendar size={16} />}
                    </div>
                    <div style={{ flex: 1, fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-main)' }}>{act.name}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{act.dateStr} {act.timeStr}</span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>{act.details}</p>
                    </div>
                  </div>
                ))}
                {recentActivity.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>No activity records found.</p>
                )}
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeInUp 0.4s ease' }}>
          
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Employee Overview</h2>
              <p style={{ color: 'var(--text-muted)' }}>Manage your workforce and attendance logs</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => setShowHolidayModal(true)}>Manage Holidays</button>
              <button className="btn btn-outline" onClick={() => setShowMassEmpModal(true)}>Mass Upload Employees</button>
              <button className="btn btn-outline" onClick={() => setShowMassLeavesModal(true)}>Mass Upload Leaves</button>
              <button className="btn btn-outline" onClick={() => setShowAddModal(true)}>Add Employee</button>
              
              <input 
                type="file" 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                style={{ display: 'none' }} 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <input 
                type="file" 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                style={{ display: 'none' }} 
                ref={empFileInputRef}
                onChange={handleEmpUpload}
              />
              <input 
                type="file" 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                style={{ display: 'none' }} 
                ref={leavesFileInputRef}
                onChange={handleLeavesUpload}
              />
              <button 
                className="btn btn-primary" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Mass Upload Attendance'}
              </button>
            </div>
          </div>

          <div className="table-container">
            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <input 
                 type="text" 
                 className="input-field" 
                 placeholder="Search by ID, Name, Dept..." 
                 value={searchTerm} 
                 onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                 style={{ maxWidth: '300px', background: 'rgba(15, 23, 42, 0.4)' }}
              />
            </div>
            <table className="modern-table">
               <thead>
                 <tr>
                   <th>User ID</th>
                   <th>Name</th>
                   <th>Dept</th>
                   <th>Enroll ID</th>
                   <th>Actions</th>
                 </tr>
               </thead>
               <tbody>
                 {currentEmployees.map(emp => (
                   <tr key={emp.id}>
                     <td style={{ fontWeight: 500 }}>{emp.username}</td>
                     <td>{emp.name}</td>
                     <td><span className="badge badge-warning">{emp.dept || 'None'}</span></td>
                     <td>{emp.enrollId || '-'}</td>
                     <td>
                       <div style={{ display: 'flex', gap: '0.5rem' }}>
                         <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => router.push(`/admin/employee/${emp.id}`)}>View Log</button>
                         <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--secondary)', color: 'var(--secondary)' }} onClick={() => openEditModal(emp)}>Edit</button>
                         <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => handleDelete(emp.id)}>Delete</button>
                       </div>
                     </td>
                   </tr>
                 ))}
                 {currentEmployees.length === 0 && (
                   <tr>
                     <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                       No employees found.
                     </td>
                   </tr>
                 )}
               </tbody>
            </table>
            
            {totalPages > 1 && (
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', background: 'rgba(30, 41, 59, 0.4)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Showing {filteredEmployees.length > 0 ? startIdx + 1 : 0} to {Math.min(startIdx + rowsPerPage, filteredEmployees.length)} of {filteredEmployees.length} employees</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                     <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }} disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}>Prev</button>
                     <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontWeight: 600 }}>{currentPage} / {totalPages}</span>
                     <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }} disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}>Next</button>
                  </div>
               </div>
            )}
          </div>

        </div>
      )}

      {/* Render Modals at Root Level so they work on all tabs */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '600px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Add New Employee</h3>
            <form onSubmit={handleAddEmployee} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input className="input-field" placeholder="Username (Unique ID)" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              <input className="input-field" placeholder="Password" type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              <input className="input-field" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input className="input-field" placeholder="Department (Optional)" value={formData.dept} onChange={e => setFormData({...formData, dept: e.target.value})} />
              <input className="input-field" placeholder="Biometric Enroll ID" required value={formData.enrollId} onChange={e => setFormData({...formData, enrollId: e.target.value})} />
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-secondary" style={{ flex: 1 }}>Add Employee</button>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '600px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Edit Employee</h3>
            <form onSubmit={handleEditEmployee} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input className="input-field" placeholder="Username (Unique ID)" required value={editFormData.username} onChange={e => setEditFormData({...editFormData, username: e.target.value})} />
              <input className="input-field" placeholder="New Password (optional)" type="password" value={editFormData.password} onChange={e => setEditFormData({...editFormData, password: e.target.value})} />
              <input className="input-field" placeholder="Full Name" required value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
              <input className="input-field" placeholder="Department (Optional)" value={editFormData.dept} onChange={e => setEditFormData({...editFormData, dept: e.target.value})} />
              <input className="input-field" placeholder="Biometric Enroll ID" required value={editFormData.enrollId} onChange={e => setEditFormData({...editFormData, enrollId: e.target.value})} />
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowEditModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHolidayModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '600px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Manage Holidays</h3>
            
            <form onSubmit={handleAddHoliday} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <input type="date" className="input-field" required value={holidayFormData.date} onChange={e => setHolidayFormData({...holidayFormData, date: e.target.value})} />
              <input type="text" className="input-field" placeholder="Holiday Name (e.g. Christmas)" required value={holidayFormData.name} onChange={e => setHolidayFormData({...holidayFormData, name: e.target.value})} />
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn btn-secondary" style={{ flex: 1 }}>Add Holiday</button>
              </div>
            </form>

            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <h4 className="label" style={{ marginBottom: '0.5rem' }}>Existing Holidays</h4>
              {holidays.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No holidays configured.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {holidays.map((h: any) => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                    <div>
                      <strong style={{ display: 'block', color: 'var(--primary)' }}>{h.name}</strong>
                      <small style={{ color: 'var(--text-muted)' }}>{h.date}</small>
                    </div>
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => handleDeleteHoliday(h.id)}>Delete</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowHolidayModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showMassEmpModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '600px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Mass Upload Employees</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Upload an Excel or CSV file to create multiple employee accounts instantly.</p>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
               <h4 style={{ marginBottom: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>Required Template Columns:</h4>
               <code style={{ display: 'block', background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '0.5rem', color: '#10b981', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                 username | password | name | dept | enrollId
               </code>
               <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 <li><strong>username</strong>: Unique ID for login</li>
                 <li><strong>password</strong>: Initial login password</li>
                 <li><strong>name</strong>: {"Employee's"} full name</li>
                 <li><strong>dept</strong>: Department (Optional)</li>
                 <li><strong>enrollId</strong>: Scanner Biometric ID (Optional)</li>
               </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => empFileInputRef.current?.click()}
                disabled={uploadingEmp}
                style={{ flex: 1, marginRight: '1rem' }}
              >
                {uploadingEmp ? 'Processing Accounts...' : 'Select File to Upload'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowMassEmpModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showMassLeavesModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '600px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Mass Upload Leave Balances</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Upload an Excel or CSV file to overwrite existing employee leave balances for the current year.</p>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
               <h4 style={{ marginBottom: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>Required Template Columns:</h4>
               <code style={{ display: 'block', background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '0.5rem', color: '#10b981', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                 Enroll ID | Date | Leave Type
               </code>
               <ul style={{ marginTop: '1rem', paddingLeft: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 <li><strong>Enroll ID</strong>: The numeric Biometric ID mappings format.</li>
                 <li><strong>Date</strong>: Leave date (e.g. 1/2/2025 or 2025-01-02).</li>
                 <li><strong>Leave Type</strong>: Accepted values are PL, EL, LOP.</li>
               </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => leavesFileInputRef.current?.click()}
                disabled={uploadingLeaves}
                style={{ flex: 1, marginRight: '1rem' }}
              >
                {uploadingLeaves ? 'Uploading Balances...' : 'Select File to Upload'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowMassLeavesModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
