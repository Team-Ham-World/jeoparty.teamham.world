"use client";

import { useState } from "react";
import Link from "next/link";
import { BoardPresentation } from "./board-presentation";
import { previewFixtures } from "./preview-fixtures";
import styles from "./board.module.css";

export function BoardStarter() {
  const [selectedId, setSelectedId] = useState<string>("board");
  const selected = previewFixtures.find((fixture) => fixture.id === selectedId) ?? previewFixtures[0];
  return (
    <main id="main-content" className={styles.page}>
      <aside className={styles.preview} aria-label="Local preview controls">
        <div><strong>Local presentation preview</strong><p>Example views only. No live game is connected.</p></div>
        <div className={styles.chooser}>
          <label htmlFor="preview-view">Preview example</label>
          <select id="preview-view" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {previewFixtures.map((fixture) => <option key={fixture.id} value={fixture.id}>{fixture.label}</option>)}
          </select>
        </div>
        <Link href="/">Back home <span aria-hidden="true">↗</span></Link>
      </aside>
      <BoardPresentation view={selected.view} />
      <footer className={styles.footer}>Read-only presentation · Changing the example does not play a game.</footer>
    </main>
  );
}
