"use client";

// ═══ TRADING ALERT SOUNDS ═══

/** New signal generated — prominent 2-tone alert */
export function playSignalSound() {
  try {
    const ctx = new AudioContext();

    // First tone — higher "ding"
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.value = 880;
    gain1.gain.setValueAtTime(0.4, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Second tone — higher "ding" after 200ms gap
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = 1100;
    gain2.gain.setValueAtTime(0.4, ctx.currentTime + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.25);
    osc2.stop(ctx.currentTime + 0.6);

    // Third tone — final high pitch
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.value = 1320;
    gain3.gain.setValueAtTime(0.3, ctx.currentTime + 0.55);
    gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(ctx.currentTime + 0.55);
    osc3.stop(ctx.currentTime + 0.9);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1500);
  } catch {
    // Silently fail if AudioContext is not available
  }
}

/** TP Hit — victory sound (ascending tones) */
export function playTPSound() {
  try {
    const ctx = new AudioContext();
    const freqs = [660, 880, 1100, 1320];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch {}
}

/** SL Hit / Expired — warning sound (descending tone) */
export function playSLSound() {
  try {
    const ctx = new AudioContext();
    const freqs = [880, 660, 440];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.2;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch {}
}

/** Browser push notification */
export async function sendBrowserNotification(
  title: string,
  body: string
): Promise<void> {
  if (typeof Notification === "undefined") return;

  try {
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }

    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: "forex-signal",
        requireInteraction: false,
      });
    }
  } catch {}
}