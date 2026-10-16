'use client'
import { useEffect, useRef, useState } from 'react'
import { validInspectionDraft } from '@/lib/inspection-draft'
import { readRecovery, saveRecovery } from '@/lib/recovery-store'
type Snapshot = Record<string, unknown>
export default function InspectionRecovery({ snapshot, onRestore, createNewStudy }: { snapshot: Snapshot; onRestore: (s: Snapshot) => void; createNewStudy: () => Snapshot }) {
  const restore = useRef(onRestore); restore.current = onRestore
  const template = useRef(snapshot)
  const generation = useRef(0)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('Ouverture de la sauvegarde locale…')
  const [retry, setRetry] = useState(0)
  const dirty = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const busyRef = useRef(false)
  const [starting, setStarting] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  useEffect(() => { let live=true; readRecovery<{version:number; data:Snapshot}>('inspection-camera-v1').then(saved=>{if(!live)return;if(saved?.version===1){if(!validInspectionDraft(saved.data,template.current))throw new Error('Copie locale non reconnue');restore.current(saved.data);setMessage('Dossier repris depuis cet appareil. Reconnectez la clé et sélectionnez à nouveau les vidéos si nécessaire.')}else setMessage('Sauvegarde automatique sur cet appareil activée.');setReady(true)}).catch(()=>{if(live)setMessage('Sauvegarde locale indisponible : exportez régulièrement une copie du dossier.')});return()=>{live=false} },[retry])
  useEffect(()=>{if(!ready)return;dirty.current=true;const id=++generation.current;setMessage('Enregistrement local en cours…');const timer=timerRef.current=setTimeout(()=>{saveRecovery('inspection-camera-v1',{version:1,data:snapshot}).then(()=>{if(id!==generation.current)return;dirty.current=false;setMessage('Dossier et captures enregistrés sur cet appareil.')}).catch(()=>setMessage('Échec de sauvegarde locale : exportez une copie avant de quitter.'))},300);return()=>clearTimeout(timer)},[ready,snapshot])
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[])
  function downloadCopy(copy: Snapshot) {
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,data:copy})],{type:'application/json'}))
    const a=document.createElement('a');a.href=url
    const reference=String(copy.numero || 'inspection').replace(/[^a-zA-Z0-9_-]/g,'-')
    a.download=`dossier-${reference}-confidentiel.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  async function startNewStudy() {
    if (busyRef.current || !ready) return
    busyRef.current=true;setStarting(true);setReady(false)
    clearTimeout(timerRef.current);++generation.current
    const previous=snapshot
    try {
      const next=createNewStudy()
      if (!validInspectionDraft(next,template.current)) throw new Error('Formulaire non reconnu')
      await saveRecovery(`inspection-camera-archive-${crypto.randomUUID()}`,{version:1,data:previous})
      await saveRecovery('inspection-camera-v1',{version:1,data:next})
      downloadCopy(previous)
      restore.current(next)
      setConfirmNew(false)
      dirty.current=false
      setMessage('Nouvelle étude ouverte. Une copie du dossier précédent a été téléchargée.')
    } catch {
      setMessage('Impossible de préparer la nouvelle étude. Le dossier affiché est conservé : exportez une copie puis réessayez.')
    } finally {
      setReady(true);setStarting(false);busyRef.current=false
    }
  }

  return <section className="bg-white border rounded-2xl p-5 space-y-3"><div className="flex items-center justify-between flex-wrap gap-3"><h2 className="font-bold">Sauvegarde et reprise du dossier</h2><button type="button" disabled={!ready || starting} onClick={()=>setConfirmNew(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold disabled:opacity-50">{starting ? 'Préparation…' : 'Nouvelle étude'}</button></div>{confirmNew && <div role="alertdialog" aria-label="Commencer une nouvelle étude" className="border border-orange-200 bg-orange-50 rounded-xl p-4 space-y-3"><p>Une copie du dossier actuel sera conservée sur cet appareil et téléchargée avant de vider le formulaire. Téléchargez aussi votre PDF si vous en avez besoin.</p><div className="flex flex-wrap gap-3"><button type="button" disabled={starting} onClick={startNewStudy} className="bg-[#0e2a52] text-white px-4 py-2 rounded disabled:opacity-50">Conserver le dossier et commencer</button><button type="button" disabled={starting} onClick={()=>setConfirmNew(false)} className="border px-4 py-2 rounded">Annuler</button></div></div>}<p role="status">{message}</p><p className="text-sm text-slate-600">Sauvegarde locale du dossier en cours, des captures et annotations. Les vidéos originales restent sur votre clé. Une copie exportée permet de conserver plusieurs dossiers. Elle contient l’adresse du chantier : conservez-la dans un emplacement privé. Les données locales peuvent être effacées par le navigateur.</p><div className="flex gap-3 flex-wrap"><button type="button" className="bg-[#0e2a52] text-white p-2 rounded" onClick={()=>downloadCopy(snapshot)}>Exporter une copie du dossier</button>{!ready && !starting && <button type="button" onClick={()=>setRetry(n=>n+1)}>Réessayer la sauvegarde</button>}<label className="border p-2 rounded">Reprendre une copie exportée<input className="block" type="file" accept=".json,application/json" onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(!file)return;try{if(file.size>50*1024*1024)throw new Error();const parsed=JSON.parse(await file.text());if(parsed.version!==1||!validInspectionDraft(parsed.data,template.current))throw new Error();if(!window.confirm('Remplacer le dossier affiché par cette copie ? Exportez le dossier actuel avant de poursuivre si vous devez le conserver.'))return;restore.current(parsed.data);setMessage('Copie importée.');}catch{setMessage('Copie non reconnue ou trop volumineuse (maximum 50 Mo).')}finally{input.value=''}}} /></label></div></section>
}
