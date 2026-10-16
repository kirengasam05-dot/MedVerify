import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  ScanLine,
  Mail,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  RefreshCw,
  MoreVertical,
  Check,
  X,
  Edit2,
  Trash2,
  KeyRound,
  Filter,
  Lock,
  ExternalLink,
  Clock,
  Sparkles,
  UserCheck,
  UserX,
  ChevronDown,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  fetchUsers,
  createSystemUser,
  updateSystemUser,
  deleteSystemUser,
  fetchAccessRequests,
  updateAccessRequest,
  type SystemUser,
  type AccessRequest,
  type CurrentUser,
  type UserRole
} from '../api';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

interface UserManagementPageProps {
  currentUser: CurrentUser;
}

const ROLE_DEFINITIONS: Record<
  UserRole,
  {
    title: string;
    description: string;
    color: string;
    badgeBg: string;
    badgeBorder: string;
    icon: React.ComponentType<{ className?: string }>;
    permissions: string[];
    allowedTabs: string[];
  }
> = {
  admin: {
    title: 'System Administrator',
    description: 'Master administrative access across the entire MedVerify ecosystem: user management, case oversight, registry catalog, hardware gateway, and surveillance reports.',
    color: 'text-indigo-600',
    badgeBg: 'bg-indigo-50 text-indigo-700',
    badgeBorder: 'border-indigo-200',
    icon: Shield,
    permissions: [
      'Master administrative privileges & full access to manage all system activity',
      'Add, configure & manage staff permissions across all operational roles',
      'Oversee suspicious cases, set quarantine priorities, and verify batches',
      'Manage official Rwanda FDA verified medicines catalog & integrity status',
      'Monitor hardware gateway, spectrometer connectivity & cloud data sync',
      'Conduct post-market inspections, facility audits, and export compliance reports'
    ],
    allowedTabs: ['Dashboard', 'Scan Medicine', 'Field Investigations', 'Verified Registry', 'System Integration', 'Oversee Cases', 'User Management', 'Reports & Analytics']
  },
  manager: {
    title: 'Manager & Administrator',
    description: 'Executive oversight, case quarantine priorities, user permissions, and compliance audit exports.',
    color: 'text-purple-600',
    badgeBg: 'bg-purple-50 text-purple-700',
    badgeBorder: 'border-purple-200',
    icon: ShieldCheck,
    permissions: [
      'Dashboard & live surveillance oversight',
      'Oversee cases & set quarantine priorities (low, normal, high, urgent)',
      'Add, manage & revoke system users and roles',
      'Approve or deny access requests from sign-in portal',
      'Export official Rwanda FDA audit reports & CSVs'
    ],
    allowedTabs: ['Dashboard', 'Oversee Cases', 'User Management', 'Reports & Analytics']
  },
  ict_staff: {
    title: 'ICT & Regulatory Systems Staff',
    description: 'Central medicine catalog administration, barcode database maintenance, and hardware gateway integration.',
    color: 'text-blue-600',
    badgeBg: 'bg-blue-50 text-blue-700',
    badgeBorder: 'border-blue-200',
    icon: Cpu,
    permissions: [
      'Verified medicine registry catalog management',
      'Add official Rwanda FDA registered pharmaceuticals',
      'Toggle medicine validity & counterfeit flagging',
      'Hardware serial scanner & LCD display simulator',
      'Cloud sync & demo database seeding'
    ],
    allowedTabs: ['Verified Registry', 'System Integration']
  },
  field_officer: {
    title: 'Post-Market Surveillance Officer',
    description: 'Border posts & dispensary field inspection, camera barcode decode, NIR spectrometry, and seizure dossiers.',
    color: 'text-emerald-600',
    badgeBg: 'bg-emerald-50 text-emerald-700',
    badgeBorder: 'border-emerald-200',
    icon: ScanLine,
    permissions: [
      'Live barcode camera scanning & AI detection',
      'NIR spectrometry chemical authenticity check',
      'Inspect seized batches & dispensary facilities',
      'Submit official post-market inspection dossiers',
      'Real-time verification alert reviews'
    ],
    allowedTabs: ['Dashboard', 'Scan Medicine', 'Field Investigations']
  }
};

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Active view tab: 'users' | 'requests' | 'roles'
  const [viewTab, setViewTab] = useState<'users' | 'requests' | 'roles'>('users');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('admin');
  const [newDepartment, setNewDepartment] = useState('Kigali Central Surveillance');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');

  // Newly Created User Credentials Modal
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    role: UserRole;
    password: string;
    department: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate a secure compliant initial password
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'
    let pwd = 'Fda@'
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewPassword(pwd)
    setShowNewPassword(true)
  }

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('field_officer');
  const [editDepartment, setEditDepartment] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  // Grant Access Modal State
  const [grantingReq, setGrantingReq] = useState<AccessRequest | null>(null);
  const [grantRole, setGrantRole] = useState<UserRole>('field_officer');
  const [grantDepartment, setGrantDepartment] = useState('');
  const [grantBusy, setGrantBusy] = useState(false);

  // Load users and access requests from backend
  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [fetchedUsers, fetchedRequests] = await Promise.all([
        fetchUsers().catch((err) => {
          console.warn('Could not fetch users:', err);
          return [] as SystemUser[];
        }),
        fetchAccessRequests().catch((err) => {
          console.warn('Could not fetch access requests:', err);
          return [] as AccessRequest[];
        })
      ]);
      setUsers(fetchedUsers);
      setRequests(fetchedRequests);
    } catch (err: any) {
      setError(err?.message || 'Failed to load user management data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick flash notification helper
  const flashSuccess = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchTerm.trim() ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Pending access requests count
  const pendingRequestsCount = useMemo(() => {
    return requests.filter((r) => r.status === 'pending').length;
  }, [requests]);

  // Metrics
  const metrics = useMemo(() => {
    const adminsCount = users.filter((u) => u.role === 'admin').length;
    const managersCount = users.filter((u) => u.role === 'manager').length;
    const ictCount = users.filter((u) => u.role === 'ict_staff').length;
    const fieldCount = users.filter((u) => u.role === 'field_officer').length;
    const activeCount = users.filter((u) => u.status === 'active').length;
    return {
      total: users.length,
      active: activeCount,
      admins: adminsCount,
      managers: managersCount,
      ict: ictCount,
      field: fieldCount,
      pending: pendingRequestsCount
    };
  }, [users, pendingRequestsCount]);

  // Handle Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) {
      setAddError('Name and email are required.');
      return;
    }
    setAddBusy(true);
    setAddError('');
    try {
      const created = await createSystemUser({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        department: newDepartment.trim(),
        password: newPassword,
        status: 'active'
      });
      setUsers((prev) => [created, ...prev.filter((u) => u.email !== created.email)]);
      flashSuccess(`User ${created.name} (${created.email}) added as ${ROLE_DEFINITIONS[created.role].title}!`);
      setIsAddModalOpen(false);
      setCreatedCredentials({
        name: created.name,
        email: created.email,
        role: created.role,
        password: newPassword,
        department: newDepartment.trim() || 'Rwanda FDA Central Surveillance'
      });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
    } catch (err: any) {
      setAddError(err?.message || 'Failed to create user.');
    } finally {
      setAddBusy(false);
    }
  };

  // Handle Edit User
  const openEditModal = (u: SystemUser) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditDepartment(u.department || '');
    setEditStatus(u.status);
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditBusy(true);
    setEditError('');
    try {
      const updated = await updateSystemUser(editingUser.id, {
        role: editRole,
        department: editDepartment.trim(),
        status: editStatus
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      flashSuccess(`Permissions updated for ${updated.name}!`);
      setEditingUser(null);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update user.');
    } finally {
      setEditBusy(false);
    }
  };

  // Handle Toggle Status (Active / Inactive)
  const handleToggleStatus = async (user: SystemUser) => {
    if (user.email.toLowerCase() === currentUser.email.toLowerCase()) {
      alert('You cannot deactivate your own administrative manager account.');
      return;
    }
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await updateSystemUser(user.id, { status: newStatus });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      flashSuccess(`Account status changed to ${newStatus} for ${user.name}.`);
    } catch (err: any) {
      alert(err?.message || 'Failed to update status.');
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (user: SystemUser) => {
    if (user.email.toLowerCase() === currentUser.email.toLowerCase()) {
      alert('You cannot delete your own administrative account.');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to remove user "${user.name}" (${user.email}) from MedVerify? This will revoke all their system privileges.`
    );
    if (!confirmed) return;
    try {
      await deleteSystemUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      flashSuccess(`User ${user.email} removed from the system.`);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete user.');
    }
  };

  // Handle Password Reset Link
  const handleSendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      flashSuccess(`Password reset email sent to ${email}.`);
    } catch (err: any) {
      alert(err?.message || 'Failed to trigger password reset.');
    }
  };

  // Handle Access Request Approval
  const openGrantModal = (req: AccessRequest) => {
    setGrantingReq(req);
    setGrantRole(req.role || 'field_officer');
    setGrantDepartment(req.department || 'Kigali Central Surveillance');
  };

  const handleConfirmGrant = async () => {
    if (!grantingReq) return;
    setGrantBusy(true);
    try {
      await updateAccessRequest(grantingReq.id, 'approve', grantRole);
      flashSuccess(`Access granted for ${grantingReq.name} as ${ROLE_DEFINITIONS[grantRole].title}!`);
      setGrantingReq(null);
      await loadData(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to approve access request.');
    } finally {
      setGrantBusy(false);
    }
  };

  const handleDenyRequest = async (req: AccessRequest) => {
    const confirmed = window.confirm(`Deny access request for "${req.name}" (${req.email})?`);
    if (!confirmed) return;
    try {
      await updateAccessRequest(req.id, 'reject');
      flashSuccess(`Access request from ${req.email} has been denied.`);
      await loadData(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to deny access request.');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              User & Access Control
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-800 border border-purple-200">
              Manager Privilege
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Provision Rwanda FDA accounts, assign RBAC privileges across the 3 roles, and approve access requests.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAddError('');
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg shadow-sm hover:bg-slate-800 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* ── NOTIFICATIONS & ALERTS ── */}
      {successNotice && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── METRICS OVERVIEW CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Staff</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{metrics.total}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">{metrics.active} active in system</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-indigo-700 uppercase tracking-wider">Admins</span>
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{metrics.admins}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Full System Access</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-purple-700 uppercase tracking-wider">Managers</span>
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{metrics.managers}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Admin & Overseers</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-blue-700 uppercase tracking-wider">ICT Staff</span>
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{metrics.ict}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Registry & Gateway</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Field Officers</span>
            <ScanLine className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{metrics.field}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Inspectors & Scanners</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3.5 rounded-xl border border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Pending Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <div className="text-xl font-bold text-white mt-1">
              {pendingRequestsCount} <span className="text-xs font-normal text-slate-400">waiting</span>
            </div>
            <p className="text-[10px] text-slate-300 mt-0.5">
              From access portal
            </p>
          </div>
          {pendingRequestsCount > 0 && (
            <button
              onClick={() => setViewTab('requests')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 transition cursor-pointer"
            >
              Review
            </button>
          )}
        </div>
      </div>

      {/* ── TAB NAVIGATION ── */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setViewTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
            viewTab === 'users'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Active Staff & Privileges</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] text-slate-600 font-mono">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setViewTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
            viewTab === 'requests'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Access Requests</span>
          {pendingRequestsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setViewTab('roles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
            viewTab === 'roles'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>4 Operational Roles & Permissions Matrix</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 1: ACTIVE SYSTEM USERS
          ═══════════════════════════════════════════════════════════════ */}
      {viewTab === 'users' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff by name, email, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-slate-900 cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="admin">System Admin</option>
                <option value="manager">Manager</option>
                <option value="ict_staff">ICT Staff</option>
                <option value="field_officer">Field Officer</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-slate-900 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active only</option>
                <option value="inactive">Deactivated</option>
              </select>
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Personnel</th>
                    <th className="px-4 py-3">Assigned Role</th>
                    <th className="px-4 py-3">Department / Post</th>
                    <th className="px-4 py-3">Operational Privileges</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400 mb-2" />
                        Loading system users from database...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        <div className="max-w-xs mx-auto text-center">
                          <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-700">No users found</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {users.length === 0
                              ? 'No system users in the database yet. Click "Add New User" above to create one.'
                              : 'Try adjusting your search query or role filter.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const def = ROLE_DEFINITIONS[u.role] || ROLE_DEFINITIONS.field_officer;
                      const Icon = def.icon;
                      const isMe = u.email.toLowerCase() === currentUser.email.toLowerCase();

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition">
                          {/* Personnel Name & Email */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
                                {u.name.trim().charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isMe && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{u.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${def.badgeBg} ${def.badgeBorder}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{def.title.split('&')[0].trim()}</span>
                            </span>
                          </td>

                          {/* Department */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]">
                                {u.department || 'Rwanda FDA Directorate'}
                              </span>
                            </div>
                          </td>

                          {/* Privileges summary */}
                          <td className="px-4 py-3">
                            <div className="text-[11px] text-slate-600">
                              <span className="font-medium text-slate-800">Tabs: </span>
                              {def.allowedTabs.join(', ')}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            {u.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Deactivated
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Edit role / department */}
                              <button
                                type="button"
                                onClick={() => openEditModal(u)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="Change role & permissions"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle active / inactive */}
                              {!isMe && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(u)}
                                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                                    u.status === 'active'
                                      ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                      : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                  title={u.status === 'active' ? 'Deactivate user' : 'Reactivate user'}
                                >
                                  {u.status === 'active' ? (
                                    <UserX className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                              {/* Send password reset */}
                              <button
                                type="button"
                                onClick={() => handleSendPasswordReset(u.email)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Send password reset email"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete User */}
                              {!isMe && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Remove user"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 2: PENDING ACCESS REQUESTS
          ═══════════════════════════════════════════════════════════════ */}
      {viewTab === 'requests' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xs font-semibold text-amber-900">
                Self-Service Access Requests
              </h2>
              <p className="text-[11px] text-amber-700 mt-0.5">
                These requests originate from Rwanda FDA inspectors, regulatory systems officers, or supervisors requesting access on the login portal. As Manager, you can grant them immediate access with the role of your choice or deny the request.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Requested Role</th>
                    <th className="px-4 py-3">Department / Post</th>
                    <th className="px-4 py-3">Justification / Reason</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        <Clock className="w-7 h-7 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">No pending access requests</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          When users submit access requests via the Sign-In page, they will appear here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => {
                      const def = ROLE_DEFINITIONS[req.role] || ROLE_DEFINITIONS.field_officer;
                      const isPending = req.status === 'pending';

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{req.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{req.email}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(req.requestedAt).toLocaleString()}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${def.badgeBg} ${def.badgeBorder}`}
                            >
                              {def.title.split('&')[0].trim()}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {req.department || 'Rwanda FDA'}
                          </td>

                          <td className="px-4 py-3 text-slate-600 max-w-xs">
                            <p className="line-clamp-2 italic text-[11px]">
                              "{req.reason || 'No justification provided.'}"
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            {req.status === 'pending' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Pending
                              </span>
                            )}
                            {req.status === 'approved' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Approved
                              </span>
                            )}
                            {req.status === 'rejected' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Denied
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {isPending ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openGrantModal(req)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition cursor-pointer shadow-xs"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Grant Access</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDenyRequest(req)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-semibold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Deny</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Action taken
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 3: 3 ROLES & PERMISSIONS MATRIX
          ═══════════════════════════════════════════════════════════════ */}
      {viewTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((rKey) => {
            const rDef = ROLE_DEFINITIONS[rKey];
            const Icon = rDef.icon;

            return (
              <div
                key={rKey}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${rDef.badgeBg}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Role ID: {rKey}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{rDef.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                    {rDef.description}
                  </p>

                  <div className="border-t border-slate-100 pt-3">
                    <h4 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Platform Capabilities:
                    </h4>
                    <ul className="space-y-2 text-xs text-slate-600">
                      {rDef.permissions.map((perm, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{perm}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-6">
                  <div className="text-[11px] font-medium text-slate-500 mb-1">
                    Accessible Navigation Tabs:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rDef.allowedTabs.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium border border-slate-200"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: ADD NEW USER
          ═══════════════════════════════════════════════════════════════ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Add New Rwanda FDA User</h2>
                  <p className="text-[11px] text-slate-500">
                    Create credentials and assign system privileges directly to the database.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              {addError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Officer Jean-Luc N."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="officer@fda.gov.rw"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Role selection radio cards */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  System Role & Privilege Tier *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((rKey) => {
                    const rDef = ROLE_DEFINITIONS[rKey];
                    const isSelected = newRole === rKey;
                    const Icon = rDef.icon;

                    return (
                      <div
                        key={rKey}
                        onClick={() => setNewRole(rKey)}
                        className={`p-3 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <Icon
                              className={`w-4 h-4 ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}
                            />
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-slate-900 font-bold" />
                            )}
                          </div>
                          <div className="text-xs font-bold text-slate-900">{rDef.title.split('&')[0]}</div>
                          <div className="text-[10px] text-slate-500 mt-1 leading-tight line-clamp-2">
                            {rDef.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department / Inspection Post
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rubavu Border Post"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['Kigali Central', 'Rubavu Post', 'Rusizi Post', 'ICT Systems'].map((dep) => (
                      <button
                        key={dep}
                        type="button"
                        onClick={() => setNewDepartment(dep)}
                        className="text-[10px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        {dep}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Initial Password *
                    </label>
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="text-[10.5px] font-semibold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-teal-600" /> Auto-Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    This password provisions their Firebase account. They can update it upon first login.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addBusy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                >
                  {addBusy ? 'Creating User...' : 'Create & Assign Privileges'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: USER CREATED CREDENTIALS CONFIRMATION
          ═══════════════════════════════════════════════════════════════ */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <h2 className="text-base font-bold text-slate-900">
                Staff Account Successfully Created!
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                The account has been active and assigned full privileges in the system.
              </p>

              {/* Credentials Box */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-sans font-medium text-slate-500 text-[11px]">Full Name:</span>
                  <span className="font-semibold text-slate-900">{createdCredentials.name}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-sans font-medium text-slate-500 text-[11px]">Official Email:</span>
                  <span className="font-semibold text-slate-900">{createdCredentials.email}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-sans font-medium text-slate-500 text-[11px]">Assigned Role:</span>
                  <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[10.5px]">
                    {ROLE_DEFINITIONS[createdCredentials.role]?.title || createdCredentials.role}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-sans font-medium text-slate-500 text-[11px]">Initial Password:</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {createdCredentials.password}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `MedVerify System Credentials:\nName: ${createdCredentials.name}\nEmail: ${createdCredentials.email}\nRole: ${ROLE_DEFINITIONS[createdCredentials.role]?.title || createdCredentials.role}\nPassword: ${createdCredentials.password}\nPortal: ${window.location.origin}`;
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedCredentials(null);
                    setCopied(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: EDIT USER ROLE & PERMISSIONS
          ═══════════════════════════════════════════════════════════════ */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Edit Staff Permissions</h2>
                <p className="text-[11px] text-slate-500">
                  Modifying {editingUser.name} ({editingUser.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Role & Privileges:
                </label>
                <div className="space-y-2">
                  {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((rKey) => {
                    const rDef = ROLE_DEFINITIONS[rKey];
                    const isSelected = editRole === rKey;
                    const Icon = rDef.icon;

                    return (
                      <div
                        key={rKey}
                        onClick={() => setEditRole(rKey)}
                        className={`p-3 rounded-xl border-2 transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${rDef.badgeBg}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{rDef.title}</div>
                            <div className="text-[10px] text-slate-500">{rDef.description}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-slate-900 font-bold" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department / Inspection Station
                </label>
                <input
                  type="text"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 bg-white"
                >
                  <option value="active">Active (Can log in and access allowed tools)</option>
                  <option value="inactive">Deactivated (Blocked from platform access)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                >
                  {editBusy ? 'Saving...' : 'Save Role & Privileges'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: GRANT ACCESS TO REQUESTER
          ═══════════════════════════════════════════════════════════════ */}
      {grantingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Grant System Access</h2>
                <p className="text-[11px] text-slate-500">
                  Approve access for {grantingReq.name} ({grantingReq.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGrantingReq(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                <div className="text-slate-500 font-medium">Applicant Requested Role:</div>
                <div className="font-bold text-slate-900 capitalize">
                  {grantingReq.role.replace('_', ' ')}
                </div>
                {grantingReq.reason && (
                  <div className="text-slate-600 text-[11px] mt-1 italic">
                    "{grantingReq.reason}"
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm or Change Granted Role:
                </label>
                <select
                  value={grantRole}
                  onChange={(e) => setGrantRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 bg-white"
                >
                  <option value="field_officer">Field Officer (Surveillance, Barcode/NIR Scanner, Investigations)</option>
                  <option value="ict_staff">ICT Staff (Verified Registry, Hardware Integration)</option>
                  <option value="manager">Manager (Full Oversight, User Management, Reports)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Department / Station
                </label>
                <input
                  type="text"
                  value={grantDepartment}
                  onChange={(e) => setGrantDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGrantingReq(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmGrant}
                  disabled={grantBusy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                >
                  {grantBusy ? 'Granting...' : 'Confirm & Grant Access'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
