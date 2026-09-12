const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
const fs=require('node:fs');
const samples=require('../backend/catalogue-seed');
if(process.env.NODE_ENV==='production')throw new Error('Preview samples cannot be added in production.');
const file=path.join(__dirname,'..','backend','storage','hub.sqlite');
if(!fs.existsSync(file))throw new Error('Start the local server once before adding samples.');
const db=new DatabaseSync(file);
try{
  db.exec('BEGIN IMMEDIATE');
  const insert=db.prepare('INSERT OR IGNORE INTO cars (id,data) VALUES (?,?)');
  let count=0;
  for(const sample of samples)count+=Number(insert.run(sample.id,JSON.stringify(sample)).changes);
  db.exec('COMMIT');
  console.log(`Added ${count} clearly labelled catalogue samples. Existing inventory and enquiries were not changed.`);
}catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
