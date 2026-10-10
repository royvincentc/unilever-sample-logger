// Only imported by the dedicated synthetic preview config. Never production auth.
const role=new URLSearchParams(location.search).get('role')||'editor';
export const auth={currentUser:{uid:role,isAnonymous:false,getIdToken:async()=>`fixture:${role}`},onAuthStateChanged(callback:(user:any)=>void){queueMicrotask(()=>callback(this.currentUser));return()=>{};}};
export const db={};
