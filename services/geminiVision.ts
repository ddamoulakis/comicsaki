/**
 * Google Gemini Vision — image + chat-style questions → structured comic JSON
 */

import { Platform } from 'react-native';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { env } from '@/lib/env';
import {
  inferGreekFormatFromScan,
  normalizeGreekFormat,
  resolveGreekIssueNumber,
  type GreekReleaseFormat,
} from '@/lib/greekFormat';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_FALLBACKS = ['gemini-3.6-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'] as const;
const GEMINI_MAX_SIDE = 1600;

/**
 * Same idea as Gemini chat: look at the photo, answer concrete questions,
 * then pack answers into JSON for the app form.
 */
const PROMPT_COVER = `You are a comic-book identification expert (US Marvel/DC/Image/etc. and Greek editions: Anubis, Modern Times, Μαμούθ/Mammoth, Jemma, Compupress, ΚΟΜΙΞ, Μικρός Ήρως, Οξύ/Brainfood, Κάκτος, Πατάκη, Μεταίχμιο, Διόπτρα, Polaris).

I am sending you a photo of a comic book cover — the same way a user would upload it in Gemini chat.

Answer these questions using (1) text visible on the cover and (2) your comic knowledge when the cover is recognizable:

Q1. What is the full series / title as it should be catalogued? (e.g. "The Amazing Spider-Man", "Peter Parker, The Spectacular Spider-Man", "Batman")
Q2. What is the issue number? Digits only if known.
   CRITICAL for US Marvel/DC covers: read the LARGE number in the top-left corner box
   (above the month like AUG and the price like 25¢). That number IS the issue
   (e.g. 124), NOT the price and NOT #1 unless the box actually says 1.
Q3. What is the volume number if relevant?
Q4. Who is the publisher? (Marvel Comics, DC Comics, Image, Rebellion, Anubis, …)
Q5. What is the cover / publication year (4 digits)? Prefer the year printed on
   the cover (indicia/month box) over a guessed first-appearance year.
Q6. Month if known?
Q7. Genre category — MUST be one of: Super ήρωες | Χιούμορ | Φαντασία | Sci-Fi | Horror | Manga | Indie | Άλλο
Q8. Is this a Greek-language edition? (language el or en)
Q9. Collector notes in one short paragraph: cover artists, writers if known, cover price, "part X of Y", anniversary/subtitle, original English title for Greek editions.
Q10. Physical format — exactly one of: "τεύχος" (single periodic issue / magazine issue), "τόμος" (numbered volume in a series), "graphic_novel" (standalone album / one-shot book).

Be as complete as you would be in a normal Gemini chat reply for the same photo.
Do NOT leave publisher/year/issue empty out of caution if you recognize the comic.
If a field is truly unknowable, use "".

Return ONLY one JSON object (no markdown, no prose outside JSON):
{
  "series": "full series title",
  "issue": "digits only or \\"\\"",
  "volume": "digits or \\"\\"",
  "publisher": "publisher name or \\"\\"",
  "year": "YYYY or \\"\\"",
  "month": "month or \\"\\"",
  "category": "one of the categories above",
  "confidence": "high" | "medium" | "low",
  "language": "el" | "en",
  "format": "τεύχος" | "τόμος" | "graphic_novel",
  "notes": "short note or \\"\\""
}`;

