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
    return NextResponse.json({ error: `OpenAI : ${e.message || e.toString()}` }, { status: 500 })
  }
}
