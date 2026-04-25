'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function AdminDashboardClient({ initialEmployees, initialHolidays = [] }: { initialEmployees: any[], initialHolidays?: any[] }) {
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

  const filteredEmployees = employees.filter(emp => 
    emp.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (emp.dept && emp.dept.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (emp.enrollId && emp.enrollId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / rowsPerPage));
  const startIdx = (currentPage - 1) * rowsPerPage;
  const currentEmployees = filteredEmployees.slice(startIdx, startIdx + rowsPerPage);

  return (
    <div className="grid">
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
                 <li><strong>name</strong>: Employee's full name</li>
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
  );
}
