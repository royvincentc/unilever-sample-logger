import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, PlusCircle, Clock, ListTodo, Settings, LogOut, FlaskConical, FileText, FileSpreadsheet, BookOpen, CalendarDays, ChevronLeft, ChevronRight, X, ShieldCheck } from 'lucide-react';
const groups = [
  { label: 'WORKSPACE', items: [{to:'/',icon:LayoutDashboard,label:'Dashboard'},{to:'/new',icon:PlusCircle,label:'New sample'},{to:'/queue',icon:ListTodo,label:'Offline queue'}] },
  { label: 'COLLABORATION', items: [{to:'/kanban',icon:ListTodo,label:'Shared boards'},{to:'/whiteboard',icon:FileText,label:'Whiteboard'}] },
  { label: 'LAB OPERATIONS', items: [{to:'/history',icon:Clock,label:'History'},{to:'/incubation',icon:FlaskConical,label:'Incubations'},{to:'/calendar',icon:CalendarDays,label:'Calendar'}] },
  { label: 'RECORDS & REPORTS', items: [{to:'/live',icon:FileSpreadsheet,label:'Live sheet'},{to:'/logbook',icon:BookOpen,label:'Logbook'},{to:'/results',icon:FileText,label:'Reports'},{to:'/settings',icon:Settings,label:'Settings'}] },
];
interface SidebarProps { onLogout:()=>void; queueCount:number; isCollapsed:boolean; onToggleCollapse:()=>void; isMobileOpen?:boolean; onMobileClose?:()=>void; }
export default function Sidebar({onLogout,queueCount,isCollapsed,onToggleCollapse,isMobileOpen,onMobileClose}:SidebarProps) {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width:1024px)').matches);
  useEffect(() => { const media=window.matchMedia('(min-width:1024px)'); const update=()=>setDesktop(media.matches); media.addEventListener('change',update); return ()=>media.removeEventListener('change',update); }, []);
  return <aside id="workspace-sidebar" inert={!desktop && !isMobileOpen ? true : undefined} className={`lab-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`} aria-label="Workspace navigation" role={isMobileOpen ? 'dialog' : undefined} aria-modal={isMobileOpen || undefined}>
    <div className="lab-brand"><img src="/unilever-logo.png" alt="Unilever" /><div><strong>Unilever</strong><span>QC MICRO / SAMPLE LOGGER</span></div></div>
    <button className="lab-sidebar-toggle" type="button" onClick={onToggleCollapse} aria-label={isCollapsed?'Expand sidebar':'Collapse sidebar'}>{isCollapsed?<ChevronRight size={16}/>:<ChevronLeft size={16}/>}</button>
    <button className="lab-mobile-close" type="button" onClick={onMobileClose} aria-label="Close navigation"><X size={20}/></button>
    <nav aria-label="Main navigation">{groups.map(group=><div className="lab-nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item=><NavLink to={item.to} end={item.to==='/'} key={item.to} onClick={()=>onMobileClose?.()} aria-label={item.label} title={isCollapsed?item.label:undefined} className={({isActive})=>`lab-nav-link ${isActive?'active':''}`}><item.icon size={19}/><span>{item.label}</span>{item.to==='/queue' && queueCount>0 && <b>{queueCount}</b>}</NavLink>)}</div>)}</nav>
    <div className="lab-sidebar-footer"><div className="lab-workspace-badge"><ShieldCheck size={18}/><div><strong>QC microbiology</strong><span>Your connected workspace</span></div></div><button onClick={onLogout} className="lab-nav-link" type="button" aria-label="Sign out"><LogOut size={18}/><span>Sign out</span></button></div>
  </aside>;
}
