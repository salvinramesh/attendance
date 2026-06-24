'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { format, subDays, parseISO } from 'date-fns';
import { Users, Calendar, MapPin, Briefcase, Clock, FileText, CheckCircle, XCircle, AlertCircle, Home, TrendingUp, Download, Filter, Search, RefreshCw, Plus, Cpu, Shield, Edit, Trash2, Key, Eye, EyeOff } from 'lucide-react';

function calculateHours(timeStr1: string, timeStr2: string) {
  const [h1, m1] = timeStr1.split(':').map(Number);
  const [h2, m2] = timeStr2.split(':').map(Number);
  const min1 = h1 * 60 + m1;
  const min2 = h2 * 60 + m2;
  return Math.abs(min2 - min1) / 60;
}


export default function AdminDashboardClient({ 
  initialEmployees, 
  initialHolidays = [],
  attendanceLogs = [],
  wfhLogs = [],
  leaveRecords = [],
  initialDeviceEnrollments = [],
  allEmployees = [],
  currentUser
}: { 
  initialEmployees: any[], 
  initialHolidays?: any[],
  attendanceLogs?: any[],
  wfhLogs?: any[],
  leaveRecords?: any[],
  initialDeviceEnrollments?: any[],
  allEmployees?: any[],
  currentUser?: { id: number; username: string; name: string; email?: string | null; role: string }
}) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'punches' | 'enrollments' | 'consoleUsers' | 'unknownScans'>('dashboard');

  // Unknown scans state
  const [unknownScanSearch, setUnknownScanSearch] = useState('');
  const [unknownScanDateFilter, setUnknownScanDateFilter] = useState('');
  const [onboardTarget, setOnboardTarget] = useState<{ enrollId: string; deviceId: string; name: string } | null>(null);
  const [onboardForm, setOnboardForm] = useState({ employeeId: '', name: '', dept: '' });
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Console Users states
  const [consoleUsers, setConsoleUsers] = useState<any[]>([]);
  const [isLoadingConsoleUsers, setIsLoadingConsoleUsers] = useState(false);
  const [consoleSearchTerm, setConsoleSearchTerm] = useState('');
  const [showAddConsoleModal, setShowAddConsoleModal] = useState(false);
  const [showEditConsoleModal, setShowEditConsoleModal] = useState(false);
  const [showDeleteConsoleConfirm, setShowDeleteConsoleConfirm] = useState(false);
  const [targetConsoleUser, setTargetConsoleUser] = useState<any>(null);
  const [consoleForm, setConsoleForm] = useState({ name: '', username: '', email: '', password: '', enabled: true });
  const [editConsoleForm, setEditConsoleForm] = useState({ name: '', username: '', email: '', password: '', enabled: true });
  const [isSubmittingConsole, setIsSubmittingConsole] = useState(false);
  const [consoleError, setConsoleError] = useState('');

  const fetchConsoleUsers = useCallback(async () => {
    setIsLoadingConsoleUsers(true);
    try {
      const res = await fetch('/api/admin/console-users');
      if (res.ok) {
        const data = await res.json();
        setConsoleUsers(data.consoleUsers || []);
      } else {
        const err = await res.json();
        showToast({ id: 'console-users-err', title: 'Error', message: err.error || 'Failed to fetch console users', type: 'error' });
      }
    } catch (error) {
      console.error(error);
      showToast({ id: 'console-users-err', title: 'Error', message: 'Failed to connect to server', type: 'error' });
    } finally {
      setIsLoadingConsoleUsers(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'consoleUsers') {
      fetchConsoleUsers();
    }
  }, [activeTab, fetchConsoleUsers]);

  const handleAddConsoleUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingConsole(true);
    setConsoleError('');
    try {
      const res = await fetch('/api/admin/console-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consoleForm)
      });
      const data = await res.json();
      if (res.ok) {
        showToast({ id: 'add-console-success', title: 'Success', message: 'Console user added successfully', type: 'success' });
        setShowAddConsoleModal(false);
        setConsoleForm({ name: '', username: '', email: '', password: '', enabled: true });
        fetchConsoleUsers();
      } else {
        setConsoleError(data.error || 'Failed to create console user');
      }
    } catch (error) {
      setConsoleError('Failed to connect to the server');
    } finally {
      setIsSubmittingConsole(false);
    }
  };

  const handleEditConsoleUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetConsoleUser) return;
    setIsSubmittingConsole(true);
    setConsoleError('');
    try {
      const res = await fetch('/api/admin/console-users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetConsoleUser.id,
          name: editConsoleForm.name,
          username: editConsoleForm.username,
          email: editConsoleForm.email,
          password: editConsoleForm.password || undefined,
          enabled: editConsoleForm.enabled
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast({ id: 'edit-console-success', title: 'Success', message: 'Console user updated successfully', type: 'success' });
        setShowEditConsoleModal(false);
        setTargetConsoleUser(null);
        fetchConsoleUsers();
      } else {
        setConsoleError(data.error || 'Failed to update console user');
      }
    } catch (error) {
      setConsoleError('Failed to connect to the server');
    } finally {
      setIsSubmittingConsole(false);
    }
  };

  const handleDeleteConsoleUser = async () => {
    if (!targetConsoleUser) return;
    setIsSubmittingConsole(true);
    try {
      const res = await fetch(`/api/admin/console-users?id=${targetConsoleUser.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast({ id: 'delete-console-success', title: 'Success', message: 'Console user deleted successfully', type: 'success' });
        setShowDeleteConsoleConfirm(false);
        setTargetConsoleUser(null);
        fetchConsoleUsers();
      } else {
        showToast({ id: 'delete-console-err', title: 'Error', message: data.error || 'Failed to delete user', type: 'error' });
      }
    } catch (error) {
      showToast({ id: 'delete-console-err', title: 'Error', message: 'Failed to connect to the server', type: 'error' });
    } finally {
      setIsSubmittingConsole(false);
    }
  };

  // Device Enrollment state
  const [deviceEnrollments, setDeviceEnrollments] = useState<any[]>(initialDeviceEnrollments);
  const [enrollSearchTerm, setEnrollSearchTerm] = useState('');
  const [enrollDeviceFilter, setEnrollDeviceFilter] = useState<'all' | '1' | '2'>('all');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showEditEnrollModal, setShowEditEnrollModal] = useState(false);
  const [showDeleteEnrollConfirm, setShowDeleteEnrollConfirm] = useState(false);
  const [targetEnrollment, setTargetEnrollment] = useState<any>(null);
  const [enrollForm, setEnrollForm] = useState({ deviceId: '2', enrollId: '', userId: '', note: '' });
  const [editEnrollForm, setEditEnrollForm] = useState({ userId: '', note: '' });
  const [enrollUserSearch, setEnrollUserSearch] = useState('');
  const [isSubmittingEnroll, setIsSubmittingEnroll] = useState(false);
  const [autoPopulating, setAutoPopulating] = useState(false);
  const [autoPopulateResult, setAutoPopulateResult] = useState<any>(null);
  const [employees, setEmployees] = useState(initialEmployees);
  const [officeFilter, setOfficeFilter] = useState<'all' | '1' | '2'>('all');
  const [holidays, setHolidays] = useState(initialHolidays);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [deviceStatusList, setDeviceStatusList] = useState<any[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isSyncingEnrollId, setIsSyncingEnrollId] = useState<number | null>(null);

  const fetchDeviceStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/admin/devices/status');
      const data = await res.json();
      if (data.status) {
        setDeviceStatusList(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch device status:', error);
    }
    setIsLoadingStatus(false);
  };

  const handleTriggerSync = async (enrollmentId: number) => {
    setIsSyncingEnrollId(enrollmentId);
    try {
      const res = await fetch('/api/admin/device-enrollments/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId })
      });
      const data = await res.json();
      if (res.ok) {
        setDeviceEnrollments(prev => prev.map(en => en.id === enrollmentId ? { ...en, syncStatus: 'SYNCED', syncError: null, lastSyncedAt: new Date().toISOString() } : en));
        alert(data.message || 'Synchronization successful!');
        fetchDeviceStatus();
      } else {
        setDeviceEnrollments(prev => prev.map(en => en.id === enrollmentId ? { ...en, syncStatus: 'FAILED', syncError: data.error } : en));
        alert(data.error || 'Synchronization failed.');
      }
    } catch {
      alert('Synchronization request failed.');
    }
    setIsSyncingEnrollId(null);
  };

  useEffect(() => {
    if (activeTab === 'enrollments') {
      fetchDeviceStatus();
    }
  }, [activeTab]);

  // Punches tab states
  const [punchesSearchTerm, setPunchesSearchTerm] = useState('');
  const [punchesCurrentPage, setPunchesCurrentPage] = useState(1);
  const [punchesQuickFilter, setPunchesQuickFilter] = useState<'all' | 'today' | 'recent' | 'late' | 'in' | 'out' | 'finger' | 'card' | 'face'>('all');
  const [punchesStartDate, setPunchesStartDate] = useState('');
  const [punchesEndDate, setPunchesEndDate] = useState('');
  const [punchesDevice, setPunchesDevice] = useState<'all' | '1' | '2'>('all');
  const [punchesSingleDate, setPunchesSingleDate] = useState('');
  const [punchesDept, setPunchesDept] = useState('all');
  const [punchesVerification, setPunchesVerification] = useState('all');
  const [punchesType, setPunchesType] = useState('all');
  const [showSyncHistoryModal, setShowSyncHistoryModal] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [syncHistoryRange, setSyncHistoryRange] = useState<'7days' | '30days' | '3months' | '6months' | 'custom' | 'beginning'>('7days');
  const [syncHistoryStart, setSyncHistoryStart] = useState('');
  const [syncHistoryEnd, setSyncHistoryEnd] = useState('');
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [syncHistoryResult, setSyncHistoryResult] = useState<any>(null);
  const [syncJobStatus, setSyncJobStatus] = useState<string>('');

  // Initialize custom range dates to last 7 days by default when modal opens
  useEffect(() => {
    const today = new Date();
    const formattedToday = format(today, 'yyyy-MM-dd');
    const formatted7DaysAgo = format(subDays(today, 7), 'yyyy-MM-dd');
    setSyncHistoryStart(formatted7DaysAgo);
    setSyncHistoryEnd(formattedToday);
  }, []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showMassEmpModal, setShowMassEmpModal] = useState(false);
  const [showMassLeavesModal, setShowMassLeavesModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingEmp, setUploadingEmp] = useState(false);
  const [uploadingLeaves, setUploadingLeaves] = useState(false);
  const [syncingGoogleLeaves, setSyncingGoogleLeaves] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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

  // Real-time Swipes (polling) state
  const [currentLogs, setCurrentLogs] = useState(attendanceLogs);

  // Build lookup maps for device and legacy enrollments to resolve user IDs
  const { enrollmentMap, legacyEnrollmentMap, userById } = useMemo(() => {
    const enrollMap = new Map<string, number>();
    (deviceEnrollments || []).forEach((e: any) => {
      enrollMap.set(`${e.deviceId}__${e.enrollId}`, e.userId);
    });

    const legacyMap = new Map<string, number>();
    employees.forEach((emp: any) => {
      if (emp.enrollId) {
        legacyMap.set(emp.enrollId, emp.id);
      }
    });

    const userMap = new Map<number, any>();
    employees.forEach((emp: any) => {
      userMap.set(emp.id, emp);
    });

    return { enrollmentMap: enrollMap, legacyEnrollmentMap: legacyMap, userById: userMap };
  }, [deviceEnrollments, employees]);

  // Build per-user device office map and detect enroll ID conflicts across offices
  const { userDeviceMap, enrollIdConflictUserIds } = useMemo(() => {
    const devMap = new Map<number, string[]>(); // userId → deviceIds[]
    const byEnrollId = new Map<string, Set<number>>(); // enrollId → set of userIds
    (deviceEnrollments || []).forEach((e: any) => {
      if (!devMap.has(e.userId)) devMap.set(e.userId, []);
      if (!devMap.get(e.userId)!.includes(e.deviceId)) devMap.get(e.userId)!.push(e.deviceId);
      if (!byEnrollId.has(e.enrollId)) byEnrollId.set(e.enrollId, new Set());
      byEnrollId.get(e.enrollId)!.add(e.userId);
    });
    const conflictUserIds = new Set<number>();
    byEnrollId.forEach((userIds) => {
      if (userIds.size > 1) userIds.forEach(uid => conflictUserIds.add(uid));
    });
    return { userDeviceMap: devMap, enrollIdConflictUserIds: conflictUserIds };
  }, [deviceEnrollments]);

  // Helper to find the resolved user ID for any attendance log
  const getUserIdForLog = useCallback((log: any) => {
    if (log.userId) return log.userId;
    if (!log.enrollId) return null;
    const deviceId = log.deviceId || '1';
    if (deviceId === '1') {
      const empId = Number(log.enrollId);
      if (!isNaN(empId) && userById.has(empId)) {
        return empId;
      }
      return null;
    } else if (deviceId === '2') {
      const key = `${deviceId}__${log.enrollId}`;
      if (enrollmentMap.has(key)) {
        return enrollmentMap.get(key) || null;
      }
      return null;
    }
    return null;
  }, [enrollmentMap, userById]);
  
  // Dynamically determine Check In / Check Out types per user per day
  const processedLogs = useMemo(() => {
    // Exclude logs from invisible floors/devices
    const hiddenSet = new Set<string>();
    (deviceEnrollments || []).forEach((e: any) => {
      if (e.isLogVisible === false) {
        hiddenSet.add(`${e.deviceId}__${e.enrollId}`);
      }
    });

    const filteredLogs = currentLogs.filter((log: any) => {
      const key = `${log.deviceId || '1'}__${log.enrollId}`;
      return !hiddenSet.has(key);
    });

    const grouped = new Map<string, any[]>();
    filteredLogs.forEach((log: any) => {
      const userId = getUserIdForLog(log);
      if (!userId) return;
      const key = `${userId}_${log.date}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(log);
    });

    const typeMap = new Map<number, string>();
    grouped.forEach((group) => {
      const sorted = [...group].sort((a, b) => a.time.localeCompare(b.time));
      sorted.forEach((log, index) => {
        typeMap.set(log.id, index === 0 ? 'Check In' : 'Check Out');
      });
    });

    return filteredLogs.map((log: any) => {
      const userId = getUserIdForLog(log);
      if (!userId) return log;
      const user = userById.get(userId);
      return {
        ...log,
        name: user ? user.name : log.name,
        attType: typeMap.get(log.id) || log.attType || 'Normal Open',
        dept: log.dept || (user ? user.dept : null)
      };
    });
  }, [currentLogs, getUserIdForLog, userById, deviceEnrollments]);

  // Dynamically compute list of unique departments
  const departmentsList = useMemo(() => {
    const depts = new Set<string>();
    (employees || []).forEach((emp: any) => {
      if (emp.dept) depts.add(emp.dept.trim());
    });
    (processedLogs || []).forEach((log: any) => {
      if (log.dept) depts.add(log.dept.trim());
    });
    return Array.from(depts).sort();
  }, [employees, processedLogs]);
  // Date selection helpers for mutual exclusion
  const handleSingleDateChange = (dateVal: string) => {
    setPunchesSingleDate(dateVal);
    if (dateVal) {
      setPunchesStartDate('');
      setPunchesEndDate('');
    }
    setPunchesCurrentPage(1);
  };

  const handleRangeStartDateChange = (dateVal: string) => {
    setPunchesStartDate(dateVal);
    if (dateVal) {
      setPunchesSingleDate('');
    }
    setPunchesCurrentPage(1);
  };

  const handleRangeEndDateChange = (dateVal: string) => {
    setPunchesEndDate(dateVal);
    if (dateVal) {
      setPunchesSingleDate('');
    }
    setPunchesCurrentPage(1);
  };

  const handleClearDates = () => {
    setPunchesSingleDate('');
    setPunchesStartDate('');
    setPunchesEndDate('');
    setPunchesCurrentPage(1);
  };

  const hasActiveFilters = 
    punchesSearchTerm ||
    punchesSingleDate ||
    punchesStartDate ||
    punchesEndDate ||
    punchesDevice !== 'all' ||
    punchesDept !== 'all' ||
    punchesVerification !== 'all' ||
    punchesType !== 'all';

  const activeFiltersCount = [
    punchesSingleDate,
    punchesStartDate,
    punchesEndDate,
    punchesDevice !== 'all' ? punchesDevice : null,
    punchesDept !== 'all' ? punchesDept : null,
    punchesVerification !== 'all' ? punchesVerification : null,
    punchesType !== 'all' ? punchesType : null
  ].filter(Boolean).length;

  const handleClearAllFilters = () => {
    setPunchesSearchTerm('');
    setPunchesSingleDate('');
    setPunchesStartDate('');
    setPunchesEndDate('');
    setPunchesDevice('all');
    setPunchesDept('all');
    setPunchesVerification('all');
    setPunchesType('all');
    setPunchesQuickFilter('all');
    setPunchesCurrentPage(1);
  };

  const pollJobStatus = (jobId: string) => {
    setSyncJobStatus('PENDING (Waiting for local client)');
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/devices/sync-history/status?jobId=${jobId}`);
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.status === 'PROCESSING') {
            setSyncJobStatus('PROCESSING (Client is uploading logs)');
          } else if (data.status === 'COMPLETED') {
            setSyncJobStatus('COMPLETED');
            setSyncHistoryResult(data.result);
            setIsSyncingHistory(false);
            clearInterval(interval);
            router.refresh();
          } else if (data.status === 'FAILED') {
            setSyncJobStatus('FAILED');
            alert(data.error || 'The synchronization job failed.');
            setIsSyncingHistory(false);
            clearInterval(interval);
          }
        } else {
          clearInterval(interval);
          setIsSyncingHistory(false);
          alert(data.error || 'Failed to get sync job status.');
        }
      } catch (err) {
        clearInterval(interval);
        setIsSyncingHistory(false);
        alert('An error occurred while polling sync job status.');
      }
    }, 2000);
  };

  const handleSyncHistory = async () => {
    setIsSyncingHistory(true);
    setSyncHistoryResult(null);
    setSyncJobStatus('CREATING JOB...');
    try {
      const res = await fetch('/api/admin/devices/sync-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rangeType: syncHistoryRange,
          startDate: syncHistoryRange === 'custom' ? syncHistoryStart : undefined,
          endDate: syncHistoryRange === 'custom' ? syncHistoryEnd : undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.jobId) {
        pollJobStatus(data.jobId);
      } else {
        alert(data.error || 'Failed to trigger historical sync.');
        setIsSyncingHistory(false);
      }
    } catch (err) {
      alert('An error occurred during synchronization.');
      setIsSyncingHistory(false);
    }
  };
  
  // Toast notifications state
  const [toasts, setToasts] = useState<{ id: any; title: string; message: string; type: string }[]>([]);

  // Shift Configuration States (initialized from localStorage in useEffect)
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [graceMins, setGraceMins] = useState(15);

  // Interactive Chart Hover States
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);

  // Selected Metric card state for detailed details table
  const [selectedMetric, setSelectedMetric] = useState<'total' | 'present' | 'wfh' | 'leave' | 'late' | 'ot' | 'most_hours' | 'least_hours' | null>(null);
  const [detailSearchTerm, setDetailSearchTerm] = useState('');
  const [detailCurrentPage, setDetailCurrentPage] = useState(1);
  const [detailOfficeFilter, setDetailOfficeFilter] = useState<'all' | '1' | '2'>('all');

  // Selected Month for monthly metrics calculations (defaults to current month)
  const [selectedMonthMetrics, setSelectedMonthMetrics] = useState(() => {
    return format(new Date(), 'yyyy-MM');
  });

  // Compute list of months available for dashboard metric selection
  const availableMonthsMetrics = useMemo(() => {
    const months = new Set<string>();
    months.add(format(new Date(), 'yyyy-MM'));
    (processedLogs || []).forEach((l: any) => {
      if (l.date && l.date.length >= 7) {
        months.add(l.date.substring(0, 7));
      }
    });
    (wfhLogs || []).forEach((l: any) => {
      if (l.date && l.date.length >= 7) {
        months.add(l.date.substring(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [processedLogs, wfhLogs]);

  // Calculate the total worked hours (biometric + WFH) per employee for the selected month
  const monthlyHoursPerEmployee = useMemo(() => {
    const hoursMap = new Map<number, number>();
    
    (employees || []).forEach(emp => {
      hoursMap.set(emp.id, 0);
    });

    const biometricPunches = new Map<number, Map<string, string[]>>();
    (processedLogs || [])
      .filter((log: any) => log.date && log.date.startsWith(selectedMonthMetrics))
      .forEach((log: any) => {
        const userId = getUserIdForLog(log);
        if (!userId) return;
        
        if (!biometricPunches.has(userId)) {
          biometricPunches.set(userId, new Map());
        }
        const userDays = biometricPunches.get(userId)!;
        if (!userDays.has(log.date)) {
          userDays.set(log.date, []);
        }
        userDays.get(log.date)!.push(log.time);
      });

    biometricPunches.forEach((userDays, userId) => {
      let userBiometricHours = 0;
      userDays.forEach((times) => {
        if (times.length > 1) {
          const sorted = [...times].sort();
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          userBiometricHours += calculateHours(first, last);
        }
      });
      hoursMap.set(userId, (hoursMap.get(userId) || 0) + userBiometricHours);
    });

    (wfhLogs || [])
      .filter((log: any) => log.date && log.date.startsWith(selectedMonthMetrics))
      .forEach((wfh: any) => {
        hoursMap.set(wfh.userId, (hoursMap.get(wfh.userId) || 0) + (wfh.hours || 0));
      });

    const result: { userId: number; name: string; username: string; hours: number }[] = [];
    hoursMap.forEach((hours, userId) => {
      const emp = (employees || []).find(e => e.id === userId);
      if (emp) {
        result.push({
          userId,
          name: emp.name,
          username: emp.username,
          hours
        });
      }
    });

    return result;
  }, [employees, processedLogs, wfhLogs, selectedMonthMetrics]);

  // Compute the employee with the minimum hours and maximum hours for the selected month
  const monthlyMinMaxStats = useMemo(() => {
    if (monthlyHoursPerEmployee.length === 0) {
      return { min: null, max: null };
    }
    const sorted = [...monthlyHoursPerEmployee].sort((a, b) => a.hours - b.hours);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    return { min, max };
  }, [monthlyHoursPerEmployee]);

  // Administrative Overrides States
  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [showForceOutModal, setShowForceOutModal] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState<any>(null);
  const [excuseReason, setExcuseReason] = useState('');
  const [forceOutTime, setForceOutTime] = useState('18:00');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  // Merge Employee States
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceEmployee, setMergeSourceEmployee] = useState<any>(null);
  const [mergeTargetSearch, setMergeTargetSearch] = useState('');
  const [mergeTargetUserId, setMergeTargetUserId] = useState('');
  const [isSubmittingMerge, setIsSubmittingMerge] = useState(false);

  // Helper to calculate late arrival in minutes
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

  // Helper to calculate overtime in minutes
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

  // Helper to trigger toasts
  const showToast = (toast: { id: any; title: string; message: string; type: string }) => {
    setToasts((prev) => {
      if (prev.some((t) => t.id === toast.id)) return prev;
      return [...prev, toast];
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4000);
  };

  // Read shift config from localStorage on mount
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

  // Polling for new swipes
  useEffect(() => {
    const pollLogs = async () => {
      try {
        const res = await fetch('/api/admin/live-activity');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.logs) {
            const existingIds = new Set(currentLogs.map((l: any) => l.id));
            const newLogs = data.logs.filter((l: any) => !existingIds.has(l.id));

            if (newLogs.length > 0) {
              setCurrentLogs((prev) => {
                const combined = [...newLogs, ...prev];
                const uniqueMap = new Map();
                combined.forEach((item) => {
                  uniqueMap.set(item.id, item);
                });
                return Array.from(uniqueMap.values()).sort((a: any, b: any) => {
                  const dateCompare = b.date.localeCompare(a.date);
                  if (dateCompare !== 0) return dateCompare;
                  return b.time.localeCompare(a.time);
                });
              });

              newLogs.slice(0, 3).forEach((log: any) => {
                showToast({
                  id: log.id,
                  title: 'Live Swipe Detected',
                  message: `${log.name || `User (${log.enrollId})`} checked at ${log.time} in ${log.place || 'Main Gate'}`,
                  type: 'info',
                });
              });
            }
          }
        }
      } catch (err) {
        console.error('Error polling live activity logs:', err);
      }
    };

    const interval = setInterval(pollLogs, 10000);
    return () => clearInterval(interval);
  }, [currentLogs]);

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
      setSelectedEmployees(prev => { const next = new Set(prev); next.delete(id); return next; });
      router.refresh();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEmployees.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedEmployees.size} employee(s)? This action cannot be undone.`)) return;
    setIsBulkDeleting(true);
    const idsToDelete = Array.from(selectedEmployees);
    const results = await Promise.allSettled(
      idsToDelete.map(id => fetch(`/api/admin/employees?id=${id}`, { method: 'DELETE' }))
    );
    const deletedIds: number[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.ok) {
        deletedIds.push(idsToDelete[index]);
      }
    });
    if (deletedIds.length > 0) {
      setEmployees(prev => prev.filter(emp => !deletedIds.includes(emp.id)));
      setSelectedEmployees(new Set());
      router.refresh();
    }
    if (deletedIds.length < idsToDelete.length) {
      alert(`Failed to delete ${idsToDelete.length - deletedIds.length} employee(s). ${deletedIds.length} deleted successfully.`);
    }
    setIsBulkDeleting(false);
  };

  const toggleSelectEmployee = (id: number) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCurrentPage = () => {
    const currentIds = currentEmployees.map((emp: any) => emp.id);
    const allSelected = currentIds.every((id: number) => selectedEmployees.has(id));
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (allSelected) {
        currentIds.forEach((id: number) => next.delete(id));
      } else {
        currentIds.forEach((id: number) => next.add(id));
      }
      return next;
    });
  };

  const openMergeModal = (emp: any) => {
    setMergeSourceEmployee(emp);
    setMergeTargetSearch('');
    setMergeTargetUserId('');
    setShowMergeModal(true);
  };

  const handleToggleVisibility = async (enrollmentId: number, isLogVisible: boolean) => {
    try {
      const res = await fetch('/api/admin/device-enrollments/toggle-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: enrollmentId, isLogVisible })
      });
      if (res.ok) {
        setDeviceEnrollments((prev: any) => prev.map((e: any) => 
          e.id === enrollmentId ? { ...e, isLogVisible } : e
        ));
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to toggle visibility');
      }
    } catch (err) {
      console.error(err);
      alert('Error toggling visibility');
    }
  };

  const handleUnclubEnrollment = async (enrollmentId: number) => {
    if (!confirm('Are you sure you want to unclub/split this floor enrollment from this profile?')) return;
    try {
      const res = await fetch('/api/admin/employees/unclub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Successfully unclubbed enrollment!');
        window.location.reload();
      } else {
        alert(data.error || 'Failed to unclub enrollment');
      }
    } catch (err) {
      console.error(err);
      alert('Error unclubbing enrollment');
    }
  };

  const handleMergeEmployees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSourceEmployee || !mergeTargetUserId) return;
    setIsSubmittingMerge(true);
    try {
      const res = await fetch('/api/admin/employees/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUserId: mergeSourceEmployee.id,
          targetUserId: Number(mergeTargetUserId)
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees(employees.filter(emp => emp.id !== mergeSourceEmployee.id));
        if (data.enrollments) {
          setDeviceEnrollments(data.enrollments);
        }
        alert(data.message || 'Successfully merged employees!');
        setShowMergeModal(false);
        setMergeSourceEmployee(null);
        setMergeTargetSearch('');
        setMergeTargetUserId('');
        router.refresh();
      } else {
        alert(data.error || 'Failed to merge employees');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred during merging');
    }
    setIsSubmittingMerge(false);
  };

  const openEditModal = (emp: any) => {
    setEditFormData({ id: emp.id, username: emp.username, password: '', name: emp.name, dept: emp.dept || '', enrollId: emp.enrollId || '' });
    setShowEditModal(false);
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
      const err = await res.json();
      alert(err.error || 'Failed to update employee');
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
    formData.append('year', new Date().getFullYear().toString());
    
    try {
      const res = await fetch('/api/admin/upload-leaves', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully import leave balances for ${data.count} employees!`);
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

  const handleGoogleLeavesSync = async () => {
    setSyncingGoogleLeaves(true);
    try {
      const res = await fetch('/api/admin/sync-google-leaves', {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Google Sheet leaves sync complete! Created/Updated: ${data.createdCount || 0}, Deleted/Cancelled: ${data.deletedCount || 0}`);
        setShowMassLeavesModal(false);
        router.refresh();
      } else {
        alert(data.error || 'Sync failed');
      }
    } catch {
      alert('Sync request failed');
    } finally {
      setSyncingGoogleLeaves(false);
    }
  };

  // Memoized stats for the dashboard tab
  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const totalEmp = employees.length;
    
    // Active Today: swiped in today
    const swipedToday = new Set<number>(
      processedLogs
        .filter((l: any) => l.date === today)
        .map((l: any) => getUserIdForLog(l))
        .filter(Boolean) as number[]
    );
    
    // WFH Today
    const wfhToday = new Set<number>(
      wfhLogs
        .filter((l: any) => l.date === today)
        .map((l: any) => l.userId)
    );
    
    // On Leave Today
    const leaveToday = new Set<number>(
      leaveRecords
        .filter((l: any) => l.date === today && l.type !== 'Pending')
        .map((l: any) => l.userId)
    );
    
    const presentOfficeCount = swipedToday.size;
    const presentWfhCount = wfhToday.size;
    const leaveCount = leaveToday.size;
    const activeCount = new Set([
      ...Array.from(swipedToday),
      ...Array.from(wfhToday)
    ]).size;
    const absentCount = Math.max(0, totalEmp - activeCount - leaveCount);
    
    // Today's punches grouped by userId to compute late today and OT today
    const todayPunches = new Map<number, any[]>();
    processedLogs
      .filter((l: any) => l.date === today)
      .forEach((l: any) => {
        const userId = getUserIdForLog(l);
        if (!userId) return;
        if (!todayPunches.has(userId)) {
          todayPunches.set(userId, []);
        }
        todayPunches.get(userId)!.push(l);
      });

    let lateTodayCount = 0;
    let otTodayMinutes = 0;

    todayPunches.forEach((punches) => {
      const sorted = [...punches].sort((a, b) => a.time.localeCompare(b.time));
      const earliestLog = sorted[0];
      const earliest = earliestLog.time;
      const latest = sorted[sorted.length - 1].time;

      const isExcused = earliestLog.remark && earliestLog.remark.startsWith('Excused:');

      const lateMins = getLateMinutes(earliest, shiftStart, graceMins);
      if (lateMins > 0 && !isExcused) lateTodayCount++;

      const otMins = getOvertimeMinutes(earliest, latest, shiftEnd);
      otTodayMinutes += otMins;
    });

    // Last 7 Days trend
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), i);
      return format(d, 'yyyy-MM-dd');
    }).reverse();
    
    const trendData = last7Days.map(dateStr => {
      const swiped = new Set<number>(
        processedLogs
          .filter((l: any) => l.date === dateStr)
          .map((l: any) => getUserIdForLog(l))
          .filter(Boolean) as number[]
      );
      const wfh = new Set<number>(
        wfhLogs
          .filter((l: any) => l.date === dateStr)
          .map((l: any) => l.userId)
      );
      const uniqueActive = new Set([
        ...Array.from(swiped),
        ...Array.from(wfh)
      ]);
      const rate = totalEmp > 0 ? Math.round((uniqueActive.size / totalEmp) * 100) : 0;
      return {
        date: format(parseISO(dateStr), 'dd MMM'),
        count: uniqueActive.size,
        rate: rate
      };
    });
    
    const deptCounts: { [key: string]: number } = {};
    employees.forEach(e => {
      const d = e.dept || 'Unassigned';
      deptCounts[d] = (deptCounts[d] || 0) + 1;
    });
    const deptData = Object.entries(deptCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Peak Punching Hours calculation (overall habit)
    const hourCounts = Array.from({ length: 12 }, (_, idx) => {
      const h = idx + 8; // Hours from 8 AM to 7 PM
      const label = h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`;
      return { hour: h, display: label, count: 0 };
    });

    processedLogs.forEach((l: any) => {
      if (l.time && l.time.includes(':')) {
        const hour = parseInt(l.time.split(':')[0], 10);
        if (hour >= 8 && hour <= 19) {
          const match = hourCounts.find(hc => hc.hour === hour);
          if (match) match.count++;
        }
      }
    });
    
    return {
      totalEmp,
      presentOfficeCount,
      presentWfhCount,
      leaveCount,
      absentCount,
      trendData,
      deptData,
      lateTodayCount,
      otTodayMinutes,
      hourCounts
    };
  }, [employees, processedLogs, wfhLogs, leaveRecords, shiftStart, shiftEnd, graceMins]);

  // Click handler to toggle metrics cards
  const handleMetricClick = (metric: 'total' | 'present' | 'wfh' | 'leave' | 'late' | 'ot' | 'most_hours' | 'least_hours') => {
    setSelectedMetric(prev => {
      if (prev === metric) return null;
      setDetailSearchTerm('');
      setDetailCurrentPage(1);
      setDetailOfficeFilter('all');
      return metric;
    });
  };

  const handleExportExcel = () => {
    if (!selectedMetric) return;

    let exportData: any[] = [];
    const today = format(new Date(), 'yyyy-MM-dd');
    const fileName = `attendance-${selectedMetric}-${today}.xlsx`;

    switch (selectedMetric) {
      case 'total':
        exportData = filteredDetailedList.map((item: any) => ({
          'User ID': item.username,
          'Name': item.name,
          'Department': item.dept,
          'Biometric Enroll ID': item.enrollId
        }));
        break;
      case 'present':
        exportData = filteredDetailedList.map((item: any) => ({
          'User ID': item.username,
          'Name': item.name,
          'Department': item.dept,
          'First Swipe': item.firstSwipe,
          'Last Swipe': item.lastSwipe,
          'Device Location': item.place
        }));
        break;
      case 'wfh':
        exportData = filteredDetailedList.map((item: any) => ({
          'User ID': item.username,
          'Name': item.name,
          'Department': item.dept,
          'WFH Hours': item.hours,
          'Remarks': item.remarks
        }));
        break;
      case 'leave':
        exportData = filteredDetailedList.map((item: any) => ({
          'User ID': item.username,
          'Name': item.name,
          'Department': item.dept,
          'Leave Type': item.leaveType
        }));
        break;
      case 'late':
        exportData = filteredDetailedList.map((item: any) => ({
          'User ID': item.username,
          'Name': item.name,
          'Department': item.dept,
          'Check-in Time': item.checkIn,
          'Minutes Late': item.lateMins,
          'Status': item.isExcused ? `Excused: ${item.excuseText}` : 'Unexcused'
        }));
        break;
      case 'ot':
        exportData = filteredDetailedList.map((item: any) => ({
          'User ID': item.username,
          'Name': item.name,
          'Department': item.dept,
          'Check-in Time': item.checkIn,
          'Check-out Time': item.checkOut,
          'Overtime Duration': `${Math.floor(item.otMins / 60)}h ${item.otMins % 60}m`
        }));
        break;
      case 'most_hours':
      case 'least_hours':
        exportData = filteredDetailedList.map((item: any) => ({
          'User ID': item.username,
          'Name': item.name,
          'Department': item.dept,
          'Biometric Enroll ID': item.enrollId,
          'Total Monthly Hours': item.hours.toFixed(2)
        }));
        break;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Sheet');
    XLSX.writeFile(workbook, fileName);
  };

  const handleExcuseLateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee || !excuseReason.trim()) return;

    setIsSubmittingAdjustment(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const res = await fetch('/api/admin/adjust-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'excuse-late',
          enrollId: targetEmployee.enrollId,
          date: today,
          reason: excuseReason.trim()
        })
      });

      if (res.ok) {
        alert(`Late entry for ${targetEmployee.name} has been excused.`);
        setShowExcuseModal(false);
        setExcuseReason('');
        setTargetEmployee(null);
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to excuse late entry');
      }
    } catch (err) {
      alert('An error occurred during submission.');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const handleForceOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee || !forceOutTime.trim()) return;

    setIsSubmittingAdjustment(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const res = await fetch('/api/admin/adjust-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'force-checkout',
          enrollId: targetEmployee.enrollId,
          date: today,
          time: forceOutTime.trim()
        })
      });

      if (res.ok) {
        alert(`Manual check-out recorded at ${forceOutTime} for ${targetEmployee.name}.`);
        setShowForceOutModal(false);
        setForceOutTime('18:00');
        setTargetEmployee(null);
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to record check-out');
      }
    } catch (err) {
      alert('An error occurred during submission.');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  // Detailed list resolver based on active metric
  const detailedList = useMemo(() => {
    if (!selectedMetric) return [];

    const today = format(new Date(), 'yyyy-MM-dd');

    // Group punches today by userId for efficient lookup, filtered by office if applicable
    const todayPunches = new Map<number, any[]>();
    processedLogs
      .filter((l: any) => {
        if (l.date !== today) return false;
        if (detailOfficeFilter === 'all') return true;
        return (l.deviceId || '1') === detailOfficeFilter;
      })
      .forEach((l: any) => {
        const userId = getUserIdForLog(l);
        if (!userId) return;
        if (!todayPunches.has(userId)) {
          todayPunches.set(userId, []);
        }
        todayPunches.get(userId)!.push(l);
      });

    const filterByEmployeeOffice = (emp: any) => {
      if (detailOfficeFilter === 'all') return true;
      const offices: string[] = [];
      (deviceEnrollments || []).filter((e: any) => e.userId === emp.id).forEach((e: any) => {
        if (!offices.includes(e.deviceId)) {
          offices.push(e.deviceId);
        }
      });
      if (!emp.username?.endsWith('-2f') && !offices.includes('1')) {
        offices.push('1');
      }
      return offices.includes(detailOfficeFilter);
    };

    switch (selectedMetric) {
      case 'total':
        return employees
          .filter(filterByEmployeeOffice)
          .map(emp => ({
            id: emp.id,
            username: emp.username,
            name: emp.name,
            dept: emp.dept || 'Unassigned',
            enrollId: emp.enrollId || '-',
            details: 'Registered Employee'
          }));

      case 'present': {
        return employees
          .filter(emp => todayPunches.has(emp.id))
          .map(emp => {
            const punches = todayPunches.get(emp.id)!;
            const sortedPunches = [...punches].sort((a, b) => a.time.localeCompare(b.time));
            const firstSwipe = sortedPunches[0];
            const lastSwipe = sortedPunches[sortedPunches.length - 1];
            const hasCheckedOut = sortedPunches.length > 1 && firstSwipe.time !== lastSwipe.time;
            return {
              id: emp.id,
              username: emp.username,
              name: emp.name,
              dept: emp.dept || 'Unassigned',
              enrollId: emp.enrollId,
              firstSwipe: firstSwipe?.time || '-',
              lastSwipe: lastSwipe?.time || '-',
              hasCheckedOut,
              place: firstSwipe?.place || 'Office Gate',
              details: `First: ${firstSwipe?.time || '-'}, Last: ${lastSwipe?.time || '-'}`
            };
          });
      }

      case 'wfh': {
        const todayWfh = wfhLogs.filter((l: any) => l.date === today);
        const wfhMap = new Map<number, any>();
        todayWfh.forEach(w => wfhMap.set(w.userId, w));

        return employees
          .filter(emp => wfhMap.has(emp.id) && filterByEmployeeOffice(emp))
          .map(emp => {
            const record = wfhMap.get(emp.id)!;
            return {
              id: emp.id,
              username: emp.username,
              name: emp.name,
              dept: emp.dept || 'Unassigned',
              enrollId: emp.enrollId || '-',
              hours: record.hours,
              remarks: record.remarks || 'No remarks',
              details: `WFH: ${record.hours}h - ${record.remarks || 'No remarks'}`
            };
          });
      }

      case 'leave': {
        const todayLeaves = leaveRecords.filter((l: any) => l.date === today && l.type !== 'Pending');
        const leaveMap = new Map<number, any>();
        todayLeaves.forEach(l => leaveMap.set(l.userId, l));

        return employees
          .filter(emp => leaveMap.has(emp.id) && filterByEmployeeOffice(emp))
          .map(emp => {
            const record = leaveMap.get(emp.id)!;
            return {
              id: emp.id,
              username: emp.username,
              name: emp.name,
              dept: emp.dept || 'Unassigned',
              enrollId: emp.enrollId || '-',
              leaveType: record.type,
              details: `${record.type} Leave`
            };
          });
      }

      case 'late': {
        return employees
          .filter(emp => todayPunches.has(emp.id))
          .map(emp => {
            const punches = todayPunches.get(emp.id)!;
            const sorted = [...punches].sort((a, b) => a.time.localeCompare(b.time));
            const earliestLog = sorted[0];
            const earliest = earliestLog.time;
            const lateMins = getLateMinutes(earliest, shiftStart, graceMins);
            const isExcused = earliestLog.remark && earliestLog.remark.startsWith('Excused:');
            const excuseText = isExcused ? earliestLog.remark.replace('Excused:', '').trim() : '';

            return {
              id: emp.id,
              username: emp.username,
              name: emp.name,
              dept: emp.dept || 'Unassigned',
              enrollId: emp.enrollId,
              checkIn: earliest,
              lateMins,
              isExcused,
              excuseText,
              details: isExcused 
                ? `Excused: ${excuseText} (Arrived at ${earliest})`
                : `Late by ${lateMins} mins (Checked in at ${earliest})`
            };
          })
          .filter(item => item.lateMins > 0);
      }

      case 'ot': {
        return employees
          .filter(emp => todayPunches.has(emp.id))
          .map(emp => {
            const punches = todayPunches.get(emp.id)!;
            const sortedTimes = punches.map(p => p.time).sort();
            const earliest = sortedTimes[0];
            const latest = sortedTimes[sortedTimes.length - 1];
            const hasCheckedOut = sortedTimes.length > 1 && earliest !== latest;
            const otMins = hasCheckedOut ? getOvertimeMinutes(earliest, latest, shiftEnd) : 0;
            return {
              id: emp.id,
              username: emp.username,
              name: emp.name,
              dept: emp.dept || 'Unassigned',
              enrollId: emp.enrollId,
              checkIn: earliest,
              checkOut: latest || '-',
              otMins,
              details: hasCheckedOut 
                ? `OT: ${Math.floor(otMins / 60)}h ${otMins % 60}m (Checked out at ${latest})`
                : `No checkout (OT requires checkout)`
            };
          })
          .filter(item => item.otMins > 0);
      }

      case 'most_hours': {
        return [...monthlyHoursPerEmployee]
          .filter(filterByEmployeeOffice)
          .sort((a, b) => b.hours - a.hours)
          .map(item => ({
            id: item.userId,
            username: item.username,
            name: item.name,
            dept: (employees || []).find(e => e.id === item.userId)?.dept || 'Unassigned',
            enrollId: (employees || []).find(e => e.id === item.userId)?.enrollId || '-',
            hours: item.hours,
            details: `Worked ${item.hours.toFixed(2)} hours in ${selectedMonthMetrics}`
          }));
      }

      case 'least_hours': {
        return [...monthlyHoursPerEmployee]
          .filter(filterByEmployeeOffice)
          .sort((a, b) => a.hours - b.hours)
          .map(item => ({
            id: item.userId,
            username: item.username,
            name: item.name,
            dept: (employees || []).find(e => e.id === item.userId)?.dept || 'Unassigned',
            enrollId: (employees || []).find(e => e.id === item.userId)?.enrollId || '-',
            hours: item.hours,
            details: `Worked ${item.hours.toFixed(2)} hours in ${selectedMonthMetrics}`
          }));
      }

      default:
        return [];
    }
  }, [employees, processedLogs, wfhLogs, leaveRecords, selectedMetric, shiftStart, shiftEnd, graceMins, detailOfficeFilter, deviceEnrollments, monthlyHoursPerEmployee, selectedMonthMetrics]);

  // Helper to check if a log matches the search text
  const matchesPunchesSearch = (log: any, term: string) => {
    const nameMatch = log.name?.toLowerCase().includes(term);
    const enrollMatch = log.enrollId?.toLowerCase().includes(term);
    const placeMatch = log.place?.toLowerCase().includes(term);
    const typeMatch = log.attType?.toLowerCase().includes(term);
    return nameMatch || enrollMatch || placeMatch || typeMatch;
  };

  const baseFilteredPunches = useMemo(() => {
    return processedLogs.filter((log: any) => {
      // 1. Search term
      if (punchesSearchTerm.trim()) {
        const term = punchesSearchTerm.toLowerCase();
        if (!matchesPunchesSearch(log, term)) return false;
      }
      
      // 2. Date Range
      if (punchesSingleDate) {
        if (log.date !== punchesSingleDate) return false;
      } else {
        if (punchesStartDate) {
          if (log.date < punchesStartDate) return false;
        }
        if (punchesEndDate) {
          if (log.date > punchesEndDate) return false;
        }
      }
      
      // 3. Device Selector
      if (punchesDevice !== 'all') {
        if (log.deviceId !== punchesDevice) return false;
      }

      // 4. Department Selector
      if (punchesDept !== 'all') {
        const logDept = (log.dept || '').toLowerCase();
        if (logDept !== punchesDept.toLowerCase()) return false;
      }

      // 5. Verification Mode Selector
      if (punchesVerification !== 'all') {
        const logMoc = (log.verifyMoc || '').toLowerCase();
        if (punchesVerification === 'fingerprint') {
          if (log.verifyMoc && !logMoc.includes('finger')) return false;
        } else if (punchesVerification === 'face') {
          if (logMoc !== 'face') return false;
        } else if (punchesVerification === 'card') {
          if (logMoc !== 'card') return false;
        }
      }

      // 6. Punch Type Selector
      if (punchesType !== 'all') {
        if (log.attType !== punchesType) return false;
      }
      
      return true;
    });
  }, [processedLogs, punchesSearchTerm, punchesStartDate, punchesEndDate, punchesDevice, punchesSingleDate, punchesDept, punchesVerification, punchesType]);

  // Dynamic counts for quick filter buttons based on search term, date range, and device location
  const punchesQuickFilterCounts = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const oneDayAgo = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    
    return {
      all: baseFilteredPunches.length,
      today: baseFilteredPunches.filter((l: any) => l.date === todayStr).length,
      recent: baseFilteredPunches.filter((l: any) => l.date >= oneDayAgo).length,
      late: baseFilteredPunches.filter((l: any) => {
        const isLate = getLateMinutes(l.time, shiftStart, graceMins) > 0;
        const isExcused = l.remark && l.remark.startsWith('Excused:');
        return isLate && !isExcused;
      }).length,
      in: baseFilteredPunches.filter((l: any) => l.attType === 'Check In').length,
      out: baseFilteredPunches.filter((l: any) => l.attType === 'Check Out').length,
      finger: baseFilteredPunches.filter((l: any) => !l.verifyMoc || l.verifyMoc.toLowerCase().includes('finger')).length,
      card: baseFilteredPunches.filter((l: any) => l.verifyMoc === 'Card').length,
      face: baseFilteredPunches.filter((l: any) => l.verifyMoc === 'Face').length,
    };
  }, [baseFilteredPunches, shiftStart, graceMins]);

  // Final filtered punches for table display
  const filteredPunches = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const oneDayAgo = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    
    return baseFilteredPunches.filter((log: any) => {
      if (punchesQuickFilter === 'today') {
        if (log.date !== todayStr) return false;
      } else if (punchesQuickFilter === 'recent') {
        if (log.date < oneDayAgo) return false;
      } else if (punchesQuickFilter === 'late') {
        const isLate = getLateMinutes(log.time, shiftStart, graceMins) > 0;
        const isExcused = log.remark && log.remark.startsWith('Excused:');
        if (!isLate || isExcused) return false;
      } else if (punchesQuickFilter === 'in') {
        if (log.attType !== 'Check In') return false;
      } else if (punchesQuickFilter === 'out') {
        if (log.attType !== 'Check Out') return false;
      } else if (punchesQuickFilter === 'finger') {
        const isFinger = !log.verifyMoc || log.verifyMoc.toLowerCase().includes('finger');
        if (!isFinger) return false;
      } else if (punchesQuickFilter === 'card') {
        if (log.verifyMoc !== 'Card') return false;
      } else if (punchesQuickFilter === 'face') {
        if (log.verifyMoc !== 'Face') return false;
      }
      return true;
    });
  }, [baseFilteredPunches, punchesQuickFilter, shiftStart, graceMins]);

  const punchesRowsPerPage = 15;
  const punchesTotalPages = Math.max(1, Math.ceil(filteredPunches.length / punchesRowsPerPage));
  const punchesStartIdx = (punchesCurrentPage - 1) * punchesRowsPerPage;
  const currentPunches = filteredPunches.slice(punchesStartIdx, punchesStartIdx + punchesRowsPerPage);

  const handleExportPunches = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const fileName = `punches-feed-${punchesQuickFilter}-${today}.xlsx`;
    const exportData = filteredPunches.map((item: any) => ({
      'Enroll ID': item.enrollId || '-',
      'Name': item.name || `Employee ${item.enrollId}`,
      'Department': item.dept || '-',
      'Date': item.date,
      'Time': item.time,
      'Type': item.attType || 'Normal Open',
      'Verification': 'Fingerprint',
      'Device Place': item.place || `Device ${item.deviceId}`,
      'Remarks': item.remark || 'Success'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Punches Log');
    XLSX.writeFile(workbook, fileName);
  };

  // Search filter
  const filteredDetailedList = useMemo(() => {
    if (!detailSearchTerm.trim()) return detailedList;
    const term = detailSearchTerm.toLowerCase();
    return detailedList.filter((item: any) =>
      item.name.toLowerCase().includes(term) ||
      item.username.toLowerCase().includes(term) ||
      (item.dept && item.dept.toLowerCase().includes(term)) ||
      (item.enrollId && item.enrollId.toLowerCase().includes(term))
    );
  }, [detailedList, detailSearchTerm]);

  // Pagination values
  const detailRowsPerPage = 10;
  const detailTotalPages = Math.max(1, Math.ceil(filteredDetailedList.length / detailRowsPerPage));
  const detailStartIdx = (detailCurrentPage - 1) * detailRowsPerPage;
  const paginatedDetailedList = filteredDetailedList.slice(detailStartIdx, detailStartIdx + detailRowsPerPage);
  // Recent timeline feed
  const recentActivity = useMemo(() => {
    const activities: any[] = [];
    
    processedLogs.slice(0, 20).forEach((l: any) => {
      activities.push({
        type: 'swipe',
        name: l.name || `User (${l.enrollId})`,
        details: `Punched in/out at ${l.time} (${l.place || 'Biometric Device'})`,
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
  }, [processedLogs, wfhLogs, leaveRecords]);

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (emp.dept && emp.dept.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (emp.enrollId && emp.enrollId.toLowerCase().includes(searchTerm.toLowerCase()));
      
    if (!matchesSearch) return false;
    if (officeFilter === 'all') return true;

    const offices: string[] = [];
    const enrolls = (deviceEnrollments || []).filter((e: any) => e.userId === emp.id);
    enrolls.forEach((e: any) => {
      if (!offices.includes(e.deviceId)) {
        offices.push(e.deviceId);
      }
    });
    if (!emp.username.endsWith('-2f') && !offices.includes('1')) {
      offices.push('1');
    }
    return offices.includes(officeFilter);
  });

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
        <button 
          onClick={() => setActiveTab('punches')} 
          className="btn"
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'punches' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'punches' ? '3px solid var(--primary)' : '3px solid transparent',
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
          <Clock size={18} />
          Punches Feed
        </button>
        <button 
          onClick={() => setActiveTab('enrollments')} 
          className="btn"
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'enrollments' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'enrollments' ? '3px solid var(--primary)' : '3px solid transparent',
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
          <RefreshCw size={18} />
          Enrollments
        </button>
        <button 
          onClick={() => setActiveTab('consoleUsers')} 
          className="btn"
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'consoleUsers' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'consoleUsers' ? '3px solid var(--primary)' : '3px solid transparent',
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
          <Shield size={18} />
          Console Users
        </button>
        <button 
          onClick={() => setActiveTab('unknownScans')} 
          className="btn"
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'unknownScans' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'unknownScans' ? '3px solid var(--primary)' : '3px solid transparent',
            borderRadius: 0,
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            position: 'relative'
          }}
        >
          <AlertCircle size={18} />
          Unknown FP Scans
          {(() => {
            const unknownCount = attendanceLogs.filter((l: any) => l.userId == null).length;
            return unknownCount > 0 ? (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
                borderRadius: '999px',
                padding: '0.1rem 0.45rem',
                minWidth: '18px',
                textAlign: 'center',
                lineHeight: '1.3'
              }}>{unknownCount > 999 ? '999+' : unknownCount}</span>
            ) : null;
          })()}
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeInUp 0.4s ease' }}>
          
          <style>{`
            @keyframes countdown {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>

          {/* Toast Container */}
          <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '360px', width: '100%' }}>
            {toasts.map((toast) => (
              <div key={toast.id} style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 15px rgba(99, 102, 241, 0.25)',
                borderRadius: '0.75rem',
                padding: '1rem',
                color: 'var(--text-main)',
                position: 'relative',
                overflow: 'hidden',
                animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ color: 'var(--primary)', marginTop: '0.1rem' }}>
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>{toast.title}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: '1.4' }}>{toast.message}</p>
                  </div>
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)',
                  width: '100%',
                  animation: 'countdown 4s linear forwards'
                }} />
              </div>
            ))}
          </div>

          {/* Key Metric Cards */}
          <div className="metrics-grid">
            <div 
              onClick={() => handleMetricClick('total')}
              className={`glass-panel clickable-metric-card ${selectedMetric === 'total' ? 'active-indigo' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}
            >
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '1rem', borderRadius: '1rem' }}>
                <Users size={28} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Total Employees</h4>
                <p style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.totalEmp}</p>
              </div>
            </div>

            <div 
              onClick={() => handleMetricClick('present')}
              className={`glass-panel clickable-metric-card ${selectedMetric === 'present' ? 'active-emerald' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}
            >
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--secondary)', padding: '1rem', borderRadius: '1rem' }}>
                <CheckCircle size={28} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Present (Office)</h4>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--secondary)' }}>{stats.presentOfficeCount}</p>
              </div>
            </div>

            <div 
              onClick={() => handleMetricClick('wfh')}
              className={`glass-panel clickable-metric-card ${selectedMetric === 'wfh' ? 'active-amber' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}
            >
              <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '1rem', borderRadius: '1rem' }}>
                <Home size={28} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Working From Home</h4>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{stats.presentWfhCount}</p>
              </div>
            </div>

            <div 
              onClick={() => handleMetricClick('leave')}
              className={`glass-panel clickable-metric-card ${selectedMetric === 'leave' ? 'active-red' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}
            >
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '1rem', borderRadius: '1rem' }}>
                <Calendar size={28} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>On Leave Today</h4>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>{stats.leaveCount}</p>
              </div>
            </div>

            <div 
              onClick={() => handleMetricClick('late')}
              className={`glass-panel clickable-metric-card ${selectedMetric === 'late' ? 'active-red' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}
            >
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '1rem', borderRadius: '1rem' }}>
                <Clock size={28} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Late Today</h4>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>{stats.lateTodayCount}</p>
              </div>
            </div>

            <div 
              onClick={() => handleMetricClick('ot')}
              className={`glass-panel clickable-metric-card ${selectedMetric === 'ot' ? 'active-emerald' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}
            >
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--secondary)', padding: '1rem', borderRadius: '1rem' }}>
                <TrendingUp size={28} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Overtime Today</h4>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--secondary)' }}>
                  {stats.otTodayMinutes > 0 ? `${Math.floor(stats.otTodayMinutes / 60)}h ${stats.otTodayMinutes % 60}m` : '0h 0m'}
                </p>
              </div>
            </div>
          </div>

          {/* Monthly Leaderboard Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={22} style={{ color: 'var(--primary)' }} /> Monthly Hours Leaderboard
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(15, 23, 42, 0.4)', padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Month:</span>
              <select 
                className="input-field" 
                style={{ width: 'auto', minWidth: '130px', padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.9rem', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}
                value={selectedMonthMetrics}
                onChange={(e) => {
                  setSelectedMonthMetrics(e.target.value);
                  setDetailCurrentPage(1);
                  setDetailSearchTerm('');
                }}
              >
                {availableMonthsMetrics.map(m => (
                  <option key={m} value={m} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                    {format(parseISO(`${m}-01`), 'MMMM yyyy')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div 
              onClick={() => handleMetricClick('most_hours')}
              className={`glass-panel clickable-metric-card ${selectedMetric === 'most_hours' ? 'active-emerald' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}
            >
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1rem', borderRadius: '1rem' }}>
                <TrendingUp size={28} />
              </div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Most Hours in Month</h4>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {monthlyMinMaxStats.max ? monthlyMinMaxStats.max.name : '—'}
                </p>
                <small style={{ color: 'var(--text-muted)' }}>
                  {monthlyMinMaxStats.max ? `${monthlyMinMaxStats.max.hours.toFixed(1)} hrs` : '0 hrs'}
                </small>
              </div>
            </div>

            <div 
              onClick={() => handleMetricClick('least_hours')}
              className={`glass-panel clickable-metric-card ${selectedMetric === 'least_hours' ? 'active-red' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}
            >
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '1rem', borderRadius: '1rem' }}>
                <Clock size={28} />
              </div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Least Hours in Month</h4>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {monthlyMinMaxStats.min ? monthlyMinMaxStats.min.name : '—'}
                </p>
                <small style={{ color: 'var(--text-muted)' }}>
                  {monthlyMinMaxStats.min ? `${monthlyMinMaxStats.min.hours.toFixed(1)} hrs` : '0 hrs'}
                </small>
              </div>
            </div>
          </div>

          {/* Detailed Metric View Panel */}
          {selectedMetric && (
            <div className="glass-panel animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {selectedMetric === 'total' && 'Total Registered Employees'}
                    {selectedMetric === 'present' && 'Employees Present in Office Today'}
                    {selectedMetric === 'wfh' && 'Employees Working From Home Today'}
                    {selectedMetric === 'leave' && 'Employees On Leave Today'}
                    {selectedMetric === 'late' && 'Employees Late Today'}
                    {selectedMetric === 'ot' && 'Employees Accrued Overtime Today'}
                    {selectedMetric === 'most_hours' && 'Employees Ranked by Monthly Hours (Most to Least)'}
                    {selectedMetric === 'least_hours' && 'Employees Ranked by Monthly Hours (Least to Most)'}
                    <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', marginLeft: '0.5rem', padding: '0.15rem 0.5rem' }}>
                      {filteredDetailedList.length} matching
                    </span>
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
                    {selectedMetric === 'total' && 'Full roster of active system accounts'}
                    {selectedMetric === 'present' && 'Details of employees who have swiped at least once today'}
                    {selectedMetric === 'wfh' && 'Details of remote hours logged and notes'}
                    {selectedMetric === 'leave' && 'Approved leave records today'}
                    {selectedMetric === 'late' && `Employees arriving after shift start + grace period (${shiftStart} + ${graceMins}m)`}
                    {selectedMetric === 'ot' && `Employees working beyond scheduled shift end time (${shiftEnd})`}
                    {(selectedMetric === 'most_hours' || selectedMetric === 'least_hours') && `Roster of employees ranked by accumulated hours for the month of ${format(parseISO(`${selectedMonthMetrics}-01`), 'MMMM yyyy')}`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Office:</span>
                    <select
                      className="input-field"
                      value={detailOfficeFilter}
                      onChange={(e) => {
                        setDetailOfficeFilter(e.target.value as any);
                        setDetailCurrentPage(1);
                      }}
                      style={{ padding: '0.5rem 0.75rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', fontSize: '0.875rem', color: 'var(--text-main)' }}
                    >
                      <option value="all">Both</option>
                      <option value="1">Office 1 (3F)</option>
                      <option value="2">Office 2 (2F)</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search details..."
                    value={detailSearchTerm}
                    onChange={(e) => {
                      setDetailSearchTerm(e.target.value);
                      setDetailCurrentPage(1);
                    }}
                    style={{ maxWidth: '240px', padding: '0.5rem 0.75rem', background: 'rgba(15, 23, 42, 0.4)', fontSize: '0.875rem' }}
                  />
                  <button
                    onClick={handleExportExcel}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    Export to Excel
                  </button>
                  <button
                    onClick={() => setSelectedMetric(null)}
                    className="btn btn-outline"
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="table-container" style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.2)' }}>
                <table className="modern-table" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.75rem' }}>User ID</th>
                      <th style={{ padding: '0.75rem' }}>Name</th>
                      <th style={{ padding: '0.75rem' }}>Department</th>
                      {selectedMetric === 'total' && <th style={{ padding: '0.75rem' }}>Enroll ID</th>}
                      {selectedMetric === 'present' && (
                        <>
                          <th style={{ padding: '0.75rem' }}>First Swipe</th>
                          <th style={{ padding: '0.75rem' }}>Last Swipe</th>
                          <th style={{ padding: '0.75rem' }}>Device Location</th>
                        </>
                      )}
                      {selectedMetric === 'wfh' && (
                        <>
                          <th style={{ padding: '0.75rem' }}>WFH Hours</th>
                          <th style={{ padding: '0.75rem' }}>Remarks</th>
                        </>
                      )}
                      {selectedMetric === 'leave' && <th style={{ padding: '0.75rem' }}>Leave Type</th>}
                      {selectedMetric === 'late' && (
                        <>
                          <th style={{ padding: '0.75rem' }}>First Swipe</th>
                          <th style={{ padding: '0.75rem' }}>Late Duration</th>
                        </>
                      )}
                      {selectedMetric === 'ot' && (
                        <>
                          <th style={{ padding: '0.75rem' }}>First Swipe</th>
                          <th style={{ padding: '0.75rem' }}>Last Swipe</th>
                          <th style={{ padding: '0.75rem' }}>Overtime Duration</th>
                        </>
                      )}
                      {(selectedMetric === 'most_hours' || selectedMetric === 'least_hours') && (
                        <>
                          <th style={{ padding: '0.75rem' }}>Biometric Enroll ID</th>
                          <th style={{ padding: '0.75rem' }}>Total Monthly Hours</th>
                        </>
                      )}
                      {(selectedMetric === 'present' || selectedMetric === 'late') && <th style={{ padding: '0.75rem' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDetailedList.map((item: any) => (
                      <tr 
                        key={item.id} 
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}
                        onClick={() => router.push(`/admin/employee/${item.id}`)}
                      >
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{item.username}</td>
                        <td style={{ padding: '0.75rem' }}>{item.name}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.05)', color: 'var(--text-muted)' }}>
                            {item.dept}
                          </span>
                        </td>
                        {selectedMetric === 'total' && <td style={{ padding: '0.75rem' }}>{item.enrollId}</td>}
                        {selectedMetric === 'present' && (
                          <>
                            <td style={{ padding: '0.75rem', fontWeight: 500, color: 'var(--secondary)' }}>{item.firstSwipe}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 500, color: 'var(--secondary)' }}>{item.lastSwipe}</td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.place}</td>
                          </>
                        )}
                        {selectedMetric === 'wfh' && (
                          <>
                            <td style={{ padding: '0.75rem', fontWeight: 600, color: '#f59e0b' }}>{item.hours} hrs</td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.remarks}</td>
                          </>
                        )}
                        {selectedMetric === 'leave' && (
                          <td style={{ padding: '0.75rem' }}>
                            <span className="badge badge-error" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>{item.leaveType}</span>
                          </td>
                        )}
                        {selectedMetric === 'late' && (
                          <>
                            <td style={{ padding: '0.75rem', color: item.isExcused ? 'var(--secondary)' : '#ef4444', fontWeight: 500 }}>{item.checkIn}</td>
                            <td style={{ padding: '0.75rem' }}>
                              {item.isExcused ? (
                                <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--secondary)' }} title={`Reason: ${item.excuseText}`}>
                                  Late (Excused)
                                </span>
                              ) : (
                                <span className="badge badge-error" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                                  Late by {item.lateMins} mins
                                </span>
                              )}
                            </td>
                          </>
                        )}
                        {selectedMetric === 'ot' && (
                          <>
                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{item.checkIn}</td>
                            <td style={{ padding: '0.75rem', color: 'var(--secondary)', fontWeight: 500 }}>{item.checkOut}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span className="badge badge-success">
                                {Math.floor(item.otMins / 60)}h {item.otMins % 60}m OT
                              </span>
                            </td>
                          </>
                        )}
                        {(selectedMetric === 'most_hours' || selectedMetric === 'least_hours') && (
                          <>
                            <td style={{ padding: '0.75rem' }}>{item.enrollId}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>{item.hours.toFixed(2)} hrs</td>
                          </>
                        )}
                        {(selectedMetric === 'present' || selectedMetric === 'late') && (
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              {selectedMetric === 'present' && !item.hasCheckedOut && (
                                <button
                                  className="btn btn-outline"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: '#f59e0b', borderColor: '#f59e0b' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTargetEmployee(item);
                                    setForceOutTime('18:00');
                                    setShowForceOutModal(true);
                                  }}
                                >
                                  Force Out
                                </button>
                              )}
                              {selectedMetric === 'late' && (
                                item.isExcused ? (
                                  <span className="badge badge-success" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--secondary)' }} title={`Reason: ${item.excuseText}`}>
                                    Excused
                                  </span>
                                ) : (
                                  <button
                                    className="btn btn-outline"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: '#10b981', borderColor: '#10b981' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTargetEmployee(item);
                                      setExcuseReason('');
                                      setShowExcuseModal(true);
                                    }}
                                  >
                                    Excuse
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {paginatedDetailedList.length === 0 && (
                      <tr>
                        <td 
                          colSpan={
                            selectedMetric === 'present' ? 7 :
                            (selectedMetric === 'ot' || selectedMetric === 'late') ? 6 :
                            (selectedMetric === 'wfh' || selectedMetric === 'most_hours' || selectedMetric === 'least_hours') ? 5 : 4
                          } 
                          style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}
                        >
                          {(selectedMetric === 'most_hours' || selectedMetric === 'least_hours')
                            ? 'No matching records found for this month.'
                            : 'No matching records found today.'
                          }
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {detailTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(30, 41, 59, 0.2)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Showing {filteredDetailedList.length > 0 ? detailStartIdx + 1 : 0} to {Math.min(detailStartIdx + detailRowsPerPage, filteredDetailedList.length)} of {filteredDetailedList.length}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      disabled={detailCurrentPage === 1}
                      onClick={() => setDetailCurrentPage(prev => Math.max(1, prev - 1))}
                    >
                      Prev
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      {detailCurrentPage} / {detailTotalPages}
                    </span>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      disabled={detailCurrentPage === detailTotalPages}
                      onClick={() => setDetailCurrentPage(prev => Math.min(detailTotalPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Visual Charts section - Row 1 */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            
            {/* SVG Line Graph (Trend) */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Attendance Rate Trend</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Daily activity over the last 7 days (Hover points for details)</p>
              </div>
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
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
                  
                  {/* Invisible Vertical Interaction Bars */}
                  {points.map((p, i) => {
                    const barW = (chartWidth - 2 * chartPadding) / 6;
                    return (
                      <rect
                        key={`interact-${i}`}
                        x={p.x - barW / 2}
                        y={chartPadding}
                        width={barW}
                        height={chartHeight - 2 * chartPadding}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredTrendIdx(i)}
                        onMouseLeave={() => setHoveredTrendIdx(null)}
                      />
                    );
                  })}

                  {points.map((p, i) => (
                    <g key={i} pointerEvents="none">
                      <circle 
                        cx={p.x} 
                        cy={p.y} 
                        r={hoveredTrendIdx === i ? '6' : '4'} 
                        fill="var(--bg-dark)" 
                        stroke="var(--primary)" 
                        strokeWidth="2" 
                        style={{ transition: 'all 0.15s ease' }}
                      />
                      {hoveredTrendIdx === i && (
                        <circle cx={p.x} cy={p.y} r="12" fill="var(--primary)" fillOpacity="0.2" />
                      )}
                      <text x={p.x} y={p.y - 10} fill="var(--text-main)" fontSize="9" fontWeight="600" textAnchor="middle">{p.rate}%</text>
                      <text x={p.x} y={chartHeight - chartPadding + 16} fill="var(--text-muted)" fontSize="9" textAnchor="middle">{p.date}</text>
                    </g>
                  ))}
                </svg>

                {/* Trend Hover Tooltip */}
                {hoveredTrendIdx !== null && (
                  <div style={{
                    position: 'absolute',
                    top: `${points[hoveredTrendIdx].y - 50}px`,
                    left: `${(points[hoveredTrendIdx].x / chartWidth) * 100}%`,
                    transform: 'translateX(-50%)',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid var(--glass-border)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    pointerEvents: 'none',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 10,
                    textAlign: 'center',
                    minWidth: '100px'
                  }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.1rem' }}>{points[hoveredTrendIdx].date}</div>
                    <div style={{ color: 'var(--primary)', fontWeight: 700 }}>Rate: {points[hoveredTrendIdx].rate}%</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{points[hoveredTrendIdx].count} Active Users</div>
                  </div>
                )}
              </div>
            </div>

            {/* SVG Donut + Today's Status */}
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

          {/* Visual Charts section - Row 2 */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            
            {/* SVG Peak Punching Hours Bar Chart */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Peak Punching Hours</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Hour-by-hour cumulative swipe distribution (Hover bars)</p>
              </div>
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--secondary)" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map(val => {
                    const y = chartPadding + ((100 - val) * (chartHeight - 2 * chartPadding)) / 100;
                    return (
                      <line key={`grid-${val}`} x1={chartPadding} y1={y} x2={chartWidth - chartPadding} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    );
                  })}

                  {/* Draw Bars */}
                  {stats.hourCounts.map((hc, idx) => {
                    const maxCount = Math.max(...stats.hourCounts.map(h => h.count), 1);
                    const colWidth = (chartWidth - 2 * chartPadding) / 12;
                    const barW = colWidth - 8;
                    const barH = (hc.count / maxCount) * (chartHeight - 2 * chartPadding);
                    const x = chartPadding + idx * colWidth + 4;
                    const y = chartHeight - chartPadding - barH;

                    return (
                      <g key={`bar-g-${idx}`}>
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={Math.max(barH, 2)}
                          fill="url(#bar-gradient)"
                          rx="4"
                          style={{
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                            fillOpacity: hoveredBarIdx === idx ? 1.0 : 0.8
                          }}
                          onMouseEnter={() => setHoveredBarIdx(idx)}
                          onMouseLeave={() => setHoveredBarIdx(null)}
                        />
                        <text
                          x={x + barW / 2}
                          y={chartHeight - chartPadding + 14}
                          fill="var(--text-muted)"
                          fontSize="8"
                          textAnchor="middle"
                          transform={`rotate(15, ${x + barW / 2}, ${chartHeight - chartPadding + 14})`}
                        >
                          {hc.display.replace(' AM', '').replace(' PM', '')}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Bar Chart Tooltip */}
                {hoveredBarIdx !== null && (
                  <div style={{
                    position: 'absolute',
                    top: `${chartHeight - chartPadding - (stats.hourCounts[hoveredBarIdx].count / Math.max(...stats.hourCounts.map(hc => hc.count), 1)) * (chartHeight - 2 * chartPadding) - 40}px`,
                    left: `${((chartPadding + hoveredBarIdx * ((chartWidth - 2 * chartPadding) / 12) + ((chartWidth - 2 * chartPadding) / 12) / 2) / chartWidth) * 100}%`,
                    transform: 'translateX(-50%)',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid var(--glass-border)',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    pointerEvents: 'none',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 10,
                    textAlign: 'center',
                    minWidth: '90px'
                  }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{stats.hourCounts[hoveredBarIdx].display}</div>
                    <div style={{ color: 'var(--secondary)', fontWeight: 700 }}>{stats.hourCounts[hoveredBarIdx].count} Swipes</div>
                  </div>
                )}
              </div>
            </div>

            {/* Shift Configuration Widget */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Shift & Grace Configuration</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Configure baseline parameters for tracking late entries and overtime limits</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Shift Start</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    value={shiftStart} 
                    onChange={e => {
                      setShiftStart(e.target.value);
                      localStorage.setItem('shiftStart', e.target.value);
                    }} 
                    style={{ padding: '0.5rem' }} 
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Shift End</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    value={shiftEnd} 
                    onChange={e => {
                      setShiftEnd(e.target.value);
                      localStorage.setItem('shiftEnd', e.target.value);
                    }} 
                    style={{ padding: '0.5rem' }} 
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Grace Mins</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={graceMins} 
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setGraceMins(val);
                      localStorage.setItem('graceMins', val.toString());
                    }} 
                    style={{ padding: '0.5rem' }} 
                    min={0}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => alert('Baseline shift rules updated successfully!')}>
                  Apply Shifts
                </button>
              </div>
            </div>
          </div>

          {/* Visual Charts section - Row 3 */}
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
      )}

      {activeTab === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeInUp 0.4s ease' }}>
          
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Employee Overview</h2>
              <p style={{ color: 'var(--text-muted)' }}>Manage your workforce and attendance logs</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => setShowHolidayModal(true)}>Manage Holidays</button>
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
            </div>
          </div>

          <div className="table-container">
            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input 
                   type="text" 
                   className="input-field" 
                   placeholder="Search by ID, Name, Dept..." 
                   value={searchTerm} 
                   onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                   style={{ maxWidth: '300px', background: 'rgba(15, 23, 42, 0.4)', margin: 0 }}
                />
                {selectedEmployees.size > 0 && (
                  <button
                    className="btn"
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    style={{
                      padding: '0.4rem 1rem',
                      fontSize: '0.8rem',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#ef4444',
                      borderRadius: '8px',
                      cursor: isBulkDeleting ? 'wait' : 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isBulkDeleting ? 'Deleting...' : `Delete Selected (${selectedEmployees.size})`}
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Show:</span>
                  <select
                    className="input-field"
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{ padding: '0.35rem 0.5rem', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-main)', width: 'auto', margin: 0 }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={999999}>All</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Office Filter:</span>
                <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: '0.2rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <button 
                    style={{ 
                      padding: '0.35rem 0.8rem', 
                      fontSize: '0.75rem', 
                      borderRadius: '4px', 
                      border: 'none', 
                      cursor: 'pointer',
                      background: officeFilter === 'all' ? 'var(--primary)' : 'transparent',
                      color: officeFilter === 'all' ? '#fff' : 'var(--text-muted)',
                      fontWeight: officeFilter === 'all' ? 700 : 500,
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => { setOfficeFilter('all'); setCurrentPage(1); }}
                  >
                    Both
                  </button>
                  <button 
                    style={{ 
                      padding: '0.35rem 0.8rem', 
                      fontSize: '0.75rem', 
                      borderRadius: '4px', 
                      border: 'none', 
                      cursor: 'pointer',
                      background: officeFilter === '1' ? 'var(--primary)' : 'transparent',
                      color: officeFilter === '1' ? '#fff' : 'var(--text-muted)',
                      fontWeight: officeFilter === '1' ? 700 : 500,
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => { setOfficeFilter('1'); setCurrentPage(1); }}
                  >
                    Office 1 (3F)
                  </button>
                  <button 
                    style={{ 
                      padding: '0.35rem 0.8rem', 
                      fontSize: '0.75rem', 
                      borderRadius: '4px', 
                      border: 'none', 
                      cursor: 'pointer',
                      background: officeFilter === '2' ? 'var(--primary)' : 'transparent',
                      color: officeFilter === '2' ? '#fff' : 'var(--text-muted)',
                      fontWeight: officeFilter === '2' ? 700 : 500,
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => { setOfficeFilter('2'); setCurrentPage(1); }}
                  >
                    Office 2 (2F)
                  </button>
                </div>
              </div>
            </div>
          </div>
            <table className="modern-table">
               <thead>
                 <tr>
                   <th style={{ width: '40px', textAlign: 'center' }}>
                     <input
                       type="checkbox"
                       checked={currentEmployees.length > 0 && currentEmployees.every((emp: any) => selectedEmployees.has(emp.id))}
                       onChange={toggleSelectAllCurrentPage}
                       onClick={(e) => e.stopPropagation()}
                       style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                       title="Select all on this page"
                     />
                   </th>
                   <th>Employee ID</th>
                   <th>Name</th>
                   <th>Dept</th>
                   <th>Enroll ID</th>
                   <th>Offices</th>
                   <th>Actions</th>
                 </tr>
               </thead>
               <tbody>
                  {currentEmployees.map(emp => {
                    const offices: string[] = [];
                    const enrolls = (deviceEnrollments || []).filter((e: any) => e.userId === emp.id);
                    enrolls.forEach((e: any) => {
                      if (!offices.includes(e.deviceId)) {
                        offices.push(e.deviceId);
                      }
                    });
                    if (!emp.username.endsWith('-2f') && !offices.includes('1')) {
                      offices.push('1');
                    }
                    
                    const hasConflict = enrollIdConflictUserIds.has(emp.id);
                    return (
                    <tr 
                      key={emp.id} 
                      style={{ 
                        cursor: 'pointer',
                        background: hasConflict ? 'rgba(245,158,11,0.07)' : undefined 
                      }}
                      onClick={() => router.push(`/admin/employee/${emp.id}`)}
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedEmployees.has(emp.id)}
                          onChange={() => toggleSelectEmployee(emp.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', fontSize: '1rem' }}>{emp.username}</td>
                      <td>{emp.name}</td>
                      <td><span className="badge badge-warning">{emp.dept || 'None'}</span></td>
                       <td>
                        {(() => {
                          const userEnrollments = (deviceEnrollments || []).filter((e: any) => e.userId === emp.id);
                          if (userEnrollments.length === 0) {
                            return emp.enrollId ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <code style={{ color: 'var(--primary)', fontWeight: 600 }}>{emp.enrollId}</code>
                                {hasConflict && (
                                  <span title="This enroll ID is shared with a different person in another office" style={{ color: '#f59e0b', fontSize: '0.9rem', cursor: 'help' }}>⚠️</span>
                                )}
                              </span>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>;
                          }
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {userEnrollments.map((e: any) => (
                                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <code style={{ 
                                    color: e.isLogVisible ? 'var(--primary)' : 'var(--text-muted)', 
                                    fontWeight: 600,
                                    textDecoration: e.isLogVisible ? 'none' : 'line-through' 
                                  }}>
                                    {e.enrollId} ({e.deviceId === '1' ? '3F' : '2F'})
                                  </code>
                                  <button
                                    title={e.isLogVisible ? "Hide logs from this floor on dashboard" : "Show logs from this floor on dashboard"}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                    onClick={(event) => { event.stopPropagation(); handleToggleVisibility(e.id, !e.isLogVisible); }}
                                  >
                                    {e.isLogVisible ? (
                                      <Eye size={16} style={{ color: 'var(--primary)' }} />
                                    ) : (
                                      <EyeOff size={16} style={{ color: 'var(--text-muted)' }} />
                                    )}
                                  </button>
                                  {userEnrollments.length > 1 && (
                                    <button 
                                      className="btn btn-outline" 
                                      style={{ padding: '0.05rem 0.3rem', fontSize: '0.6rem', height: 'auto', lineHeight: 1, borderColor: '#ef4444', color: '#ef4444' }}
                                      onClick={(event) => { event.stopPropagation(); handleUnclubEnrollment(e.id); }}
                                    >
                                      Unclub
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        {offices.length === 0
                          ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                          : <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {offices.includes('1') && <span style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)' }}>3F</span>}
                              {offices.includes('2') && <span style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>2F</span>}
                            </div>
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--primary)', color: 'var(--primary)' }} onClick={(event) => { event.stopPropagation(); openMergeModal(emp); }}>Merge</button>
                          <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--secondary)', color: 'var(--secondary)' }} onClick={(event) => { event.stopPropagation(); openEditModal(emp); }}>Edit</button>
                          <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444' }} onClick={(event) => { event.stopPropagation(); handleDelete(emp.id); }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                 {currentEmployees.length === 0 && (
                   <tr>
                     <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
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
              <input className="input-field" placeholder="Employee ID (for login)" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              <input className="input-field" placeholder="Password" type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              <input className="input-field" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input className="input-field" placeholder="Department (Optional)" value={formData.dept} onChange={e => setFormData({...formData, dept: e.target.value})} />
              <input className="input-field" placeholder="Biometric Enroll ID (Optional)" value={formData.enrollId} onChange={e => setFormData({...formData, enrollId: e.target.value})} />
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

      {showMergeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '500px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Merge Employee Profile</h3>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.88rem', color: '#f59e0b', display: 'flex', gap: '0.5rem' }}>
              <span>⚠️</span>
              <span>
                You are merging <strong>{mergeSourceEmployee?.name}</strong> (Employee ID: {mergeSourceEmployee?.username}) into another account. This will transfer all biometric mappings, WFH logs, and leave records to the target employee, and permanently delete the <strong>{mergeSourceEmployee?.name}</strong> record.
              </span>
            </div>
            
            <form onSubmit={handleMergeEmployees} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="label">Select Target Employee (to merge INTO)</label>
                <input 
                  className="input-field" 
                  type="text" 
                  placeholder="Search target employee by name or ID..." 
                  value={mergeTargetSearch} 
                  onChange={e => { setMergeTargetSearch(e.target.value); setMergeTargetUserId(''); }} 
                  style={{ marginBottom: '0.5rem' }} 
                  required={!mergeTargetUserId}
                />
                
                {mergeTargetSearch && !mergeTargetUserId && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', maxHeight: '180px', overflowY: 'auto', background: 'var(--surface)', zIndex: 102 }}>
                    {employees
                      .filter((u: any) => {
                        if (u.id === mergeSourceEmployee?.id) return false; // cannot merge into self
                        const q = mergeTargetSearch.toLowerCase();
                        return u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || String(u.id).includes(q);
                      })
                      .slice(0, 8)
                      .map((u: any) => (
                        <div key={u.id} onClick={() => { setMergeTargetUserId(String(u.id)); setMergeTargetSearch(u.name); }} style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{u.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>@{u.username}</span></span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ID {u.username}</span>
                        </div>
                      ))
                    }
                    {employees.filter((u: any) => u.id !== mergeSourceEmployee?.id && (u.name?.toLowerCase().includes(mergeTargetSearch.toLowerCase()) || String(u.id).includes(mergeTargetSearch))).length === 0 && (
                      <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No matching employees found</div>
                    )}
                  </div>
                )}
                {mergeTargetUserId && <div style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '0.4rem', fontWeight: 600 }}>✓ Selected Target ID: {mergeTargetUserId} ({mergeTargetSearch})</div>}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!mergeTargetUserId || isSubmittingMerge}>
                  {isSubmittingMerge ? 'Merging...' : 'Confirm & Merge'}
                </button>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowMergeModal(false); setMergeSourceEmployee(null); }}>
                  Cancel
                </button>
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

      {activeTab === 'punches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeInUp 0.4s ease' }}>
          
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={24} style={{ color: 'var(--primary)' }} />
                Biometric Punches Feed
              </h2>
              <p style={{ color: 'var(--text-muted)' }}>Real-time logs received from all active fingerprint machines</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                className="btn btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} 
                onClick={() => {
                  setShowSyncHistoryModal(true);
                  setSyncHistoryResult(null);
                }}
              >
                <RefreshCw size={16} />
                Sync Scanner History
              </button>
              <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleExportPunches}>
                <Download size={16} />
                Export to Excel
              </button>
            </div>
          </div>

          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Filters Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '1rem' }}>
              
              {/* Search Bar */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '300px' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '400px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Search name, Enroll ID, location..." 
                    value={punchesSearchTerm} 
                    onChange={(e) => { setPunchesSearchTerm(e.target.value); setPunchesCurrentPage(1); }}
                    style={{ paddingLeft: '2.5rem', background: 'rgba(15, 23, 42, 0.4)' }}
                  />
                </div>
                
                {/* Advanced Filters Toggle */}
                <button
                  className="btn btn-outline"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.88rem',
                    padding: '0.75rem 1.25rem',
                    borderColor: showAdvancedFilters || activeFiltersCount > 0 ? 'var(--primary)' : 'var(--border-color)',
                    color: showAdvancedFilters || activeFiltersCount > 0 ? 'var(--primary)' : 'var(--text-main)',
                    background: showAdvancedFilters ? 'rgba(99, 102, 241, 0.08)' : 'transparent'
                  }}
                >
                  <Filter size={16} />
                  Filters
                  {activeFiltersCount > 0 && (
                    <span style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '999px',
                      fontWeight: 700
                    }}>
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Clear All Filters */}
              {hasActiveFilters && (
                <button 
                  className="btn" 
                  onClick={handleClearAllFilters}
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <RefreshCw size={14} />
                  Clear All Filters
                </button>
              )}
            </div>

            {/* Collapsible Advanced Filters Section */}
            {showAdvancedFilters && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                padding: '1.25rem',
                background: 'rgba(15, 23, 42, 0.25)',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-color)',
                animation: 'fadeInUp 0.25s ease'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  
                  {/* Location Select */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Device Location</span>
                    <select 
                      className="input-field" 
                      value={punchesDevice} 
                      onChange={(e) => { setPunchesDevice(e.target.value as any); setPunchesCurrentPage(1); }}
                      style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'var(--bg-dark)', border: '1px solid var(--glass-border)' }}
                    >
                      <option value="all">All Offices</option>
                      <option value="1">Office 1 Entrance</option>
                      <option value="2">Office 2 Entrance</option>
                    </select>
                  </div>

                  {/* Department Select */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</span>
                    <select 
                      className="input-field" 
                      value={punchesDept} 
                      onChange={(e) => { setPunchesDept(e.target.value); setPunchesCurrentPage(1); }}
                      style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'var(--bg-dark)', border: '1px solid var(--glass-border)' }}
                    >
                      <option value="all">All Departments</option>
                      {departmentsList.map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Verification Mode Select */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Mode</span>
                    <select 
                      className="input-field" 
                      value={punchesVerification} 
                      onChange={(e) => { setPunchesVerification(e.target.value); setPunchesCurrentPage(1); }}
                      style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'var(--bg-dark)', border: '1px solid var(--glass-border)' }}
                    >
                      <option value="all">All Modes</option>
                      <option value="fingerprint">Fingerprint</option>
                      <option value="face">Face</option>
                      <option value="card">Card</option>
                    </select>
                  </div>

                  {/* Punch Type Select */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Punch Type</span>
                    <select 
                      className="input-field" 
                      value={punchesType} 
                      onChange={(e) => { setPunchesType(e.target.value); setPunchesCurrentPage(1); }}
                      style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'var(--bg-dark)', border: '1px solid var(--glass-border)' }}
                    >
                      <option value="all">All Types</option>
                      <option value="Check In">Check In</option>
                      <option value="Check Out">Check Out</option>
                    </select>
                  </div>
                </div>

                {/* Date Selection */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  
                  {/* Single Specific Date Calendar Picker */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '160px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Specific Date</span>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={punchesSingleDate} 
                      onChange={(e) => handleSingleDateChange(e.target.value)}
                      style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'var(--bg-dark)', border: '1px solid var(--glass-border)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', height: '36px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
                    OR
                  </div>

                  {/* Date Range From */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '140px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From Date</span>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={punchesStartDate} 
                      onChange={(e) => handleRangeStartDateChange(e.target.value)}
                      style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'var(--bg-dark)', border: '1px solid var(--glass-border)' }}
                    />
                  </div>

                  {/* Date Range To */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '140px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To Date</span>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={punchesEndDate} 
                      onChange={(e) => handleRangeEndDateChange(e.target.value)}
                      style={{ padding: '0.5rem', fontSize: '0.85rem', background: 'var(--bg-dark)', border: '1px solid var(--glass-border)' }}
                    />
                  </div>

                  {/* Clear Dates Button */}
                  {(punchesStartDate || punchesEndDate || punchesSingleDate) && (
                    <button 
                      className="btn" 
                      onClick={handleClearDates}
                      style={{ height: '36px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'none', padding: '0 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <RefreshCw size={12} />
                      Clear Dates
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick Filters Navigation */}
            <div className="no-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {[
                { id: 'all', label: 'All Swipes', count: punchesQuickFilterCounts.all },
                { id: 'today', label: 'Today', count: punchesQuickFilterCounts.today },
                { id: 'recent', label: 'Recent (24h)', count: punchesQuickFilterCounts.recent },
                { id: 'late', label: 'Late Arrival', count: punchesQuickFilterCounts.late },
                { id: 'in', label: 'Check In', count: punchesQuickFilterCounts.in },
                { id: 'out', label: 'Check Out', count: punchesQuickFilterCounts.out },
                { id: 'finger', label: 'Fingerprint', count: punchesQuickFilterCounts.finger },
                { id: 'card', label: 'Card Swipes', count: punchesQuickFilterCounts.card },
                { id: 'face', label: 'Face Swipes', count: punchesQuickFilterCounts.face }
              ].map(qf => (
                <button
                  key={qf.id}
                  onClick={() => { setPunchesQuickFilter(qf.id as any); setPunchesCurrentPage(1); }}
                  className="btn"
                  style={{
                    background: punchesQuickFilter === qf.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                    color: punchesQuickFilter === qf.id ? 'var(--bg-dark)' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {qf.label}
                  <span style={{ 
                    background: punchesQuickFilter === qf.id ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)', 
                    color: punchesQuickFilter === qf.id ? 'var(--bg-dark)' : 'var(--text-muted)',
                    fontSize: '0.75rem', 
                    padding: '0.1rem 0.4rem', 
                    borderRadius: '0.25rem',
                    fontWeight: 700
                  }}>
                    {qf.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Table Container */}
            <div className="table-container" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Biometric Enroll ID</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Verification</th>
                    <th>Device Location</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPunches.map((log: any, idx: number) => {
                    const isLate = log.date === format(new Date(), 'yyyy-MM-dd') && getLateMinutes(log.time, shiftStart, graceMins) > 0;
                    const isExcused = log.remark && log.remark.startsWith('Excused:');
                    
                    return (
                      <tr 
                        key={log.id || `${log.enrollId}_${log.date}_${log.time}_${idx}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          const userId = getUserIdForLog(log);
                          if (userId) {
                            router.push(`/admin/employee/${userId}`);
                          }
                        }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                              color: 'var(--bg-dark)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem'
                            }}>
                              {log.name ? log.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{log.name || 'Unknown'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>scanner_user_{log.enrollId}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <code style={{ color: 'var(--primary)', fontWeight: 600 }}>{log.enrollId}</code>
                        </td>
                        <td>{log.date}</td>
                        <td style={{ fontWeight: 500 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                            {log.time}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${
                            log.attType === 'Check In' ? 'badge-success' : 
                            log.attType === 'Check Out' ? 'badge-warning' : 'badge-info'
                          }`} style={{
                            background: log.attType === 'Check In' ? 'rgba(16, 185, 129, 0.15)' : 
                                        log.attType === 'Check Out' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                            color: log.attType === 'Check In' ? 'var(--secondary)' : 
                                   log.attType === 'Check Out' ? '#f59e0b' : 'var(--primary)'
                          }}>
                            {log.attType || 'Normal Open'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fingerprint</span>
                        </td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                            <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                            {log.place || `Device ${log.deviceId}`}
                          </span>
                        </td>
                        <td>
                          {isLate && !isExcused ? (
                            <span className="badge badge-danger" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                              Late Arrival
                            </span>
                          ) : isExcused ? (
                            <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--secondary)' }} title={log.remark}>
                              Excused
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{log.remark || 'Success'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {currentPunches.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No punch logs found matching the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {punchesTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', background: 'rgba(30, 41, 59, 0.2)', borderRadius: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Showing {filteredPunches.length > 0 ? punchesStartIdx + 1 : 0} to {Math.min(punchesStartIdx + punchesRowsPerPage, filteredPunches.length)} of {filteredPunches.length} records
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-outline" 
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} 
                    disabled={punchesCurrentPage === 1} 
                    onClick={() => setPunchesCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    Prev
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                    {punchesCurrentPage} / {punchesTotalPages}
                  </span>
                  <button 
                    className="btn btn-outline" 
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} 
                    disabled={punchesCurrentPage === punchesTotalPages} 
                    onClick={() => setPunchesCurrentPage(prev => Math.min(punchesTotalPages, prev + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {showMassLeavesModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '600px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Mass Upload Leave Balances</h3>
            
            {/* Google Sheets Sync Box */}
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '1.5rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.5rem', fontWeight: 600, color: '#60a5fa' }}>Sync with Google Sheets Tracker</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Fetch and update leaves automatically from your published Google Sheets tracker (maps via Employee ID and processes approved entries).
              </p>
              <button 
                className="btn btn-primary"
                onClick={handleGoogleLeavesSync}
                disabled={syncingGoogleLeaves}
                style={{ width: '100%' }}
              >
                {syncingGoogleLeaves ? 'Syncing with Google Sheets...' : 'Sync Now from Google Sheet'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>or upload file</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
            </div>

            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>Upload an Excel or CSV file manually to overwrite employee leave balances.</p>
            
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
                className="btn btn-secondary" 
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

      {showSyncHistoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '600px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={20} style={{ color: 'var(--primary)' }} />
              On-Demand Biometric Sync
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Connect directly to Office 1 and Office 2 devices to pull and synchronize historical logs.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>Sync Range</span>
                <select 
                  className="input-field" 
                  value={syncHistoryRange} 
                  onChange={(e) => setSyncHistoryRange(e.target.value as any)}
                  style={{ background: 'var(--bg-dark)' }}
                >
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="3months">Last 3 Months</option>
                  <option value="6months">Last 6 Months</option>
                  <option value="beginning">From Beginning (All Device Logs)</option>
                  <option value="custom">Specific Date Range (Custom)</option>
                </select>
              </div>

              {syncHistoryRange === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>From Date</span>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={syncHistoryStart} 
                      onChange={(e) => setSyncHistoryStart(e.target.value)}
                      style={{ background: 'var(--bg-dark)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>To Date</span>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={syncHistoryEnd} 
                      onChange={(e) => setSyncHistoryEnd(e.target.value)}
                      style={{ background: 'var(--bg-dark)' }}
                    />
                  </div>
                </div>
              )}

              {/* Sync Results Display */}
              {syncHistoryResult && (
                <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>Sync Results</h4>
                  
                  {/* Office 1 */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Office 1 (3rd Floor):</span>
                      {syncHistoryResult.office1?.status === 'success' ? (
                        <span style={{ color: 'var(--secondary)' }}>Success</span>
                      ) : (
                        <span style={{ color: '#ef4444' }}>Failed</span>
                      )}
                    </div>
                    {syncHistoryResult.office1?.status === 'success' ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Fetched {syncHistoryResult.office1.totalFetched} logs, imported {syncHistoryResult.office1.inserted} new entries.
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: '#ef4444', marginTop: '0.15rem' }}>
                        Error: {syncHistoryResult.office1?.error || 'Unknown error'}
                      </div>
                    )}
                  </div>

                  {/* Office 2 */}
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Office 2 (2nd Floor):</span>
                      {syncHistoryResult.office2?.status === 'success' ? (
                        <span style={{ color: 'var(--secondary)' }}>Success</span>
                      ) : (
                        <span style={{ color: '#ef4444' }}>Failed</span>
                      )}
                    </div>
                    {syncHistoryResult.office2?.status === 'success' ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Fetched {syncHistoryResult.office2.totalFetched} logs, imported {syncHistoryResult.office2.inserted} new entries.
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: '#ef4444', marginTop: '0.15rem' }}>
                        Error: {syncHistoryResult.office2?.error || 'Unknown error'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setShowSyncHistoryModal(false)}
                disabled={isSyncingHistory}
              >
                Close
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSyncHistory}
                disabled={isSyncingHistory}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isSyncingHistory ? (
                  <>
                    <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                    {syncJobStatus || 'Syncing...'}
                  </>
                ) : (
                  'Sync Now'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExcuseModal && targetEmployee && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '500px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Excuse Late Arrival</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Excuse late entry for <strong>{targetEmployee.name}</strong> ({targetEmployee.username}). Check-in time was <strong>{targetEmployee.checkIn}</strong>.
            </p>
            
            <form onSubmit={handleExcuseLateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Excuse Reason / Remarks</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Server maintenance, Traffic delay, Client meeting" 
                  required 
                  value={excuseReason} 
                  onChange={e => setExcuseReason(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-secondary" style={{ flex: 1 }} disabled={isSubmittingAdjustment}>
                  {isSubmittingAdjustment ? 'Saving...' : 'Excuse Entry'}
                </button>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowExcuseModal(false); setTargetEmployee(null); }} disabled={isSubmittingAdjustment}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForceOutModal && targetEmployee && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '500px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>Manual Check-Out</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Record a manual check-out time for <strong>{targetEmployee.name}</strong> ({targetEmployee.username}). Check-in time was <strong>{targetEmployee.firstSwipe}</strong>.
            </p>
            
            <form onSubmit={handleForceOutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Check-Out Time</label>
                <input 
                  type="time" 
                  className="input-field" 
                  required 
                  value={forceOutTime} 
                  onChange={e => setForceOutTime(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmittingAdjustment}>
                  {isSubmittingAdjustment ? 'Saving...' : 'Record Check-Out'}
                </button>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowForceOutModal(false); setTargetEmployee(null); }} disabled={isSubmittingAdjustment}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== ENROLLMENTS TAB ===== */}
      {activeTab === 'enrollments' && (() => {
        // Detect conflicts: same enrollId mapped to different users across devices
        const conflictEnrollIds = new Set<string>();
        const byEnrollId = new Map<string, Set<number>>();
        deviceEnrollments.forEach((e: any) => {
          if (!byEnrollId.has(e.enrollId)) byEnrollId.set(e.enrollId, new Set());
          byEnrollId.get(e.enrollId)!.add(e.user?.id);
        });
        byEnrollId.forEach((userIds, enrollId) => {
          if (userIds.size > 1) conflictEnrollIds.add(enrollId);
        });

        const filtered = deviceEnrollments.filter((e: any) => {
          const matchDevice = enrollDeviceFilter === 'all' || e.deviceId === enrollDeviceFilter;
          const q = enrollSearchTerm.toLowerCase();
          const matchSearch = !q || 
            e.enrollId?.toLowerCase().includes(q) ||
            e.user?.name?.toLowerCase().includes(q) ||
            e.user?.username?.toLowerCase().includes(q);
          return matchDevice && matchSearch;
        });

        const filteredUsers = employees.filter((u: any) => {
          const q = enrollUserSearch.toLowerCase();
          return !q || u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || String(u.id).includes(q);
        });

        // Compute dashboard metrics
        const totalEmployees = employees.length;
        const office2AssignedUserIds = new Set(deviceEnrollments.filter(e => e.deviceId === '2').map(e => e.userId));
        const assignedToOffice2Count = office2AssignedUserIds.size;
        const unassignedCount = totalEmployees - assignedToOffice2Count;
        const uniqueAssignedDevicesCount = new Set(deviceEnrollments.map(e => e.deviceId)).size;

        const handleAutoPopulate = async () => {
          setAutoPopulating(true);
          setAutoPopulateResult(null);
          try {
            const res = await fetch('/api/admin/device-enrollments/auto-populate', { method: 'POST' });
            const data = await res.json();
            setAutoPopulateResult(data);
            if (data.success) {
              const res2 = await fetch('/api/admin/device-enrollments');
              const data2 = await res2.json();
              if (data2.enrollments) setDeviceEnrollments(data2.enrollments);
            }
          } catch { setAutoPopulateResult({ error: 'Request failed' }); }
          setAutoPopulating(false);
        };

        const handleAddEnrollment = async (e: React.FormEvent) => {
          e.preventDefault();
          setIsSubmittingEnroll(true);
          try {
            const res = await fetch('/api/admin/device-enrollments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deviceId: enrollForm.deviceId, enrollId: enrollForm.enrollId.trim(), userId: Number(enrollForm.userId), note: enrollForm.note || null })
            });
            const data = await res.json();
            if (res.ok) {
              setDeviceEnrollments(prev => [...prev, data.enrollment]);
              setShowEnrollModal(false);
              setEnrollForm({ deviceId: '2', enrollId: '', userId: '', note: '' });
              setEnrollUserSearch('');
            } else {
              alert(data.error || 'Failed to add mapping');
            }
          } catch { alert('Request failed'); }
          setIsSubmittingEnroll(false);
        };

        const handleEditEnrollment = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!targetEnrollment) return;
          setIsSubmittingEnroll(true);
          try {
            const res = await fetch(`/api/admin/device-enrollments/${targetEnrollment.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: Number(editEnrollForm.userId), note: editEnrollForm.note || null })
            });
            const data = await res.json();
            if (res.ok) {
              setDeviceEnrollments(prev => prev.map(en => en.id === targetEnrollment.id ? data.enrollment : en));
              setShowEditEnrollModal(false);
              setTargetEnrollment(null);
            } else {
              alert(data.error || 'Failed to update');
            }
          } catch { alert('Request failed'); }
          setIsSubmittingEnroll(false);
        };

        const handleDeleteEnrollment = async () => {
          if (!targetEnrollment) return;
          setIsSubmittingEnroll(true);
          try {
            const res = await fetch(`/api/admin/device-enrollments/${targetEnrollment.id}`, { method: 'DELETE' });
            if (res.ok) {
              setDeviceEnrollments(prev => prev.filter(en => en.id !== targetEnrollment.id));
              setShowDeleteEnrollConfirm(false);
              setTargetEnrollment(null);
            } else {
              alert('Failed to delete mapping');
            }
          } catch { alert('Request failed'); }
          setIsSubmittingEnroll(false);
        };

        return (
          <div style={{ animation: 'fadeInUp 0.4s ease', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🔑 Fingerprint Synchronization Management
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
                  Office 1 (3rd Floor) is the master employee biometric database. Use this portal to manually deploy and sync profiles to Office 2 (2nd Floor).
                </p>
              </div>
            </div>

            {/* Device Dashboard List */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {(deviceStatusList.length > 0 ? deviceStatusList : [
                { deviceId: '1', name: 'Office 1 (3rd Floor)', online: false, deviceUserCount: 0, deviceLogCount: 0, assignedCount: deviceEnrollments.filter(e => e.deviceId === '1').length, lastSyncTime: null },
                { deviceId: '2', name: 'Office 2 (2nd Floor)', online: false, deviceUserCount: 0, deviceLogCount: 0, assignedCount: deviceEnrollments.filter(e => e.deviceId === '2').length, lastSyncTime: null }
              ]).map((dev) => (
                <div key={dev.deviceId} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: dev.online ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Cpu size={16} style={{ color: 'var(--primary)' }} /> {dev.name}
                    </h3>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: dev.online ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: dev.online ? '#10b981' : '#ef4444'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dev.online ? '#10b981' : '#ef4444' }} />
                      {dev.online ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                    <div style={{ background: 'var(--surface-2)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Assigned Count</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.15rem' }}>{dev.assignedCount}</div>
                    </div>
                    <div style={{ background: 'var(--surface-2)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Active on Device</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.15rem' }}>{dev.online ? dev.deviceUserCount : '—'}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>IP Address / Port:</span>
                      <span style={{ fontFamily: 'monospace' }}>103.66.78.43 : {dev.deviceId === '1' ? '5500' : '5550'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Last Activity Sync:</span>
                      <span style={{ fontWeight: 500 }}>{dev.lastSyncTime ? new Date(dev.lastSyncTime).toLocaleString() : 'Never'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Auto-populate result banner */}
            {autoPopulateResult && (
              <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', background: autoPopulateResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${autoPopulateResult.error ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                {autoPopulateResult.error ? (
                  <span style={{ color: '#ef4444' }}>❌ {autoPopulateResult.error}</span>
                ) : (
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>✅ {autoPopulateResult.message}</span>
                    {autoPopulateResult.conflicts?.length > 0 && (
                      <details style={{ cursor: 'pointer' }}>
                        <summary style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>⚠️ {autoPopulateResult.conflicts.length} unresolved (click to view)</summary>
                        <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {autoPopulateResult.conflicts.map((c: any, i: number) => (
                            <li key={i}>Office {c.deviceId}, ID {c.enrollId}: {c.reason}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem' }} onClick={() => setAutoPopulateResult(null)}>×</button>
                  </div>
                )}
              </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by name or enroll ID..."
                  value={enrollSearchTerm}
                  onChange={e => setEnrollSearchTerm(e.target.value)}
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['all', '1', '2'] as const).map(d => (
                  <button
                    key={d}
                    className={`btn ${enrollDeviceFilter === d ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setEnrollDeviceFilter(d)}
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  >
                    {d === 'all' ? 'All Offices' : `Office ${d}`}
                  </button>
                ))}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto' }}>
                {filtered.length} mapping{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Conflict legend */}
            {conflictEnrollIds.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: 'rgba(245,158,11,0.08)', borderRadius: '0.5rem', border: '1px solid rgba(245,158,11,0.3)' }}>
                <AlertCircle size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '0.85rem', color: '#f59e0b' }}>
                  <strong>{conflictEnrollIds.size}</strong> enroll ID{conflictEnrollIds.size > 1 ? 's' : ''} ({Array.from(conflictEnrollIds).join(', ')}) map to different users across offices — highlighted below.
                </span>
              </div>
            )}

            {/* Device Assignment Management Table */}
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Office / Device', 'Enroll ID', 'Employee', 'User ID', 'Sync Status', 'Note', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No enrollment mappings found. Click <strong>Assign Employee</strong> to map them manually.</td></tr>
                  ) : filtered.map((en: any) => {
                    const isConflict = conflictEnrollIds.has(en.enrollId);
                    return (
                      <tr key={en.id} style={{ borderBottom: '1px solid var(--border)', background: isConflict ? 'rgba(245,158,11,0.04)' : 'transparent', transition: 'background 0.15s' }}>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, background: en.deviceId === '1' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)', color: en.deviceId === '1' ? '#6366f1' : '#10b981' }}>
                            <MapPin size={12} />
                            Office {en.deviceId}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', color: isConflict ? '#f59e0b' : 'var(--text-primary)' }}>
                            {isConflict && '⚠️ '}{en.enrollId}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{en.user?.name || '—'}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{en.user?.username}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{en.user?.id}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {en.deviceId === '1' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                              Master (3F)
                            </span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {en.syncStatus === 'SYNCED' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }} title={en.lastSyncedAt ? `Synced at: ${new Date(en.lastSyncedAt).toLocaleString()}` : ''}>
                                  Synced
                                </span>
                              )}
                              {en.syncStatus === 'PENDING' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                                  Pending Sync
                                </span>
                              )}
                              {en.syncStatus === 'FAILED' && (
                                <>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }} title={en.syncError || 'Sync failed'}>
                                    Failed ⚠️
                                  </span>
                                  <button
                                    className="btn btn-outline"
                                    style={{
                                      fontSize: '0.75rem',
                                      padding: '0.2rem 0.5rem',
                                      borderColor: 'var(--border)',
                                      color: 'var(--text-main)',
                                      background: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem'
                                    }}
                                    onClick={() => handleTriggerSync(en.id)}
                                    disabled={isSyncingEnrollId === en.id}
                                  >
                                    {isSyncingEnrollId === en.id ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    Retry
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: '160px' }}>{en.note || <span style={{ opacity: 0.4 }}>—</span>}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-outline"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                              onClick={() => { setTargetEnrollment(en); setEditEnrollForm({ userId: String(en.user?.id || ''), note: en.note || '' }); setEnrollUserSearch(en.user?.name || ''); setShowEditEnrollModal(true); }}
                            >Edit</button>
                            <button
                              className="btn"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.4rem' }}
                              onClick={() => { setTargetEnrollment(en); setShowDeleteEnrollConfirm(true); }}
                            >Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ===== ADD ENROLLMENT MODAL ===== */}
            {showEnrollModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
                  <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Add Enrollment Mapping</h3>
                  <form onSubmit={handleAddEnrollment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label className="label">Office / Device</label>
                      <select className="input-field" value={enrollForm.deviceId} onChange={e => setEnrollForm(f => ({ ...f, deviceId: e.target.value }))} required>
                        <option value="1">Office 1 (RAMS - 3rd Floor)</option>
                        <option value="2">Office 2 (RIMS - 2nd Floor)</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Biometric Enroll ID (from scanner)</label>
                      <input className="input-field" type="text" placeholder="e.g. 5" value={enrollForm.enrollId} onChange={e => setEnrollForm(f => ({ ...f, enrollId: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="label">Employee</label>
                      <input className="input-field" type="text" placeholder="Search by name or username..." value={enrollUserSearch} onChange={e => { setEnrollUserSearch(e.target.value); setEnrollForm(f => ({ ...f, userId: '' })); }} style={{ marginBottom: '0.5rem' }} />
                      {enrollUserSearch && !enrollForm.userId && (
                        <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', maxHeight: '160px', overflowY: 'auto', background: 'var(--surface)' }}>
                          {filteredUsers.slice(0, 8).map((u: any) => (
                            <div key={u.id} onClick={() => { setEnrollForm(f => ({ ...f, userId: String(u.id) })); setEnrollUserSearch(u.name); }} style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{u.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>@{u.username}</span></span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ID {u.id}</span>
                            </div>
                          ))}
                          {filteredUsers.length === 0 && <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No employees found</div>}
                        </div>
                      )}
                      {enrollForm.userId && <div style={{ fontSize: '0.82rem', color: '#10b981', marginTop: '0.25rem' }}>✓ Selected employee ID: {enrollForm.userId}</div>}
                    </div>
                    <div>
                      <label className="label">Note (optional)</label>
                      <input className="input-field" type="text" placeholder="e.g. Assigned to 2F development team" value={enrollForm.note} onChange={e => setEnrollForm(f => ({ ...f, note: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmittingEnroll || !enrollForm.userId}>{isSubmittingEnroll ? 'Saving...' : 'Add Mapping'}</button>
                      <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowEnrollModal(false); setEnrollUserSearch(''); }}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ===== EDIT ENROLLMENT MODAL ===== */}
            {showEditEnrollModal && targetEnrollment && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Edit Enrollment Mapping</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Office {targetEnrollment.deviceId} — Enroll ID <strong>{targetEnrollment.enrollId}</strong></p>
                  <form onSubmit={handleEditEnrollment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label className="label">Reassign to Employee</label>
                      <input className="input-field" type="text" placeholder="Search by name or username..." value={enrollUserSearch} onChange={e => { setEnrollUserSearch(e.target.value); setEditEnrollForm(f => ({ ...f, userId: '' })); }} style={{ marginBottom: '0.5rem' }} />
                      {enrollUserSearch && !editEnrollForm.userId && (
                        <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', maxHeight: '160px', overflowY: 'auto', background: 'var(--surface)' }}>
                          {filteredUsers.slice(0, 8).map((u: any) => (
                            <div key={u.id} onClick={() => { setEditEnrollForm(f => ({ ...f, userId: String(u.id) })); setEnrollUserSearch(u.name); }} style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{u.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>@{u.username}</span></span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ID {u.id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {editEnrollForm.userId && <div style={{ fontSize: '0.82rem', color: '#10b981', marginTop: '0.25rem' }}>✓ Will reassign to employee ID: {editEnrollForm.userId}</div>}
                    </div>
                    <div>
                      <label className="label">Note (optional)</label>
                      <input className="input-field" type="text" placeholder="e.g. Shared across offices" value={editEnrollForm.note} onChange={e => setEditEnrollForm(f => ({ ...f, note: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmittingEnroll || !editEnrollForm.userId}>{isSubmittingEnroll ? 'Saving...' : 'Save Changes'}</button>
                      <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowEditEnrollModal(false); setTargetEnrollment(null); setEnrollUserSearch(''); }}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ===== DELETE CONFIRMATION ===== */}
          </div>
        );
      })()}

      {/* ===== CONSOLE USERS TAB ===== */}
      {activeTab === 'consoleUsers' && (() => {
        const filtered = consoleUsers.filter((u: any) => {
          const q = consoleSearchTerm.toLowerCase();
          return !q || 
            u.name.toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q) ||
            (u.email && u.email.toLowerCase().includes(q));
        });

        return (
          <div style={{ animation: 'fadeInUp 0.4s ease', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={24} style={{ color: 'var(--primary)' }} /> Console Administrator Accounts
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
                  Manage the accounts that have administrative access to this attendance management console.
                </p>
              </div>
              <div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setConsoleError('');
                    setConsoleForm({ name: '', username: '', email: '', password: '', enabled: true });
                    setShowAddConsoleModal(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                >
                  <Plus size={16} /> Add Console User
                </button>
              </div>
            </div>

            {/* Quick stats cards */}
            <div className="metrics-grid">
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                  <Shield size={24} />
                </div>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, margin: 0 }}>Total Admin Users</h4>
                  <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.20rem 0 0' }}>{consoleUsers.length}</p>
                </div>
              </div>
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.75rem', borderRadius: '0.75rem' }}>
                  <CheckCircle size={24} />
                </div>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, margin: 0 }}>Active Admins</h4>
                  <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.20rem 0 0' }}>{consoleUsers.filter(u => u.enabled).length}</p>
                </div>
              </div>
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.75rem', borderRadius: '0.75rem' }}>
                  <XCircle size={24} />
                </div>
                <div>
                  <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, margin: 0 }}>Disabled Admins</h4>
                  <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.20rem 0 0' }}>{consoleUsers.filter(u => !u.enabled).length}</p>
                </div>
              </div>
            </div>

            {/* Search filter bar */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search console users by name, username, or email..."
                  value={consoleSearchTerm}
                  onChange={e => setConsoleSearchTerm(e.target.value)}
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto' }}>
                {filtered.length} user{filtered.length !== 1 ? 's' : ''} found
              </span>
            </div>

            {/* Main Table */}
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Name', 'Username', 'Email Address', 'Status', 'Created Date', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoadingConsoleUsers ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: 'var(--primary)' }} />
                        Loading console users...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No console users found.
                      </td>
                    </tr>
                  ) : filtered.map((user: any) => {
                    const isSelf = currentUser && user.id === currentUser.id;
                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {user.name}
                            {isSelf && (
                              <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', fontWeight: 700 }}>
                                YOU
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>@{user.username}</td>
                        <td style={{ padding: '0.85rem 1rem', color: user.email ? 'var(--text-main)' : 'var(--text-muted)' }}>{user.email || '—'}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: user.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: user.enabled ? '#10b981' : '#ef4444'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: user.enabled ? '#10b981' : '#ef4444' }} />
                            {user.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              className="btn btn-outline"
                              onClick={() => {
                                setConsoleError('');
                                setTargetConsoleUser(user);
                                setEditConsoleForm({
                                  name: user.name,
                                  username: user.username,
                                  email: user.email || '',
                                  password: '',
                                  enabled: user.enabled
                                });
                                setShowEditConsoleModal(true);
                              }}
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              title="Edit user details or reset password"
                            >
                              <Edit size={13} /> Edit
                            </button>
                            <button
                              className="btn"
                              disabled={isSelf}
                              onClick={() => {
                                setTargetConsoleUser(user);
                                setShowDeleteConsoleConfirm(true);
                              }}
                              style={{
                                padding: '0.35rem 0.6rem',
                                fontSize: '0.8rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                background: isSelf ? 'none' : 'rgba(239, 68, 68, 0.08)',
                                color: isSelf ? 'var(--text-muted)' : '#ef4444',
                                border: isSelf ? '1px solid var(--border)' : '1px solid rgba(239,68,68,0.2)',
                                cursor: isSelf ? 'not-allowed' : 'pointer'
                              }}
                              title={isSelf ? 'You cannot delete yourself' : 'Delete user account'}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ===== ADD CONSOLE USER MODAL ===== */}
            {showAddConsoleModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={20} style={{ color: 'var(--primary)' }} /> Add Console User
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Create a new administrator account with login credentials.</p>
                  
                  {consoleError && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500 }}>
                      ⚠️ {consoleError}
                    </div>
                  )}

                  <form onSubmit={handleAddConsoleUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label className="label">Full Name</label>
                      <input className="input-field" type="text" placeholder="e.g. John Doe" value={consoleForm.name} onChange={e => setConsoleForm(f => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="label">Username</label>
                      <input className="input-field" type="text" placeholder="e.g. johndoe" value={consoleForm.username} onChange={e => setConsoleForm(f => ({ ...f, username: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="label">Email Address (Optional)</label>
                      <input className="input-field" type="email" placeholder="e.g. john@example.com" value={consoleForm.email} onChange={e => setConsoleForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Password</label>
                      <input className="input-field" type="password" placeholder="At least 8 characters" value={consoleForm.password} onChange={e => setConsoleForm(f => ({ ...f, password: e.target.value }))} minLength={8} required />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <input type="checkbox" id="add-enabled" checked={consoleForm.enabled} onChange={e => setConsoleForm(f => ({ ...f, enabled: e.target.checked }))} style={{ cursor: 'pointer' }} />
                      <label htmlFor="add-enabled" style={{ fontSize: '0.88rem', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500 }}>Account Active / Enabled</label>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmittingConsole}>
                        {isSubmittingConsole ? 'Creating...' : 'Create Account'}
                      </button>
                      <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAddConsoleModal(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ===== EDIT CONSOLE USER MODAL (WITH PASSWORD RESET) ===== */}
            {showEditConsoleModal && targetConsoleUser && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Edit size={20} style={{ color: 'var(--primary)' }} /> Edit Console User
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Modify profile details or change login credentials.</p>
                  
                  {consoleError && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500 }}>
                      ⚠️ {consoleError}
                    </div>
                  )}

                  <form onSubmit={handleEditConsoleUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label className="label">Full Name</label>
                      <input className="input-field" type="text" value={editConsoleForm.name} onChange={e => setEditConsoleForm(f => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="label">Username</label>
                      <input className="input-field" type="text" value={editConsoleForm.username} onChange={e => setEditConsoleForm(f => ({ ...f, username: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="label">Email Address (Optional)</label>
                      <input className="input-field" type="email" value={editConsoleForm.email} onChange={e => setEditConsoleForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Reset Password</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Leave blank to keep current</span>
                      </label>
                      <input className="input-field" type="password" placeholder="Enter new password (min 8 chars)" value={editConsoleForm.password} onChange={e => setEditConsoleForm(f => ({ ...f, password: e.target.value }))} minLength={8} />
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <input 
                        type="checkbox" 
                        id="edit-enabled" 
                        checked={editConsoleForm.enabled} 
                        disabled={currentUser && targetConsoleUser.id === currentUser.id}
                        onChange={e => setEditConsoleForm(f => ({ ...f, enabled: e.target.checked }))} 
                        style={{ cursor: currentUser && targetConsoleUser.id === currentUser.id ? 'not-allowed' : 'pointer' }} 
                      />
                      <label 
                        htmlFor="edit-enabled" 
                        style={{ 
                          fontSize: '0.88rem', 
                          color: currentUser && targetConsoleUser.id === currentUser.id ? 'var(--text-muted)' : 'var(--text-main)', 
                          cursor: currentUser && targetConsoleUser.id === currentUser.id ? 'not-allowed' : 'pointer',
                          fontWeight: 500 
                        }}
                      >
                        Account Active / Enabled
                        {currentUser && targetConsoleUser.id === currentUser.id && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 'normal', marginTop: '0.1rem' }}>
                            (You cannot disable your own active session account)
                          </span>
                        )}
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmittingConsole}>
                        {isSubmittingConsole ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowEditConsoleModal(false); setTargetConsoleUser(null); }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ===== DELETE CONFIRMATION ===== */}
            {showDeleteConsoleConfirm && targetConsoleUser && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Delete Console User?</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    This will permanently delete the administrator account for <strong>{targetConsoleUser.name}</strong> (@{targetConsoleUser.username}). This action cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                      className="btn" 
                      style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem' }} 
                      onClick={handleDeleteConsoleUser} 
                      disabled={isSubmittingConsole}
                    >
                      {isSubmittingConsole ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowDeleteConsoleConfirm(false); setTargetConsoleUser(null); }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'unknownScans' && (() => {
        const unknownLogs = attendanceLogs.filter((l: any) => l.userId == null);
        const filteredUnknown = unknownLogs.filter((l: any) => {
          const matchesSearch = !unknownScanSearch || 
            (l.enrollId && l.enrollId.toLowerCase().includes(unknownScanSearch.toLowerCase())) ||
            (l.name && l.name.toLowerCase().includes(unknownScanSearch.toLowerCase())) ||
            (l.scannerUserId && l.scannerUserId.toLowerCase().includes(unknownScanSearch.toLowerCase()));
          const matchesDate = !unknownScanDateFilter || l.date === unknownScanDateFilter;
          return matchesSearch && matchesDate;
        });

        // Group by enrollId+deviceId for summary
        const enrollSummary = new Map<string, { enrollId: string; deviceId: string; name: string; count: number; lastDate: string; lastTime: string }>();
        unknownLogs.forEach((l: any) => {
          const key = `${l.enrollId}__${l.deviceId}`;
          const existing = enrollSummary.get(key);
          if (!existing) {
            enrollSummary.set(key, {
              enrollId: l.enrollId || '—',
              deviceId: l.deviceId || '—',
              name: l.name || '—',
              count: 1,
              lastDate: l.date,
              lastTime: l.time
            });
          } else {
            existing.count++;
            if (l.date > existing.lastDate || (l.date === existing.lastDate && l.time > existing.lastTime)) {
              existing.lastDate = l.date;
              existing.lastTime = l.time;
            }
          }
        });
        const summaryList = Array.from(enrollSummary.values())
          .filter((s: any) => {
            if (!unknownScanSearch) return true;
            const query = unknownScanSearch.toLowerCase();
            return (s.enrollId && s.enrollId.toLowerCase().includes(query)) ||
                   (s.name && s.name.toLowerCase().includes(query));
          })
          .sort((a, b) => b.count - a.count);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeInUp 0.4s ease' }}>
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Unknown Fingerprint Scans</h2>
                <p style={{ color: 'var(--text-muted)' }}>Scans from individuals not registered in the employee database</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{
                  background: unknownLogs.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: unknownLogs.length > 0 ? '#ef4444' : '#10b981',
                  padding: '0.4rem 1rem',
                  borderRadius: '999px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  border: `1px solid ${unknownLogs.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                }}>
                  {unknownLogs.length} unknown scan{unknownLogs.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Summary Cards */}
            {summaryList.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {summaryList.map((s) => (
                  <div key={`${s.enrollId}-${s.deviceId}`} className="card" style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <code style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>{s.enrollId}</code>
                      <span style={{
                        background: s.deviceId === '1' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)',
                        color: s.deviceId === '1' ? '#818cf8' : '#34d399',
                        padding: '0.1rem 0.5rem',
                        borderRadius: '999px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        border: `1px solid ${s.deviceId === '1' ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}`,
                      }}>{s.deviceId === '1' ? '3F' : '2F'}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{s.name}</div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.count} scan{s.count !== 1 ? 's' : ''}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Last: {s.lastDate} {s.lastTime}</span>
                    </div>
                    <button
                      className="btn"
                      onClick={() => {
                        setOnboardTarget({ enrollId: s.enrollId, deviceId: s.deviceId, name: s.name });
                        setOnboardForm({ employeeId: '', name: s.name !== '—' ? s.name : '', dept: '' });
                      }}
                      style={{
                        marginTop: '0.6rem',
                        width: '100%',
                        padding: '0.35rem 0',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.35)',
                        color: '#818cf8',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Plus size={13} />
                      Onboard
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Detailed Logs Table */}
            <div className="table-container">
              <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by Enroll ID or Name..."
                  value={unknownScanSearch}
                  onChange={(e) => setUnknownScanSearch(e.target.value)}
                  style={{ maxWidth: '280px', background: 'rgba(15, 23, 42, 0.4)', margin: 0 }}
                />
                <input
                  type="date"
                  className="input-field"
                  value={unknownScanDateFilter}
                  onChange={(e) => setUnknownScanDateFilter(e.target.value)}
                  style={{ maxWidth: '180px', background: 'rgba(15, 23, 42, 0.4)', margin: 0 }}
                />
              </div>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Enroll ID</th>
                    <th>Device</th>
                    <th>Scanner Name</th>
                    <th>Verify Method</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnknown.slice(0, 200).map((log: any, idx: number) => (
                    <tr key={log.id || idx}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{log.date}</td>
                      <td style={{ fontFamily: 'monospace' }}>{log.time}</td>
                      <td><code style={{ color: '#ef4444', fontWeight: 700 }}>{log.enrollId || '—'}</code></td>
                      <td>
                        {log.deviceId === '1' ? (
                          <span style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)' }}>3F</span>
                        ) : log.deviceId === '2' ? (
                          <span style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>2F</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{log.deviceId || '—'}</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{log.name || '—'}</td>
                      <td><span className="badge badge-warning">Fingerprint</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn"
                          onClick={() => {
                            setOnboardTarget({ enrollId: log.enrollId, deviceId: log.deviceId, name: log.name });
                            setOnboardForm({ employeeId: '', name: log.name && log.name !== '—' ? log.name : '', dept: '' });
                          }}
                          style={{
                            padding: '0.2rem 0.6rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            color: '#818cf8',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Onboard
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUnknown.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        {unknownLogs.length === 0 ? 'No unknown fingerprint scans detected.' : 'No scans match your filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredUnknown.length > 200 && (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Showing first 200 of {filteredUnknown.length} results. Use filters to narrow down.
                </div>
              )}
            </div>

            {/* Onboard Modal */}
            {onboardTarget && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                <div className="glass-panel" style={{ animation: 'fadeInUp 0.3s ease', background: 'rgba(30, 41, 59, 0.95)', position: 'relative', zIndex: 101, width: '100%', maxWidth: '480px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                  <h3 style={{ marginBottom: '0.5rem', fontSize: '1.3rem', fontWeight: 700 }}>Onboard Employee</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Register this unknown fingerprint as a new employee
                  </p>
                  
                  {/* Context Info */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Enroll ID</div>
                      <code style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.1rem' }}>{onboardTarget.enrollId}</code>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Device</div>
                      <span style={{ fontWeight: 700, color: onboardTarget.deviceId === '1' ? '#818cf8' : '#34d399' }}>
                        {onboardTarget.deviceId === '1' ? 'Office 1 (3F)' : 'Office 2 (2F)'}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!onboardTarget) return;
                    setIsOnboarding(true);
                    try {
                      const res = await fetch('/api/admin/employees/onboard', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          employeeId: onboardForm.employeeId,
                          name: onboardForm.name,
                          dept: onboardForm.dept,
                          enrollId: onboardTarget.enrollId,
                          deviceId: onboardTarget.deviceId
                        })
                      });
                      const result = await res.json();
                      if (res.ok) {
                        setEmployees(prev => [result.employee, ...prev]);
                        setOnboardTarget(null);
                        setOnboardForm({ employeeId: '', name: '', dept: '' });
                        router.refresh();
                      } else {
                        alert(result.error || 'Failed to onboard employee');
                      }
                    } catch (err) {
                      alert('Network error. Please try again.');
                    }
                    setIsOnboarding(false);
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Employee ID (used for login)</label>
                      <input
                        className="input-field"
                        placeholder="e.g. 101"
                        required
                        value={onboardForm.employeeId}
                        onChange={(e) => setOnboardForm({ ...onboardForm, employeeId: e.target.value })}
                        style={{ margin: 0, width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Full Name</label>
                      <input
                        className="input-field"
                        placeholder="Employee name"
                        required
                        value={onboardForm.name}
                        onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                        style={{ margin: 0, width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>Department (optional)</label>
                      <input
                        className="input-field"
                        placeholder="e.g. Engineering"
                        value={onboardForm.dept}
                        onChange={(e) => setOnboardForm({ ...onboardForm, dept: e.target.value })}
                        style={{ margin: 0, width: '100%' }}
                      />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                      Default password: <strong>password123</strong> — employee can change it after first login.
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                      <button
                        type="submit"
                        className="btn btn-secondary"
                        disabled={isOnboarding}
                        style={{ flex: 1 }}
                      >
                        {isOnboarding ? 'Creating...' : 'Create Employee'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => { setOnboardTarget(null); setOnboardForm({ employeeId: '', name: '', dept: '' }); }}
                        style={{ flex: 1 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
