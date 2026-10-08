import { Sun, Moon, Monitor, Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
interface HeaderProps { theme:'light'|'dark'|'system'; onSetTheme:(theme:'light'|'dark'|'system')=>void; title?:string; }
const options=[{value:'light' as const,icon:Sun},{value:'dark' as const,icon:Moon},{value:'system' as const,icon:Monitor}];
export default function Header({theme,onSetTheme,title}:HeaderProps) {
  const online=useOnlineStatus();
  return <header className="lab-header"><div className="lab-header-title"><img src="/unilever-logo.png" alt="Unilever"/><div><span className="lab-header-eyebrow">QC MICRO / WORKSPACE</span><h2>{title||'Dashboard'}</h2></div></div><div className="lab-header-tools"><span className={`lab-network ${online?'':'offline'}`}>{online?<Wifi size={14}/>:<WifiOff size={14}/>}<span>{online?'Connected':'Offline'}</span></span><div className="lab-theme-switch" role="group" aria-label="Appearance">{options.map(option=><button key={option.value} type="button" onClick={()=>onSetTheme(option.value)} aria-label={`Use ${option.value} theme`} aria-pressed={theme===option.value} title={`${option.value} theme`}><option.icon size={16}/></button>)}</div></div></header>;
}
