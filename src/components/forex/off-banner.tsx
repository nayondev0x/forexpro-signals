"use client";

import { Power, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OffBannerProps {
  onActivate: () => void;
}

export function OffBanner({ onActivate }: OffBannerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80 border border-zinc-700/50">
        <Power className="h-8 w-8 text-zinc-500" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-400">
        Trading Mode is OFF
      </h2>
      <p className="text-sm text-zinc-500 text-center max-w-md">
        Zero API calls. Free tier is not being used.
        <br />
        Turn on{" "}
        <span className="text-emerald-500 font-semibold">LIVE</span> when
        you&apos;re ready to trade.
      </p>
      <Button
        onClick={onActivate}
        className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
      >
        <Radio className="size-4" />
        Start Trading
      </Button>
    </div>
  );
}