import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const csv = read('data/perfiles.csv');
const template = read('sheets-admin/Admin.html');
const styles = read('sheets-admin/AdminStyles.html');
const client = read('sheets-admin/AdminClient.html');

function parseCsv(source) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(quoted&&char==='"'&&source[i+1]==='"'){cell+='"';i++;}
    else if(char==='"')quoted=!quoted;
    else if(char===','&&!quoted){row.push(cell);cell='';}
    else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&source[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(value=>value!==''))rows.push(row);row=[];}
    else cell+=char;
  }
  if(cell!==''||row.length){row.push(cell);rows.push(row);}
  const headers=rows.shift().map(value=>value.replace(/^\uFEFF/,''));
  return rows.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]||''])));
}
const records=parseCsv(csv).map(record=>({...record,estado:'Activo',notas:'',correo:'',whatsapp_interno:'',fecha_nacimiento:'',genero:'',acepta_privacidad:'TRUE',fecha_registro:'Muestra pública'}));
const seed=records.slice(0,3).map((source,index)=>({...source,id:String(9001+index),nombres:['Perfil','Registro','Solicitud'][index],apellidos:['de muestra','de prueba','de ejemplo'][index],estado:'Pendiente',descripcion_corta:'Ficha de ejemplo para probar el flujo de revisión',descripcion_larga:'Este registro solo existe en la vista previa local y no se envía a la hoja de datos.',foto_perfil:'',imagen_portada:'',whatsapp_publico:'',whatsapp_interno:'',correo:'',notas:'',fecha_registro:'Muestra local'}));
records.push(...seed);
const mock=`window.demoService=(()=>{
 const storageKey='oficial-admin-panel-demo-v1';
 let data;try{data=JSON.parse(localStorage.getItem(storageKey))||${JSON.stringify(records)};}catch{data=${JSON.stringify(records)};}
 const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(data));}catch{}};
 const statusList=['Pendiente','Activo','Rechazado','Inactivo'];
 const publicHeaders=${JSON.stringify(['id','nombres','apellidos','departamento','provincia','distrito','whatsapp_publico','portafolio_url','instagram_usuario','linkedin_usuario','behance_usuario','categoria','descripcion_corta','descripcion_larga','productos_servicios','nivel_experiencia','nivel_precio','foto_perfil','imagen_portada','es_verificado','es_destacado','posicion'])};
 return {
  resetDemo(){localStorage.removeItem(storageKey);location.reload();},
  async getAdminRecords(filters={}){const counts={total:data.length,Pendiente:0,Activo:0,Rechazado:0,Inactivo:0};data.forEach(r=>{if(counts[r.estado]!==undefined)counts[r.estado]++;});const districts=[...new Set(data.map(r=>r.distrito).filter(Boolean))].sort();const q=String(filters.search||'').toLocaleLowerCase('es-PE');const filtered=data.filter(r=>(filters.status==='Todos'||!filters.status||r.estado===filters.status)&&(filters.category==='Todas'||!filters.category||r.categoria===filters.category)&&(filters.district==='Todos'||!filters.district||r.distrito===filters.district)&&(!filters.verified||r.es_verificado==='TRUE')&&(!filters.featured||r.es_destacado==='TRUE')&&(!q||[r.id,r.nombres,r.apellidos,r.categoria,r.distrito,r.provincia,r.departamento].join(' ').toLocaleLowerCase('es-PE').includes(q)));return {records:filtered.map(r=>({id:r.id,name:[r.nombres,r.apellidos].filter(Boolean).join(' '),category:r.categoria,district:r.distrito,province:r.provincia,department:r.departamento,status:r.estado,verified:r.es_verificado==='TRUE',featured:r.es_destacado==='TRUE',photo:r.foto_perfil,date:r.fecha_registro})),districts,counts};},
  async getReviewRecord(id){const record=data.find(r=>String(r.id)===String(id));if(!record)throw Error('No se encontró el perfil');return {...record};},
  async getPublicCsvData(){return [publicHeaders,...data.filter(r=>r.estado==='Activo').map(r=>publicHeaders.map(header=>r[header]||''))];},
  async saveReview(update){if(!statusList.includes(update.estado))throw Error('Estado no válido');const record=data.find(r=>String(r.id)===String(update.id));if(!record)throw Error('No se encontró el perfil');Object.assign(record,update,{es_verificado:update.es_verificado?'TRUE':'FALSE',es_destacado:update.es_destacado?'TRUE':'FALSE'});save();return {ok:true,id:record.id,estado:record.estado};}
 };
})();`;
const localHtml=template
  .replace('<style><?!= include(\'AdminStyles\'); ?></style>',`<style>\n${styles}\n</style>`)
  .replace('<script><?!= include(\'AdminClient\'); ?></script>',`<script>\n${mock}\n</script>\n<script>\n${client}\n</script>`)
  .replace('<section class="filters"', '<div class="demo-banner"><span class="demo-dot"></span> VISTA PREVIA LOCAL <span>Datos de muestra · los cambios se guardan solo en este navegador</span><button class="demo-reset" id="demo-reset">Restablecer muestra</button></div>\n      <section class="filters"')
  .replace('<script>\n'+client+'\n</script>', '<script>\n'+client+'\ndocument.querySelector("#demo-reset").addEventListener("click",()=>window.demoService.resetDemo());\n</script>');
const output=path.join(root,'sandbox','admin-panel','index.html');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,localHtml);
console.log(`Panel de gestión local preparado: ${path.relative(root,output)}`);
