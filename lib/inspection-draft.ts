export function validInspectionDraft(value: unknown, template: Record<string,unknown>): value is Record<string,unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const d=value as Record<string,unknown>
 for(const [key,example] of Object.entries(template)) if(!(key==="conclusionPrecision" && d[key]===undefined)) if(!Array.isArray(example)&&typeof d[key]!==typeof example)return false
 if(!['client-prive','anonymise'].includes(String(d.diffusion))||!['brouillon','valide'].includes(String(d.statut))||!['bon','a-surveiller','desordre','critique'].includes(String(d.conclusionEtat)))return false
 if(!Array.isArray(d.precoSelected)||!d.precoSelected.every(x=>typeof x==='string')||!Array.isArray(d.precoCustom)||!d.precoCustom.every(x=>x&&typeof x.titre==='string'&&typeof x.detail==='string'))return false
 if(!Array.isArray(d.videoManifest)||!d.videoManifest.every(m=>m&&typeof m.id==='string'&&/^Vidéo [1-9][0-9]*$/.test(m.id)&&typeof m.name==='string'&&Number.isFinite(m.size)&&Number.isFinite(m.modified)))return false
 if(!Array.isArray(d.observations)||d.observations.length>500)return false
 return d.observations.every(o=>{
  if(!o||typeof o!=='object'||typeof o.position!=='string'||typeof o.description!=='string')return false
  for(const key of ['code','photoLegende','videoReference','timecode','troncon','pointDepart','sensInspection','distanceSource'])if(o[key]!==undefined&&typeof o[key]!=='string')return false
  if(o.distanceM!==undefined&&(typeof o.distanceM!=='number'||!Number.isFinite(o.distanceM)||o.distanceM<0))return false
  for(const key of ['photoUrl','originalPhotoUrl'])if(o[key]!==undefined&&(typeof o[key]!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(o[key])))return false
  if(o.annotations!==undefined&&(!Array.isArray(o.annotations)||o.annotations.length>500||!o.annotations.every((m:any)=>m&&['arrow','circle'].includes(m.kind)&&['x1','y1','x2','y2'].every(k=>typeof m[k]==='number'&&Number.isFinite(m[k])&&m[k]>=0&&m[k]<=1))))return false
  return true
 })
}
