import { shuffle } from "../CandidateGenerator";
import { TeamRace } from "./TeamRace";

/**
 * Base des épreuves d'équipe en relais de nageurs / plongeurs (plongée, poids immergés). Règles communes du relais :
 * - Les candidats passent les uns après les autres ; un même candidat ne peut pas passer deux fois de suite.
 * - Chaque candidat doit passer au moins une fois. Au premier passage, l'ordre est la SWI croissante (les premières tâches sont
 *   les plus faciles).
 * - Quand tous sont passés mais que l'épreuve continue, n'importe qui peut passer (toujours pas deux fois de suite) : un non-joueur
 *   envoie le meilleur nageur disponible ; le joueur (s'il est autorisé) passe lui-même au swipe gauche, ou envoie le meilleur à droite.
 */
class RelayRace extends TeamRace {
    constructor(id, params, length, steps) {
        super(id, params, length, steps);
        this.order = {};   // couleur -> membres triés par SWI croissante (premier passage)
        this.dived = {};   // couleur -> noms de ceux qui sont déjà passés
        this.last = {};    // couleur -> nom du dernier à être passé
    }
    /** Prépare l'ordre de passage de chaque équipe (à appeler après initTeams). */
    initRelay() {
        this.colors.forEach((color) => {
            // Égalités tirées au hasard, puis tri stable par SWI croissante
            this.order[color] = shuffle(this.members[color]).sort((a, b) => a.attributes.SWI - b.attributes.SWI);
            this.dived[color] = [];
            this.last[color] = null;
        });
    }
    /** Prochain du premier passage (celui qui n'est jamais passé, du moins bon au meilleur nageur), ou null s'il ne reste que le tour libre. */
    nextInOrder(color) {
        return this.order[color].find((m) => !this.dived[color].includes(m.name)) || null;
    }
    /** Candidats autorisés au tour libre : tous sauf le dernier passé. */
    freeDivers(color) {
        return this.members[color].filter((m) => m.name != this.last[color]);
    }
    /** Candidat de ce passage (voir les règles du relais ci-dessus). */
    chooseDiver(color, side) {
        const next = this.nextInOrder(color);
        if (next) {
            return next;
        }
        const free = this.freeDivers(color);
        const player = free.find((m) => m.isPlayer);
        if (player && side == "left") {
            return player;
        }
        return shuffle(free).sort((a, b) => b.attributes.SWI - a.attributes.SWI)[0];
    }
    /** Note le passage de `diver`. */
    markDived(color, diver) {
        this.dived[color].push(diver.name);
        this.last[color] = diver.name;
    }
}

export { RelayRace }