/** Greek editions: match Gemini chat style — album title on cover first, never invent Mamouth #. */
const PROMPT_COVER_GREEK = `Είσαι ειδικός σε ελληνικές εκδόσεις κόμικς (Μαμούθ Κόμιξ, Anubis, Jemma Press, Modern Times, Compupress, ΚΟΜΙΞ, Μικρός Ήρως, Οξύ/Brainfood, Κάκτος, Πατάκη, Μεταίχμιο, Διόπτρα, Polaris).

Σου στέλνω φωτογραφία εξωφύλλου — απάντησε όπως θα απαντούσες σε Gemini chat για την ίδια φωτο.

Διάβασε ΠΡΩΤΑ το κείμενο που φαίνεται στο εξώφυλλο (ελληνικά), μετά συμπλήρωσε με γνώση κόμικς.

Ερωτήσεις:
Q1. Ποιος είναι ο ακριβής ελληνικός τίτλος άλμπουμ / υπότιτλος όπως τυπώνεται στο εξώφυλλο; (π.χ. "Λούκυ Κιντ: Επικίνδυνο Λάσο", ΟΧΙ μόνο "Λούκυ Λουκ")
Q2. Ποια είναι η μάρκα / σειρά στο εξώφυλλο; (π.χ. "Λούκυ Λουκ", "Αστερίξ")
Q3. Στο πεδίο "series" βάλε τον καλύτερο τίτλο καταλόγου όπως στο chat:
   - Προτίμησε τον ελληνικό τίτλο άλμπουμ από το εξώφυλλο (Q1).
   - Αν είναι spin-off (π.χ. Λούκυ Κιντ / Kid Lucky), ΜΗΝ το καταχωρήσεις απλά ως "Λούκυ Λουκ #Ν".
   - Παράδειγμα σωστό: "Λούκυ Κιντ: Επικίνδυνο Λάσο"
Q4. Αριθμός τεύχους / τόμου: ΜΟΝΟ αν φαίνεται καθαρά στο εξώφυλλο ή στο σπονδυλό. ΜΗΝ εφευρίσκεις αρίθμηση καταλόγου Μαμούθ (π.χ. #84) αν δεν τυπώνεται.
Q5. Εκδότης όπως στο εξώφυλλο (Μαμούθ Κόμιξ / Μαμούθ Comix, Anubis, …)
Q6. Έτος ελληνικής έκδοσης (YYYY) αν το ξέρεις, αλλιώς ""
Q7. Κατηγορία: Super ήρωες | Χιούμορ | Φαντασία | Sci-Fi | Horror | Manga | Indie | Άλλο
Q8. language: πάντα "el" για ελληνικό εξώφυλλο
Q9. notes: πρωτότυπος ξένος τίτλος, δημιουργοί εξωφύλλου, τιμή, μέρος (π.χ. 1 από 2), επέτειος/υπότιτλος — μία σύντομη παράγραφος όπως στο Gemini chat
Q10. Μορφή — ακριβώς ένα από: "τεύχος" (περιοδικό τεύχος), "τόμος" (σειρά τόμων / collected), "graphic_novel" (αυτοτελές άλμπουμ / one-shot)

Κανόνες:
- Μην αγνοείς τον υπότιτλο του εξωφύλλου.
- Μην βάζεις λάθος αρίθμηση της κύριας σειράς Λούκυ Λουκ όταν είναι Kid Lucky / Λούκυ Κιντ.
- Απάντησε όσο πλήρης όσο το Gemini chat.

Return ONLY one JSON object:
{
  "series": "ελληνικός τίτλος καταλόγου (άλμπουμ)",
  "issue": "ψηφία ή \\"\\"",
  "volume": "ψηφία ή \\"\\"",
  "publisher": "εκδότης",
  "year": "YYYY ή \\"\\"",
  "month": "",
  "category": "μία από τις κατηγορίες",
  "confidence": "high" | "medium" | "low",
  "language": "el",
  "format": "τεύχος" | "τόμος" | "graphic_novel",
  "notes": "πρωτότυπος τίτλος + δημιουργοί + σύντομο σχόλιο"
}`;

export type ComicRecognitionResult = {
  series: string;
  issue: string;
  publisher: string;
  year: string;
  category: string;
  volume?: string;
  month?: string;
  notes?: string;
  format?: GreekReleaseFormat;
  confidence: 'high' | 'medium' | 'low';
  language?: 'el' | 'en' | string;
  raw: string;
};

const CATEGORIES = [
  'Super ήρωες',
  'Χιούμορ',
  'Φαντασία',
  'Sci-Fi',
  'Horror',
  'Manga',
  'Indie',
  'Άλλο',
] as const;

