import type { QuestionPack } from "@/features/content";
import { TIERS, blankRound, fieldId, removeAt, replaceAt } from "./pack-draft";

type Scoring = QuestionPack["scoring"];

export function PackScoring({
  scoring,
  fieldErrors,
  onChange,
}: {
  scoring: Scoring;
  fieldErrors: ReadonlyMap<string, string>;
  onChange: (scoring: Scoring) => void;
}) {
  return (
    <details id="ed-scoring" className="ed-card ed-scoring">
      <summary id="ed-scoring-heading">Scoring</summary>
      <div className="ed-scoring__body">
        <p className="muted">
          Points per difficulty tier. The default scores round 1. Round 2 uses the next scoring
          round or doubles the default.
        </p>
        <div className="ed-table-wrap">
          <table className="ed-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Default</th>
                {TIERS.map((tier) => (
                  <th key={tier} scope="col">
                    Tier {tier}
                  </th>
                ))}
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {scoring.rounds.map((round, index) => {
                const path = `scoring.rounds[${index}]`;
                const name = round.title || `Round ${index + 1}`;
                return (
                  <tr key={round.id}>
                    <td>
                      <input
                        id={fieldId(`${path}.title`)}
                        className="input"
                        aria-label={`Scoring round ${index + 1} name`}
                        aria-invalid={fieldErrors.has(`${path}.title`) || undefined}
                        value={round.title}
                        onChange={(event) =>
                          onChange({
                            ...scoring,
                            rounds: replaceAt(scoring.rounds, index, {
                              ...round,
                              title: event.target.value,
                            }),
                          })
                        }
                      />
                    </td>
                    <td className="ed-center">
                      <input
                        type="radio"
                        name="default-round"
                        aria-label={`Use ${name} as the default`}
                        checked={scoring.defaultRoundId === round.id}
                        onChange={() => onChange({ ...scoring, defaultRoundId: round.id })}
                      />
                    </td>
                    {TIERS.map((tier) => {
                      const pointsPath = `${path}.pointsByTier.${tier}`;
                      return (
                        <td key={tier}>
                          <input
                            id={fieldId(pointsPath)}
                            className="input num ed-points"
                            inputMode="numeric"
                            aria-label={`${name}, tier ${tier} points`}
                            aria-invalid={fieldErrors.has(pointsPath) || undefined}
                            value={String(round.pointsByTier[tier] ?? "")}
                            onChange={(event) => {
                              const points = Number(event.target.value.replace(/[^0-9]/g, ""));
                              onChange({
                                ...scoring,
                                rounds: replaceAt(scoring.rounds, index, {
                                  ...round,
                                  pointsByTier: { ...round.pointsByTier, [tier]: points },
                                }),
                              });
                            }}
                          />
                        </td>
                      );
                    })}
                    <td>
                      <button
                        type="button"
                        className="btn btn--small btn--quiet"
                        disabled={scoring.rounds.length <= 1}
                        aria-label={`Remove scoring round ${round.title || index + 1}`}
                        onClick={() => {
                          const rounds = removeAt(scoring.rounds, index);
                          onChange({
                            ...scoring,
                            rounds,
                            defaultRoundId:
                              scoring.defaultRoundId === round.id
                                ? rounds[0].id
                                : scoring.defaultRoundId,
                          });
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <button
            type="button"
            className="btn btn--small"
            disabled={scoring.rounds.length >= 4}
            onClick={() =>
              onChange({
                ...scoring,
                rounds: [...scoring.rounds, blankRound(`Round ${scoring.rounds.length + 1}`, 2)],
              })
            }
          >
            Add scoring round
          </button>
        </div>
      </div>
    </details>
  );
}
