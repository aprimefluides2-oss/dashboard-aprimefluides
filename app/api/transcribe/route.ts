import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export async function POST(req: NextRequest) {
  // Message destiné au technicien sur le terrain, pas à un développeur : il doit
  // comprendre que ça ne vient pas de lui et qu'il peut continuer en tapant.
  // Le `code` reste exploitable pour le diagnostic (cf. /api/health → env_openai_key).
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Dictée vocale indisponible : la transcription n'est pas configurée sur le serveur. Prévenez l'administrateur — en attendant, vous pouvez taper le rapport.",
        code: 'MISSING_OPENAI_KEY',
      },
      { status: 503 },
    )
  }
  // `req.formData()` était hors du try : une requête malformée (corps vide, mauvais
  // content-type, upload interrompu par une coupure réseau sur le terrain) remontait
  // en 500 SANS corps JSON, et le client affichait une erreur brute incompréhensible.
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      {
        error: "L'enregistrement n'a pas pu être envoyé. Vérifiez votre connexion et réessayez.",
        code: 'INVALID_FORM_DATA',
      },
      { status: 400 },
    )
  }

  const audioFile = formData.get('audio') as File
  if (!audioFile) return NextResponse.json({ error: 'Fichier audio manquant' }, { status: 400 })

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "fr",
      prompt: "débouchage, hydrocurage, canalisation, évier, WC, siphon, bouchon, curage, chemisage, inspection caméra, Argenteuil, Cergy, Bezons, Versailles, Paris, Île-de-France",
    })
    return NextResponse.json({ text: transcription.text })
  } catch (e: any) {
    // Le technicien lisait « OpenAI : 429 insufficient_quota… ». On traduit les
    // pannes courantes en consignes actionnables ; le détail technique part dans
    // `detail`/`code` (diagnostic) et dans les logs Vercel, jamais à l'écran.
    const status: number | undefined = e?.status
    const code: string | undefined = e?.code || e?.error?.code
    const detail = String(e?.message || e).slice(0, 300)
    console.error('[transcribe] échec OpenAI', { status, code, detail })

    // Un crédit épuisé remonte en 429 avec le code `insufficient_quota` : ce cas
    // doit être testé AVANT le 429 générique, sinon on conseille d'attendre alors
    // qu'il faut recharger le compte.
    let error =
      "La transcription a échoué. Réessayez, ou tapez le rapport si le problème persiste."
    let httpStatus = 502

    if (status === 401 || code === 'invalid_api_key') {
      error =
        "Dictée indisponible : la clé de transcription est refusée par le service. Prévenez l'administrateur — en attendant, vous pouvez taper le rapport."
      httpStatus = 503
    } else if (code === 'insufficient_quota' || status === 402) {
      error =
        "Dictée indisponible : le crédit du service de transcription est épuisé. Prévenez l'administrateur — en attendant, vous pouvez taper le rapport."
      httpStatus = 503
    } else if (status === 429) {
      error = 'Trop de dictées en même temps. Patientez quelques secondes puis réessayez.'
      httpStatus = 429
    } else if (status === 413 || code === 'file_too_large') {
      error =
        'Enregistrement trop long pour être transcrit. Découpez votre dictée en plusieurs passages plus courts.'
      httpStatus = 413
    }

    return NextResponse.json(
      { error, code: code || (status ? `HTTP_${status}` : 'UNKNOWN'), detail },
      { status: httpStatus },
    )
  }
}