/** JPEG ~1600px max side — tablet camera shots are too large for a fast Gemini upload. */
async function resizeImageForGemini(
  uri: string,
): Promise<{ data: string; mimeType: string }> {
  try {
    const context = ImageManipulator.manipulate(uri);
    const original = await context.renderAsync();
    const maxDim = Math.max(original.width, original.height);
    const image =
      maxDim > GEMINI_MAX_SIDE
        ? await context
            .reset()
            .resize(
              original.width >= original.height
                ? { width: GEMINI_MAX_SIDE }
                : { height: GEMINI_MAX_SIDE },
            )
            .renderAsync()
        : original;
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.8,
      base64: true,
    });
    if (saved.base64) {
      return { data: saved.base64, mimeType: 'image/jpeg' };
    }
  } catch {
    // fall through to a raw read
  }

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve({ data: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg' });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const data = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  return { data, mimeType: 'image/jpeg' };
}

function unwrapSeries(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return unwrapSeries(obj.series ?? obj.title ?? obj.name ?? '');
  }
  let s = String(value).trim();
  if (s.startsWith('{') && s.includes('series')) {
    try {
      const inner = JSON.parse(s);
      s = String(inner.series ?? inner.title ?? s).trim();
    } catch {
      const m = s.match(/"series"\s*:\s*"((?:\\.|[^"\\])*)"/);
      if (m?.[1]) s = m[1].replace(/\\"/g, '"');
    }
  }
  return s;
}

function normalizeIssue(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || /^[-—–.?]+$/i.test(raw)) return '';
  if (/^(n\/?a|unknown|none|null|κενό|άγνωστο|δ\/υ)$/i.test(raw)) return '';

  const cleaned = raw.replace(/^#\s*/, '').trim();
  if (/^\d{1,4}[A-Za-z]?$/i.test(cleaned)) {
    return cleaned.replace(/[^\d]/g, '') || cleaned;
  }
  const labeled = raw.match(
    /(?:τεύχος|teuxos|issue|no\.?|number|#)\s*[:=]?\s*(\d{1,4}[A-Za-z]?)/i,
  );
  if (labeled?.[1]) return labeled[1].replace(/[^\dA-Za-z]/g, '');

  const nums = [...raw.matchAll(/\b(\d{1,4})\b/g)].map((m) => m[1]);
  for (const n of nums) {
    const v = Number(n);
    if (v >= 1 && v <= 9999 && !(v >= 1930 && v <= 2100)) return n;
  }
  if (/^\d{1,4}$/.test(cleaned)) return cleaned;
  return '';
}

function normalizeYear(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const y = Math.trunc(value);
    const maxYear = new Date().getFullYear() + 1;
    if (y >= 1930 && y <= maxYear) return String(y);
    return '';
  }
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = raw.match(/(?:19|20)\d{2}/);
  if (!match) return '';
  const y = Number(match[0]);
  const maxYear = new Date().getFullYear() + 1;
  if (y < 1930 || y > maxYear) return '';
  return match[0];
}

function normalizeCategory(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.toLowerCase() === lower) return c;
  }
  if (/super|ήρω|hero|marvel|dc|batman|jla|avenger|ghost\s*rider|spider|x-?men/i.test(raw)) {
    return 'Super ήρωες';
  }
  if (/humor|χιούμορ|κωμικ/i.test(raw)) return 'Χιούμορ';
  if (/manga|μανγκα/i.test(raw)) return 'Manga';
  if (/horror|τρόμο/i.test(raw)) return 'Horror';
  if (/sci.?fi|επιστημον/i.test(raw)) return 'Sci-Fi';
  if (/φαντασ|fantasy/i.test(raw)) return 'Φαντασία';
  if (/indie|ανεξάρ/i.test(raw)) return 'Indie';
  return raw.length > 40 ? 'Άλλο' : raw;
}

function inferCategory(series: string, publisher: string, category: string): string {
  if (category.trim()) return normalizeCategory(category);
  const blob = `${series} ${publisher}`;
  if (
    /ghost\s*rider|batman|spider|x-?men|avenger|justice|jla|wolverine|hulk|daredevil|punisher|flash|superman|wonder\s*woman|marvel|dc\b/i.test(
      blob,
    )
  ) {
    return 'Super ήρωες';
  }
  return '';
}

