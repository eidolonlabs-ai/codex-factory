import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
const dir=mkdtempSync(join(tmpdir(),'solo-notes-'));let child;
async function start(){child=spawn(process.execPath,['src/server.mjs'],{env:{...process.env,PILOT_DATA:join(dir,'notes.json')},stdio:['ignore','pipe','inherit']});let buf='';return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server readiness timeout')),5000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error(`Server exited ${code}`));});child.stdout.on('data',chunk=>{buf+=chunk;if(buf.includes('\n')){clearTimeout(timer);try{resolve('http://127.0.0.1:'+JSON.parse(buf.trim()).port);}catch(e){reject(e);}}});});}
async function stop(){if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}}
try{
 let url=await start();
 let r=await fetch(url+'/api/notes',{method:'POST',body:JSON.stringify({title:'  '})});assert.equal(r.status,400,'Whitespace-only titles must be rejected');
 r=await fetch(url+'/api/notes',{method:'POST',body:JSON.stringify({title:'  Persistent note  '})});assert.equal(r.status,201);assert.equal((await r.json()).title,'Persistent note');
 await stop();url=await start();assert.deepEqual(await (await fetch(url+'/api/notes')).json(),[{id:1,title:'Persistent note'}]);console.log('HTTP validation and restart persistence passed');
}finally{await stop();rmSync(dir,{recursive:true,force:true});}
