import http from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { normalizeTitle } from './title.mjs';
const data=process.env.PILOT_DATA;
if(!data) throw new Error('Set PILOT_DATA to a disposable JSON file');
let entries=existsSync(data)?JSON.parse(readFileSync(data,'utf8')):[];
const html=readFileSync(new URL('./index.html',import.meta.url));
const server=http.createServer(async(req,res)=>{
 try {
  if(req.method==='GET'&&req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  if(req.method==='GET'&&req.url==='/api/notes'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(entries));return;}
  if(req.method==='POST'&&req.url==='/api/notes'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){res.writeHead(413);res.end();return;}}
   const title=normalizeTitle(JSON.parse(body).title);
   if(!title||title.length>120){res.writeHead(400);res.end('Enter a title of 1–120 characters');return;}
   const note={id:entries.length+1,title};entries=[...entries,note];writeFileSync(data,JSON.stringify(entries));res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify(note));return;
  }
  res.writeHead(404);res.end('Not found');
 }catch{res.writeHead(400);res.end('Invalid request');}
});
server.listen(Number(process.env.PORT??0),process.env.HOST || '127.0.0.1',()=>console.log(JSON.stringify({port:server.address().port})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