function mapConfidence(value: unknown): 'high' | 'medium' | 'low' {
  const v = String(value ?? '').toLowerCase();
  if (v === 'high' || v === 'υψηλή') return 'high';
  if (v === 'medium' || v === 'μεσαία' || v === 'med') return 'medium';
  return 'low';
}

function polishGreekRecognition(result: ComicRecognitionResult): ComicRecognitionResult {
  let series = result.series.trim();
  const notes = (result.notes ?? '').trim();
  let issue = result.issue;

  // If Gemini put only the franchise in series but notes/album carry the cover subtitle, promote it.
  const albumFromNotes =
    notes.match(/(Λούκυ\s*Κιντ\s*:\s*[^·\n.]+)/i)?.[1]?.trim() ||
    notes.match(/([Α-Ωά-ώA-Za-z][^·\n]{4,60}:\s*[^·\n.]{3,60})/)?.[1]?.trim();

  const seriesIsFranchiseOnly =
    /^(οι\s+περιπέτειες\s+του\s+)?λούκυ\s*λουκ(\s*\([^)]*\))?$/i.test(series) ||
    /^(asterix|αστερίξ|tintin|τεντέν)$/i.test(series);

  if (albumFromNotes && seriesIsFranchiseOnly && !/:/.test(series)) {
    series = albumFromNotes;
  }

  // Album-style Greek titles (subtitle on cover) usually aren't Mamouth continuous issues.
  if (/Κιντ|Kid\s*Lucky/i.test(`${series} ${notes}`) || (/:/.test(series) && seriesIsFranchiseOnly === false)) {
    if (/:/.test(series) || /Κιντ|Kid\s*Lucky/i.test(series)) {
      issue = '';
    }
  }

  return { ...result, series, issue };
}

function enrichRecognition(
  result: ComicRecognitionResult,
  market?: 'greek' | 'foreign' | 'auto',
): ComicRecognitionResult {
  let next = result;
  if (market === 'greek' || result.language === 'el') {
    next = polishGreekRecognition(result);
  }
  const category = inferCategory(next.series, next.publisher, next.category);
  const format =
    normalizeGreekFormat(next.format) ??
    inferGreekFormatFromScan({
      series: next.series,
      issue: next.issue,
      volume: next.volume,
      notes: next.notes,
      format: next.format,
    });
  const resolvedIssue = resolveGreekIssueNumber({
    issue: next.issue,
    volume: next.volume,
    format,
    notes: next.notes,
  });
  if (resolvedIssue && !next.issue?.trim()) {
    next = { ...next, issue: resolvedIssue };
  }
  let confidence = next.confidence;
  const filled =
    Number(Boolean(next.series)) +
    Number(Boolean(next.issue || resolvedIssue)) +
    Number(Boolean(next.publisher)) +
    Number(Boolean(next.year));
  if (filled >= 3 && confidence === 'low') confidence = 'medium';
  if (filled >= 3 && next.series && (next.issue || next.year) && next.publisher) {
    confidence = 'high';
  } else if (filled >= 2 && confidence === 'low') {
    confidence = 'medium';
  }
  return { ...next, category, format, confidence };
}

