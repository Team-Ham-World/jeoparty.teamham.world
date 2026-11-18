import type { ReactNode } from "react";

export function StudioHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
}) {
  return (
    <header className="studio-hero">
      <div className="studio-hero__copy">
        <p className="studio-hero__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="studio-hero__description">{description}</p>
      </div>
      <div className="studio-tv" aria-hidden="true">
        <span className="studio-tv__orbit" />
        <span className="studio-tv__spark" />
        <span className="studio-tv__spark studio-tv__spark--small" />
        <div className="studio-tv__receiver">
          <div className="studio-tv__glass">
            <b>HAM</b>
            <b>QUIZ</b>
          </div>
          <div className="studio-tv__tuner">
            <span className="studio-tv__dial" />
            <span className="studio-tv__dial" />
            <span className="studio-tv__vents" />
          </div>
        </div>
      </div>
    </header>
  );
}

export function PackCover({ variant = "record" }: { variant?: "record" | "snack" }) {
  return <span className={`pack-cover pack-cover--${variant}`} aria-hidden="true" />;
}
