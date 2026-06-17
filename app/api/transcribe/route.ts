import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurée' }, { status: 500 })
  }
  const formData = await req.formData()
  const audioFile = formData.get('audio') as File
  if (!audioFile) return NextResponse.json({ error: 'Fichier audio manquant' }, { status: 400 })

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "fr",
      prompt: "débouchage, hydrocurage, canalisation, évier, WC, siphon, bouchon, curage, chemisage, inspection caméra, Toulon, Hyères, Var",
    })
    return NextResponse.json({ text: transcription.text })
  } catch (e: any) {
    return NextResponse.json({ error: `OpenAI : ${e.message || e.toString()}` }, { status: 500 })
  }
}
