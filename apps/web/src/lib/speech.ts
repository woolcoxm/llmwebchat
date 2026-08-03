/**
 * Voice: dictation via the Web Speech API (SpeechRecognition) and TTS via
 * SpeechSynthesis. Both are built into Chromium browsers — no dependencies.
 * Gracefully no-ops where unsupported.
 */

export function recognitionSupported(): boolean {
  return typeof window !== "undefined" && !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export interface Dictation {
  stop: () => void;
}

/** Start continuous dictation; onFinal(text) fires per finalized utterance. */
export function startDictation(
  onFinal: (text: string) => void,
  onError?: (e: string) => void,
): Dictation | null {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) {
    onError?.("Speech recognition not supported in this browser");
    return null;
  }
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = navigator.language || "en-US";
  rec.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) onFinal(event.results[i][0].transcript);
    }
  };
  rec.onerror = (e: any) => onError?.(e.error || "speech error");
  rec.start();
  return { stop: () => { try { rec.stop(); } catch { /* noop */ } } };
}

/** Strip markdown to plain-ish text before speaking. */
function toSpeakable(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}

export function speak(text: string) {
  if (!ttsSupported()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(toSpeakable(text));
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
