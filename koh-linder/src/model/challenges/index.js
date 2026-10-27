import { SwimRace } from "./SwimRace";
import { FireCourse } from "./FireCourse";
import { TeamDraft } from "./TeamDraft";
import { CampLife } from "../camplife/CampLife";
import { TorchRelay } from "./TorchRelay";
import { ElasticRace } from "./ElasticRace";
import { DiveRelay } from "./DiveRelay";
import { WeightRelay } from "./WeightRelay";
import { PotteryRelay } from "./PotteryRelay";
import { SpoolRace } from "./SpoolRace";
import { SlingRelay } from "./SlingRelay";
import { DivingBoard } from "./DivingBoard";
import { WaterPuzzle } from "./WaterPuzzle";
import { Council } from "../camplife/Council";

/**
 * Registre des épreuves : identifiant (propriété `target` des effets CHALLENGE_*) -> classe.
 * Pour ajouter une épreuve : créer sa classe dans ce dossier (extends Challenge) et l'ajouter ici.
 */
const CHALLENGES = {
    [SwimRace.ID]: SwimRace,
    [FireCourse.ID]: FireCourse,
    [TeamDraft.ID]: TeamDraft,
    [CampLife.ID]: CampLife,
    [TorchRelay.ID]: TorchRelay,
    [ElasticRace.ID]: ElasticRace,
    [DiveRelay.ID]: DiveRelay,
    [WeightRelay.ID]: WeightRelay,
    [PotteryRelay.ID]: PotteryRelay,
    [SpoolRace.ID]: SpoolRace,
    [SlingRelay.ID]: SlingRelay,
    [DivingBoard.ID]: DivingBoard,
    [WaterPuzzle.ID]: WaterPuzzle,
    [Council.ID]: Council,
};

function createChallenge(id, params) {
    const ChallengeClass = CHALLENGES[id];
    if (!ChallengeClass) {
        throw new Error("Épreuve inconnue : " + id);
    }
    return new ChallengeClass(params);
}

export { createChallenge, CHALLENGES }
