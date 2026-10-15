// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Sidebar  (MedVerify)
//
// LAYOUT:
// - Fixed sidebar on desktop (md+). Slide-in on mobile.
// - No scrollbar — sections collapse to fit content.
// - Sections are collapsible accordions (click title to toggle).
//
// REMOVED:
// - Role tag pills (Live Monitoring, Field Officer, ICT Staff, Manager)
// - Gradient logo + pulse dot
// - Overflow scroll on the nav list
//
// STYLING:
// - Navy background (#0F1B22) matching the login page
// - Teal/emerald accent for active state
// - Compact 10-11px typography
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  LayoutDashboard,
  ScanLine,
  ClipboardList,
  Database,
  Cpu,
  ShieldAlert,
  FileText,
  Building2,
  X,
  BadgeCheck,
  ChevronDown,
  Users,
} from 'lucide-react';
import type { CurrentUser } from '../api';

export type TabKey =
  | 'dash'
  | 'scan'
  | 'investigations'
  | 'registry'
  | 'integration'
  | 'cases'
  | 'users'
  | 'reports';

interface SidebarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  currentUser: CurrentUser;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  totalScansCount?: number;
  flaggedCount?: number;
  productsCount?: number;
}

interface NavItem {
  id: TabKey;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  isMobileOpen,
  onCloseMobile,
  totalScansCount = 0,
  flaggedCount = 0,
  productsCount = 0,
}) => {
  // ── SECTIONS ──
  const sections: NavSection[] = [
    {
      id: 'surveillance',
      title: 'Surveillance',
      items: [
        {
          id: 'dash',
          label: 'Dashboard',
          subtitle: 'Alerts & overview',
          icon: LayoutDashboard,
          badge: totalScansCount > 0 ? String(totalScansCount) : undefined,
          badgeColor: 'bg-slate-700 text-slate-300',
        },
        {
          id: 'scan',
          label: 'Scan Medicine',
          subtitle: 'Camera & NIR sensor',
          icon: ScanLine,
          badge: 'Live',
          badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        },
      ],
    },
    {
      id: 'inspection',
      title: 'Post-Market Inspection',
      items: [
        {
          id: 'investigations',
          label: 'Field Investigations',
          subtitle: 'Site audits & seized batches',
          icon: ClipboardList,
        },
      ],
    },
    {
      id: 'systems',
      title: 'Regulatory Systems',
      items: [
        {
          id: 'registry',
          label: 'Verified Registry',
          subtitle: 'Official medicine catalog',
          icon: Database,
          badge: productsCount > 0 ? String(productsCount) : undefined,
          badgeColor: 'bg-slate-700 text-slate-300',
        },
        {
          id: 'integration',
          label: 'System Integration',
          subtitle: 'Gateway & cloud sync',
          icon: Cpu,
        },
      ],
    },
    {
      id: 'management',
      title: 'Management',
      items: [
        {
          id: 'cases',
          label: 'Oversee Cases',
          subtitle: 'Priorities & quarantine',
          icon: ShieldAlert,
          badge: flaggedCount > 0 ? `${flaggedCount} open` : undefined,
          badgeColor: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        },
        {
          id: 'users',
          label: 'User Management',
          subtitle: 'Staff roles & privileges',
          icon: Users,
        },
        {
          id: 'reports',
          label: 'Reports & Analytics',
          subtitle: 'Export CSV & print audits',
          icon: FileText,
        },
      ],
    },
  ];

  // ── RBAC PERMISSIONS MAPPING (RWANDA FDA TARGET POPULATION) ──
  // 1. Post-market surveillance & inspection officers: Scan, review alerts, conduct field investigation
  // 2. ICT & regulatory-systems staff: Maintain the product registry and integration
  // 3. Managers, supervisors & administrators: Set priorities, oversee cases, use reports
  const userRole = currentUser?.role || 'manager';
  const roleAllowedTabs: Record<string, TabKey[]> = {
    admin: ['dash', 'scan', 'investigations', 'registry', 'integration', 'cases', 'users', 'reports'],
    field_officer: ['dash', 'scan', 'investigations'],
    ict_staff: ['registry', 'integration'],
    manager: ['dash', 'cases', 'users', 'reports'],
  };
  const allowedTabs = roleAllowedTabs[userRole] || roleAllowedTabs.manager;

  // Filter sections and items strictly according to the user's assigned RBAC role
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => allowedTabs.includes(item.id)),
    }))
    .filter((section) => section.items.length > 0);

  // ── COLLAPSE STATE ──
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((s) => (initial[s.id] = true));
    return initial;
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      {/* ── MOBILE BACKDROP ── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* ── SIDEBAR CONTAINER ── */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0F1B22] text-white flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* ── BRAND HEADER ── */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-[11px]">
              MV
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white leading-tight">
                MedVerify
              </p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                Rwanda FDA
              </p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden transition"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
       

        {/* ── NAVIGATION (RBAC filtered) ── */}
        <div className="flex-1 flex flex-col px-3 py-3 gap-1 overflow-y-auto">
          {visibleSections.map((section) => {
            const isOpen = openSections[section.id] ?? true;

            return (
              <div key={section.id}>
                {/* Section header (clickable to toggle) */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left transition-colors hover:opacity-80"
                >
                  <span className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wider">
                    {section.title}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${
                      isOpen ? '' : '-rotate-90'
                    }`}
                  />
                </button>

                {/* Section items */}
                {isOpen && (
                  <nav className="space-y-0.5 mt-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onSelectTab(item.id);
                            onCloseMobile();
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all duration-150 group ${
                            isActive
                              ? 'bg-teal-500/10 text-teal-400'
                              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-4 h-4 flex-shrink-0 ${
                                isActive
                                  ? 'text-teal-400'
                                  : 'text-slate-500 group-hover:text-slate-300'
                              }`}
                            />
                            <div className="min-w-0">
                              <div
                                className={`text-[12px] font-medium truncate leading-tight ${
                                  isActive ? 'text-teal-400' : ''
                                }`}
                              >
                                {item.label}
                              </div>
                              <div
                                className={`text-[10px] truncate leading-tight mt-0.5 ${
                                  isActive
                                    ? 'text-teal-400/70'
                                    : 'text-slate-500 group-hover:text-slate-400'
                                }`}
                              >
                                {item.subtitle}
                              </div>
                            </div>
                          </div>

                          {item.badge && (
                            <span
                              className={`text-[9.5px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${item.badgeColor}`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                )}
              </div>
            );
          })}

          {/* ── FLAGGED COUNTERFEITS PILL (Surveillance & Management only) ── */}
          {flaggedCount > 0 && userRole !== 'ict_staff' && (
            <div className="mt-2 mx-1 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span className="text-[10.5px] font-medium text-rose-300 truncate">
                  Flagged counterfeits
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded font-semibold text-[10px] bg-rose-500/20 text-rose-200 flex-shrink-0">
                {flaggedCount}
              </span>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="px-5 py-3 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-slate-300 mb-1">
            <Building2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            <span className="text-[11px] font-medium">Rwanda FDA</span>
          </div>
          <p className="text-[9.5px] text-slate-500 leading-relaxed mb-2">
            National medicine verification platform.
          </p>
          <div className="flex items-center justify-between text-[9.5px] text-slate-500 font-mono">
            <span>v2.4-prod</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <BadgeCheck className="w-3 h-3" />
              <span>Certified</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;