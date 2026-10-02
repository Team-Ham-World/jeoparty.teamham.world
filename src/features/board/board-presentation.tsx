import type { ProposedDisplayView } from "./presentation-types";
import styles from "./board.module.css";

const formatNumber = (value: number) => value.toLocaleString("en-US");
function phaseLabel(view: ProposedDisplayView) {
  switch (view.phase) {
    case "board": return "Board · waiting for the host";
    case "reading": return "Reading · buzzers closed";
    case "open": return "Buzzers open";
    case "answering": return `${view.answeringPlayer} is answering · buzzers closed`;
    case "reveal": return "Answer revealed · buzzers closed";
    case "results": return "Final results";
  }
}

/** Read-only rendering of PROPOSED public inputs; no fixture/private imports. */
export function BoardPresentation({ view }: { view: ProposedDisplayView }) {
  const status = phaseLabel(view);
  const warning = view.connection === "offline"
    ? "Offline — showing the last supplied view. Updates are unavailable."
    : view.connection === "stale"
      ? "Stale view — this information may be out of date. Wait for a fresh update."
      : null;
  return (
    <section className={styles.presentation} aria-label="Team Ham presentation">
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Team Ham / JeoParty</p><h1>Quiz night</h1></div>
        <p className={styles.displayLabel}>Shared display <span>Local example</span></p>
      </header>
      <div role="status" aria-live="polite" aria-atomic="true" className={styles.status}>
        {warning ? <><strong className={styles.warning}>{warning}</strong><span>Last supplied status: {status}</span></> : <span>{status}</span>}
      </div>
      {view.phase === "board" ? (
        <section aria-label="Clue board" className={styles.board}>
          {view.categories.map((category) => (
            <section key={category.id} className={styles.category} aria-label={category.name}>
              <h2>{category.name}</h2>
              <ul>{category.clues.map((tile) => (
                <li key={tile.id} className={tile.availability === "completed" ? styles.completed : styles.tile}>
                  <span className={styles.value}>{formatNumber(tile.value)}</span>
                  <span className={styles.tileStatus}>{tile.availability === "completed" ? "Completed" : "Available"}</span>
                </li>
              ))}</ul>
            </section>
          ))}
        </section>
      ) : view.phase === "results" ? (
        <section className={styles.results} aria-labelledby="results-heading">
          <p className={styles.eyebrow}>That’s a wrap</p>
          <h2 id="results-heading">Final results</h2>
          <p className={styles.winnerLabel}>{view.winners.length > 1 ? "Tied winners" : "Winner"}</p>
          <ul className={styles.winners}>{view.winners.map((winner) => <li key={winner.id}>{winner.name}</li>)}</ul>
          <p>Thanks for playing, Team Ham.</p>
        </section>
      ) : (
        <section className={styles.clue} aria-labelledby="clue-heading">
          <h2 id="clue-heading" className={styles.clueHeading}><span>{view.clue.category}</span><span>{formatNumber(view.clue.value)} points</span></h2>
          <p className={styles.prompt}>{view.clue.prompt}</p>
          {view.phase === "reveal" && <div className={styles.answer}><h3>Revealed answer</h3><p>{view.answer}</p></div>}
          {view.phase === "open" && <p className={styles.cue}>{warning ? "Last supplied view: buzzers open" : "Buzz in on your phone"}</p>}
          {view.phase === "reading" && <p className={styles.cue}>Listen to the clue. Buzzers are closed.</p>}
          {view.phase === "answering" && <p className={styles.cue}>Answering <strong>{view.answeringPlayer}</strong></p>}
        </section>
      )}
      <section className={styles.scores} aria-labelledby="scores-heading">
        <h2 id="scores-heading">{view.phase === "results" ? "Final scores" : "Public scores"}</h2>
        <ul>{view.scores.map((player) => (
          <li key={player.id}><span>{player.name}</span><strong>{formatNumber(player.score)}<small> points</small></strong></li>
        ))}</ul>
      </section>
    </section>
  );
}
