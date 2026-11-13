/**
 * Server-side ElevenLabs text-to-speech endpoint: GET /api/tts?id=<wordId>&kind=word|sentence, or ?kind=test.
 *
 * Runs as a Vercel function in production and as Vite dev/preview middleware locally (see vite.config.ts).
 * The API key stays on the server: the SDK reads ELEVENLABS_API_KEY from the environment.
 *
 * Only text from the word library (or the fixed parent test phrase) can be spoken, so the public
 * endpoint can't be used to spend credits on arbitrary text. Responses are cacheable by the CDN and
 * the service worker, so each word is normally generated once.
 */
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import easy from '../src/data/words/easy.json' with { type: 'json' };
import hard from '../src/data/words/hard.json' with { type: 'json' };
import medium from '../src/data/words/medium.json' with { type: 'json' };

/** George (pre-made, works on free plans). Override with ELEVENLABS_VOICE_ID. */
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const MODEL_ID = 'eleven_v4';
export const TEST_PHRASE = 'Hello! Can you spell panda?';

interface Entry {
  id: string;
  word: string;
  sentence: string;
}
const byId = new Map<string, Entry>(
  ([...easy, ...medium, ...hard] as Entry[]).map((w) => [w.id, w]),
);

function lookupText(url: URL): string | undefined {
  const kind = url.searchParams.get('kind');
  if (kind === 'test') return TEST_PHRASE;
  const entry = byId.get(url.searchParams.get('id') ?? '');
  if (!entry) return undefined;
  if (kind === 'word') return entry.word;
  if (kind === 'sentence') return entry.sentence;
  return undefined;
}

let client: ElevenLabsClient | undefined;

export async function GET(request: Request): Promise<Response> {
  if (!process.env.ELEVENLABS_API_KEY)
    return new Response('ElevenLabs is not configured', { status: 503 });
  const text = lookupText(new URL(request.url));
  if (!text) return new Response('Unknown text', { status: 404 });

  try {
    client ??= new ElevenLabsClient();
    const audio = await client.textToSpeech.convert(
      process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
      {
        text,
        modelId: MODEL_ID,
        languageCode: 'en',
        outputFormat: 'mp3_44100_128',
        // Steady, clear delivery for young spellers.
        voiceSettings: { stability: 0.75, similarityBoost: 0.75 },
      },
    );
    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        // Same word + voice always sounds the same: let the browser and CDN keep it.
        'Cache-Control': 'public, max-age=2592000, s-maxage=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[tts] ElevenLabs request failed:', err);
    return new Response('Speech generation failed', { status: 502 });
  }
}
