"use client";

export function playSignalSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 800;

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);
  } catch {
    // Silently fail if AudioContext is not available
  }
}

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
        silent: true,
      });
    }
  } catch {
    // Silently fail if notifications are not supported
  }
}