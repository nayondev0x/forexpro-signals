"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import { SESSIONS, getActiveSessions, isSessionActive, type SessionInfo } from "@/lib/forex-helpers";

export function SessionBar() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const active = getActiveSessions();
  const utcH = new Date().getUTCHours();
  const utcM = new Date().getUTCMinutes();

  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-border/20 bg-card/40 overflow-x-auto">
      <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      {SESSIONS.map((s) => {
        const isActive = active.some((a) => a.name === s.name);
        return (
          <Badge
            key={s.name}
            variant="outline"
            className={`text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${
              isActive
                ? `${s.bg} ${s.border} ${s.color}`
                : "border-border/20 text-muted-foreground/40"
            }`}
          >
            <span className="mr-1">{s.flag}</span>
            {s.name}
            {isActive && (
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            )}
          </Badge>
        );
      })}
      <span className="ml-auto text-[10px] text-muted-foreground/50 flex-shrink-0">
        UTC {String(utcH).padStart(2, "0")}:{String(utcM).padStart(2, "0")}
      </span>
    </div>
  );
}