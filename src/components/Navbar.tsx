import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  MapPin,
  Pill,
  Barcode,
  Mail,
  MailOpen,
  User,
  Settings,
  HelpCircle,
  Smartphone,
  Shield
} from 'lucide-react'
import type { CurrentUser, UserRole, HealthStatus } from '../api'
import type { Scan, Product } from '../types'

interface NavbarProps {
  currentUser: CurrentUser
  onSwitchRole?: (role: UserRole) => void
  onSignOut: () => void
  onToggleMobileMenu: () => void
  health?: HealthStatus | null
  searchQuery: string
  onSearchChange: (query: string) => void
  scans?: Scan[]
  products?: (Product & { id: string })[]
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onSwitchRole,
  onSignOut,
  onToggleMobileMenu,
  health,
  searchQuery,
  onSearchChange,
  scans = [],
  products = []
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifMenuOpen, setNotifMenuOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click or escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setNotifMenuOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false)
        setNotifMenuOpen(false)
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  // Derive initial or display name
  const displayName = currentUser.name || currentUser.email.split('@')[0].replace(/[._]/g, ' ').replace(/^./, (s) => s.toUpperCase())
  const initial = (currentUser.name || currentUser.email || 'U').trim().charAt(0).toUpperCase()

  // Dynamic live notifications derived from scans and backend health
  const sampleNotifications = useMemo(() => {
    const list = []
    const flagged = scans.filter((s) => s.category !== 'Genuine')
    flagged.slice(0, 4).forEach((s) => {
      list.push({
        id: s.id,
        title: s.category === 'Critical' ? 'Critical Counterfeit Incident' : 'Suspicious Batch Flagged',
        detail: `${s.productName} (${s.barcode}) at ${s.location} (${s.similarity ?? 0}% match).`,
        time: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        urgent: s.priority === 'urgent' || s.category === 'Critical',
        read: s.caseStatus === 'confirmed' || s.caseStatus === 'not_confirmed'
      })
    })

    if (health?.status === 'online') {
      list.push({
        id: 'sys-online',
        title: 'Central Registry Active',
        detail: `${products.length} approved pharmaceutical records synchronized.`,
        time: 'Synced',
        urgent: false,
        read: true
      })
    }
    return list
  }, [scans, products, health])

  // Dynamic search suggestions derived from registered products and locations
  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    const results: { id: string; type: string; text: string; icon: React.ReactNode }[] = []

    products.forEach((p) => {
      if (p.name.toLowerCase().includes(q) && results.length < 4) {
        results.push({ id: `p-${p.id}`, type: 'Medicine', text: p.name, icon: <Pill className="w-3.5 h-3.5 text-teal" /> })
      }
      if (p.id.toLowerCase().includes(q) && results.length < 4) {
        results.push({ id: `b-${p.id}`, type: 'Barcode', text: p.id, icon: <Barcode className="w-3.5 h-3.5 text-teal" /> })
      }
    })

    const locations = ['Kigali', 'Rubavu', 'Rusizi']
    locations.forEach((loc) => {
      if (loc.toLowerCase().includes(q) && results.length < 5) {
        results.push({ id: `loc-${loc}`, type: 'Location', text: `${loc} Border Post`, icon: <MapPin className="w-3.5 h-3.5 text-teal" /> })
      }
    })

    return results
  }, [searchQuery, products])

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-xs h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile Toggle & Global Search */}
      <div className="flex items-center space-x-3 sm:space-x-4 flex-1 max-w-2xl">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 md:hidden transition cursor-pointer"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Professional Global Search Bar with Suggestions */}
        <div className="relative w-full max-w-lg" ref={searchRef}>
          <div className="relative flex items-center">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search medicines, batches, or locations..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition shadow-sm font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Suggestions Dropdown */}
          {searchFocused && searchQuery && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-fadeIn">
              <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 mb-1">
                Suggestions
              </div>
              {filteredSuggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSearchChange(s.text)
                    setSearchFocused(false)
                  }}
                  className="w-full flex items-center space-x-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition text-left cursor-pointer"
                >
                  <div className="p-1.5 bg-slate-100 rounded-md">
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{s.text}</div>
                    <div className="text-[10px] text-slate-400">{s.type}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Gateway Status, Notifications, & User Avatar Menu */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Gateway Online / Offline Badge */}
        <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <span
            className={`w-2 h-2 rounded-full ${
              health?.status === 'online'
                ? 'bg-emerald-500 animate-pulse'
                : health?.status === 'offline'
                ? 'bg-rose-500'
                : 'bg-amber-400'
            }`}
          />
          <span className="font-medium text-[11px]">
            {health?.status === 'online' ? 'Gateway Online' : 'Gateway Offline'}
          </span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setNotifMenuOpen(!notifMenuOpen)}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {/* Numbered Badge instead of red dot */}
            <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white">
              3
            </span>
          </button>

          {notifMenuOpen && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 z-50 text-slate-800 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-800">
                  Notifications
                </span>
                <span className="text-[10px] font-medium text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                  3 Unread
                </span>
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {sampleNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-2.5 rounded-xl transition border cursor-pointer group ${
                      notif.read 
                        ? 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100' 
                        : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center space-x-1.5">
                        {notif.urgent && !notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 mt-1.5"></span>
                        )}
                        <span className={`text-xs ${notif.read ? 'font-medium text-slate-600' : 'font-semibold text-slate-900'}`}>
                          {notif.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap ml-2">{notif.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug pl-3">{notif.detail}</p>
                    
                    {/* Mark as unread action */}
                    <div className="mt-2 pl-3 flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-[10px] font-medium text-teal hover:underline flex items-center space-x-1">
                        {notif.read ? (
                          <><Mail className="w-3 h-3" /><span>Mark as unread</span></>
                        ) : (
                          <><MailOpen className="w-3 h-3" /><span>Mark as read</span></>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between px-1">
                <button className="text-[11px] font-medium text-slate-500 hover:text-teal transition cursor-pointer">
                  Mark all as read
                </button>
                <button className="text-[11px] font-medium text-teal hover:underline cursor-pointer">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar with Interactive Dropdown */}
        <div className="relative pl-1 sm:pl-2 border-l border-slate-200" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center space-x-2.5 p-1 rounded-xl hover:bg-slate-50 transition cursor-pointer focus:outline-none"
            aria-expanded={userMenuOpen}
            aria-label="Open user menu"
          >
            {/* User Avatar circle */}
            <div className="w-8 h-8 rounded-full bg-[#0F1B22] border-2 border-teal/40 flex items-center justify-center text-white text-xs font-bold overflow-hidden shadow-xs">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            {/* User Name & Role text on desktop */}
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {displayName}
              </div>
              <div className="text-[10px] text-teal font-medium leading-tight capitalize">
                {currentUser.role.replace('_', ' ')}
              </div>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                userMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* User Dropdown Menu - Redesigned like Google Account */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-72 rounded-2xl bg-white border border-slate-200 shadow-2xl p-2 z-50 text-slate-800 animate-fadeIn">
              
              {/* User Profile Header */}
              <div className="flex flex-col items-center p-4 border-b border-slate-100 mb-2">
                <div className="w-12 h-12 rounded-full bg-[#0F1B22] border-2 border-teal flex items-center justify-center text-white font-bold text-lg overflow-hidden flex-shrink-0 mb-2">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {displayName}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mb-2">
                  {currentUser.email}
                </div>
                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-teal/10 text-teal border border-teal/20 text-[10px] font-medium">
                  <Shield className="w-3 h-3 mr-1" />
                  {currentUser.roleLabel || currentUser.role.replace('_', ' ')}
                </div>
              </div>

              {/* Rwanda FDA Target Population Role Switcher (RBAC) */}
              <div className="p-2 bg-slate-50/80 rounded-xl mb-2 border border-slate-100">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                  <span>Target Population</span>
                  <span className="text-[9px] font-mono text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/50">RBAC Mode</span>
                </div>
                <div className="space-y-1 mt-1">
                  {[
                    {
                      role: 'field_officer' as UserRole,
                      title: '1. Field Inspection Officer',
                      desc: 'Scan, review alerts, conduct investigations'
                    },
                    {
                      role: 'ict_staff' as UserRole,
                      title: '2. ICT & Systems Staff',
                      desc: 'Maintain registry and integration'
                    },
                    {
                      role: 'manager' as UserRole,
                      title: '3. Manager & Supervisor',
                      desc: 'Set priorities, oversee cases, use reports'
                    }
                  ].map((item) => {
                    const isCurrent = currentUser.role === item.role
                    return (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => {
                          if (onSwitchRole) onSwitchRole(item.role)
                          setUserMenuOpen(false)
                        }}
                        className={`w-full text-left p-2 rounded-lg transition-all text-xs flex items-center justify-between ${
                          isCurrent
                            ? 'bg-white shadow-xs border border-teal/40 text-teal font-semibold'
                            : 'hover:bg-slate-200/60 text-slate-600'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className={`text-[11.5px] leading-tight ${isCurrent ? 'text-teal' : 'text-slate-800 font-medium'}`}>
                            {item.title}
                          </div>
                          <div className="text-[9.5px] text-slate-400 leading-tight mt-0.5 truncate">
                            {item.desc}
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="w-2 h-2 rounded-full bg-teal flex-shrink-0 ml-1 shadow-xs" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Clean Account Menu Links */}
              <div className="space-y-0.5">
                <button className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition text-left text-xs font-medium text-slate-700 cursor-pointer">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Manage your account</span>
                </button>
                <button className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition text-left text-xs font-medium text-slate-700 cursor-pointer">
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Preferences and settings</span>
                </button>
                <button className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition text-left text-xs font-medium text-slate-700 cursor-pointer">
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span>Help & Support</span>
                </button>
                <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-100 transition text-left text-xs font-medium text-slate-700 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="w-4 h-4 text-slate-400" />
                    <span>Download mobile app</span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    NEW
                  </span>
                </button>
              </div>

              {/* Divider */}
              <div className="my-2 border-t border-slate-100" />

              {/* Sign Out CTA */}
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false)
                  onSignOut()
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer group"
              >
                <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar