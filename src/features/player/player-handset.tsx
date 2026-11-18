import type { ReactNode } from "react";
import type { ConnectionStatus } from "@/features/network/connection";
import { Lockup } from "@/features/ui/brand";
import { ConnectionPill } from "@/features/ui/connection-status";

export function PlayerHandset({
  children,
  className = "pl--notice",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="pl-surround">
      <div className={`pl ${className}`}>{children}</div>
    </div>
  );
}

export function PlayerHeader({
  code,
  status,
  homeLink = true,
}: {
  code: string;
  status?: ConnectionStatus;
  homeLink?: boolean;
}) {
  return (
    <header className="pl-top">
      <Lockup href={homeLink ? "/" : undefined} />
      <div className="pl-top__status">
        <span className="room-code" aria-label={`Room ${code.split("").join(" ")}`}>
          {code}
        </span>
        {status ? <ConnectionPill status={status} /> : null}
      </div>
    </header>
  );
}
