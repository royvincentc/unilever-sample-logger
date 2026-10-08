import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { BrowserRouter,Routes,Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import '../../src/index.css';
import '../../src/design/precision-lab.css';
import Layout from '../../src/components/Layout/Layout';
import Dashboard from '../../src/pages/Dashboard';
import NewSample from '../../src/pages/NewSample';
import SubmissionQueue from '../../src/pages/SubmissionQueue';
import SampleHistory from '../../src/pages/SampleHistory';
import Results from '../../src/pages/Results';
import LiveSheetView from '../../src/pages/LiveSheetView';
import Logbook from '../../src/pages/Logbook';
import Incubation from '../../src/pages/Incubation';
import Calendar from '../../src/pages/Calendar';
import Settings from '../../src/pages/Settings';
import LoginPage from '../../src/components/auth/LoginPage';
import { ToastProvider } from '../../src/components/ui/Toast';
import { useTheme } from '../../src/hooks/useTheme';
import { getQueueItems,addToQueue } from '../../src/utils/db';
import { failNextHistorySave } from './fixtures';
localStorage.setItem('seen_patch_version','v1.2.0');
let connected=true;
Object.defineProperty(navigator,'onLine',{get:()=>connected,configurable:true});
function Preview(){
 const {theme,setTheme}=useTheme();const [count,setCount]=useState(0);const [online,setOnline]=useState(true);
 const refresh=()=>getQueueItems().then(items=>setCount(items.filter(i=>i.status==='queued'||i.status==='failed').length));
 useEffect(()=>{refresh();},[]);
 return <MotionConfig reducedMotion="user"><ToastProvider><BrowserRouter>
 <div className="preview-controls" style={{position:'relative',zIndex:60,display:'flex',gap:8,padding:8,background:'#182b46',color:'#fff',fontSize:11,flexWrap:'wrap'}}><span>SYNTHETIC PREVIEW · no production services</span><button onClick={()=>{connected=!connected;setOnline(connected);window.dispatchEvent(new Event(connected?'online':'offline'));}}>Simulate {online?'offline':'online'}</button><button onClick={failNextHistorySave}>Fail next history save</button><a href="/login">Preview login</a><a href="/">Dashboard</a></div>
 <Routes><Route path="/login" element={<LoginPage onLogin={(u,p)=>u==='demo'&&p==='demo'} onPinLogin={async p=>p==='12345678'} onGoogleLogin={()=>{}}/>}/><Route path="*" element={<Layout onLogout={()=>{}} queueCount={count}><Routes><Route path="/" element={<Dashboard theme={theme} onSetTheme={setTheme} queueCount={count}/>}/><Route path="/new" element={<NewSample onQueueUpdate={refresh}/>}/><Route path="/queue" element={<SubmissionQueue onQueueUpdate={refresh}/>}/><Route path="/history" element={<SampleHistory/>}/><Route path="/live" element={<LiveSheetView/>}/><Route path="/logbook" element={<Logbook/>}/><Route path="/results" element={<Results/>}/><Route path="/incubation" element={<Incubation/>}/><Route path="/calendar" element={<Calendar/>}/><Route path="/settings" element={<Settings/>}/></Routes></Layout>}/></Routes>
 </BrowserRouter></ToastProvider></MotionConfig>;
}
async function start(){if(!(await getQueueItems()).length){for(const [i,type]of ['WATER','AIR'].entries())await addToQueue({id:`synthetic-queue-${i}`,sampleType:type as 'WATER'|'AIR',sampleName:`${type} point A`,controlNumber:`DEMO-${i+1}`,formData:{} as any,status:i?'failed':'queued',createdAt:new Date().toISOString(),submittedBy:'Demo analyst'});}createRoot(document.getElementById('root')!).render(<Preview/>);}
start();
