import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import OfflineBanner from '../ui/OfflineBanner';
import ReportIssueModal from '../ui/ReportIssueModal';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useDialogFocus } from '../../hooks/useDialogFocus';
interface LayoutProps {children:ReactNode;onLogout:()=>void;queueCount:number;}
export default function Layout({children,onLogout,queueCount}:LayoutProps) {
  const online=useOnlineStatus();
  const [collapsed,setCollapsed]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const drawerRef=useRef<HTMLDivElement>(null);
  useDialogFocus(drawerRef,menuOpen,()=>setMenuOpen(false));
  useEffect(()=>{document.body.classList.toggle('sidebar-collapsed',collapsed);return ()=>document.body.classList.remove('sidebar-collapsed');},[collapsed]);
  useEffect(()=>{if(!menuOpen)return;const original=document.body.style.overflow;document.body.style.overflow='hidden';return ()=>{document.body.style.overflow=original;};},[menuOpen]);
  return <div className={`lab-shell ${collapsed?'sidebar-compact':''}`}>
    <a href="#main-content" className="lab-skip-link">Skip to content</a>
    <OfflineBanner visible={!online}/>
    {menuOpen && <div className="lab-drawer-backdrop" onClick={()=>setMenuOpen(false)} aria-hidden="true"/>}
    <div ref={drawerRef}><Sidebar onLogout={onLogout} queueCount={queueCount} isCollapsed={collapsed} onToggleCollapse={()=>setCollapsed(!collapsed)} isMobileOpen={menuOpen} onMobileClose={()=>setMenuOpen(false)}/></div>
    <div inert={menuOpen ? true : undefined}><BottomNav queueCount={queueCount} onMenuClick={()=>setMenuOpen(true)}/><main id="main-content" tabIndex={-1} className="lab-main">{children}</main><ReportIssueModal/></div>
  </div>;
}
