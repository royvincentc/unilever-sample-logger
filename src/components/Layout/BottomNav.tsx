import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Plus, ListTodo, Clock, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import { spring } from '../../design/motion';
const items=[{to:'/',icon:LayoutDashboard,label:'Home'},{to:'/history',icon:Clock,label:'History'},{to:'/new',icon:Plus,label:'New sample',primary:true},{to:'/queue',icon:ListTodo,label:'Queue'}];
interface BottomNavProps {queueCount:number;onMenuClick:()=>void;}
export default function BottomNav({queueCount,onMenuClick}:BottomNavProps) {
 return <nav className="lab-bottom-nav" aria-label="Mobile navigation">{items.map(item=><NavLink to={item.to} end={item.to==='/'} key={item.to} className={({isActive})=>`${isActive?'active':''} ${item.primary?'primary':''}`}>{({isActive})=><><motion.span className="lab-bottom-icon" whileTap={item.primary?{scale:.92}:undefined} transition={spring.snap}>{isActive&&!item.primary&&<motion.span layoutId="lab-bottom-indicator" className="lab-bottom-indicator" style={{borderRadius:10}} transition={spring.snap}/>}<item.icon size={20}/>{item.to==='/queue'&&queueCount>0&&<motion.b key={queueCount} initial={{scale:.6}} animate={{scale:1}} transition={spring.snap} aria-label={`${queueCount} pending sync`}>{queueCount}</motion.b>}</motion.span><span>{item.label}</span></>}</NavLink>)}<button type="button" onClick={onMenuClick} aria-controls="workspace-sidebar" aria-haspopup="dialog"><span className="lab-bottom-icon"><Menu size={20}/></span><span>Menu</span></button></nav>;
}
