import Link from "next/link";
import { HamWordmark } from "./ham-wordmark";

/** "HAM Quiz": the traced HAM wordmark plus "Quiz" in the display face. */
export function Lockup({ href, className = "" }: { href?: string; className?: string }) {
  const content = (
    <>
      <HamWordmark className="lockup__ham" />
      <span className="lockup__quiz">Quiz</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`lockup ${className}`}>
        {content}
      </Link>
    );
  }
  return <span className={`lockup ${className}`}>{content}</span>;
}

/**
 * The wager-clue brand: "Hot HAM!". "HAM" is always the wordmark graphic,
 * never typeset, so the phrase reads "Hot [wordmark]!".
 */
export function HotHam({ className = "" }: { className?: string }) {
  return (
    <span className={`hot-ham ${className}`}>
      <span className="hot-ham__word">Hot</span>
      <HamWordmark className="hot-ham__ham" />
      <span className="hot-ham__word" aria-hidden="true">
        !
      </span>
    </span>
  );
}

/** Small "Dev sign-in fixture" stamp shown whenever auth is not live HAM. */
export function FixtureStamp() {
  return <span className="stamp stamp--dashed">Dev sign-in fixture · not live HAM</span>;
}