export function parseGeminiJson(
  raw: string,
  market?: 'greek' | 'foreign' | 'auto',
): ComicRecognitionResult {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  const attempts: string[] = [];

  if (cleaned) attempts.push(cleaned);

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    attempts.push(cleaned.slice(start, end + 1));
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as Record<string, unknown>;
      const obj =
        parsed.series != null || parsed.issue != null || parsed.publisher != null
          ? parsed
          : ((parsed.result ?? parsed.data ?? parsed.comic ?? parsed) as Record<string, unknown>);

      const series = unwrapSeries(obj.series ?? obj.title);
      if (!series || series.startsWith('{')) continue;

      return enrichRecognition({
        series,
        issue: normalizeIssue(obj.issue ?? obj.number ?? obj.issue_number),
        publisher: String(obj.publisher ?? obj.pub ?? '').trim(),
        year: normalizeYear(obj.year ?? obj.publication_year ?? obj.cover_date),
        category: normalizeCategory(obj.category ?? obj.genre),
        volume: normalizeIssue(obj.volume ?? obj.vol) || undefined,
        month: String(obj.month ?? '').trim() || undefined,
        notes: String(obj.notes ?? obj.storyline ?? '').trim() || undefined,
        format: normalizeGreekFormat(String(obj.format ?? obj.release_format ?? obj.type ?? '')),
        confidence: mapConfidence(obj.confidence),
        language:
          obj.language != null
            ? String(obj.language)
            : market === 'greek'
              ? 'el'
              : market === 'foreign'
                ? 'en'
                : undefined,
        raw,
      }, market);
    } catch {
      // try next
    }
  }

  const seriesMatch = raw.match(/"series"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const issueMatch = raw.match(/"issue"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const publisherMatch = raw.match(/"publisher"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const yearMatch = raw.match(/"year"\s*:\s*"?((?:\\.|[^"\\])*?)"?/);
  const catMatch = raw.match(/"category"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const confMatch = raw.match(/"confidence"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const langMatch = raw.match(/"language"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const volMatch = raw.match(/"volume"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const notesMatch = raw.match(/"notes"\s*:\s*"((?:\\.|[^"\\])*)"/);

  if (seriesMatch?.[1]) {
    return enrichRecognition({
      series: seriesMatch[1].replace(/\\"/g, '"'),
      issue: normalizeIssue(issueMatch?.[1]),
      publisher: (publisherMatch?.[1] ?? '').replace(/\\"/g, '"'),
      year: normalizeYear(yearMatch?.[1]),
      category: normalizeCategory(catMatch?.[1]),
      volume: normalizeIssue(volMatch?.[1]) || undefined,
      notes: notesMatch?.[1]?.replace(/\\"/g, '"') || undefined,
      confidence: mapConfidence(confMatch?.[1]),
      language: langMatch?.[1] ?? (market === 'greek' ? 'el' : 'en'),
      raw,
    }, market);
  }

  return {
    series: '',
    issue: '',
    publisher: '',
    year: '',
    category: '',
    confidence: 'low',
    language: market === 'greek' ? 'el' : 'en',
    raw,
  };
}

async function callGeminiModel(
  model: string,
  key: string,
  data: string,
  mimeType: string,
  market: 'greek' | 'foreign' | 'auto',
): Promise<ComicRecognitionResult> {
  const prompt = market === 'greek' ? PROMPT_COVER_GREEK : PROMPT_COVER;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data } },
          ],
        },
      ],
      generationConfig: {
        temperature: market === 'greek' ? 0.15 : 0.2,
        maxOutputTokens: 1536,
        response_mime_type: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    let msg = `Gemini ${response.status}`;
    try {
      msg += ': ' + (JSON.parse(err)?.error?.message ?? err.slice(0, 160));
    } catch {
      msg += ': ' + err.slice(0, 160);
    }
    throw new Error(msg);
  }

  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts;
  const raw: string = Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p?.text ?? '').join('')
    : '';
  if (!raw.trim()) {
    throw new Error('Το Gemini δεν επέστρεψε αποτέλεσμα.');
  }
  return parseGeminiJson(raw, market);
}

export async function recognizeComicCover(
  photoUri: string,
  opts?: { market?: 'greek' | 'foreign' | 'auto' },
): Promise<ComicRecognitionResult> {
  const key = env.geminiKey;
  if (!key) throw new Error('Gemini API key δεν είναι ρυθμισμένο.');

  const { data, mimeType } = await resizeImageForGemini(photoUri);
  const market = opts?.market ?? 'auto';

  try {
    return await callGeminiModel(GEMINI_MODEL, key, data, mimeType, market);
  } catch (primaryError) {
    const msg = primaryError instanceof Error ? primaryError.message : String(primaryError);
    if (!/\b404\b|not found|not supported/i.test(msg)) throw primaryError;
    for (const model of GEMINI_FALLBACKS) {
      try {
        return await callGeminiModel(model, key, data, mimeType, market);
      } catch {
        // try next missing-model fallback only
      }
    }
    throw primaryError;
  }
}
