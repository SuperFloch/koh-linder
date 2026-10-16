import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { TeamCssColor } from "../Team";
import { RelayRace } from "./RelayRace";

const DEFAULT_PARAMS = {
    weights: [1, 2, 3, 4],  // case (distance du départ) de chacun des poids immergés
    easyThreshold: 6,       // test de SWI facile : nager à la surface (d20 + SWI)
    hardThreshold: 14,      // test de SWI difficile : faire avancer un poids en apnée
    weightRep: 1,           // REP gagnée à chaque déplacement réussi d'un poids d'une case (aucun bonus pour le dernier poids)
    heroRep: 0,             // pas de bonus de victoire pour celui qui ramène le dernier poids
    failRep: 1              // REP perdue par un candidat qui ne parvient pas à bouger le poids
};

/**
 * Épreuve « Les poids immergés » (par équipe). Chaque équipe a 4 poids coulés au fond de l'eau à des distances croissantes de la case
 * de départ. En relais (règles du relais : voir RelayRace — comme la plongée), les candidats vont tour à tour essayer de les ramener
 * au départ, en apnée. La première équipe qui ramène ses 4 poids gagne.
 *
 * 5 cases d'eau : la case 0 est le départ, là où les poids doivent être ramenés ; les cases 1 à 4 contiennent chacune un poids.
 * - Le candidat nage à la surface vers le poids restant le plus proche : test de SWI FACILE par case (échec : il n'avance pas et
 *   retente ; réussite : une case de plus).
 * - Arrivé sur la case d'un poids, il passe EN APNÉE. Pour ramener le poids d'une case vers le départ, il fait un test de SWI
 *   DIFFICILE. Réussite : le candidat et le poids avancent d'une case vers le départ, et il peut retenter pour avancer encore.
 *   Échec : il ne parvient pas à bouger le poids, remonte à la surface et retourne au départ passer le relais (tests de SWI
 *   faciles pour traverser chaque case). Le poids garde sa position pour le candidat suivant.
 * - Dès qu'un candidat atteint la case départ, avec ou sans poids, il passe le relais.
 *
 * Un swipe = une phase : nager jusqu'au poids (tous les tests faciles de l'aller en une fois), puis un test difficile à la fois
 * (chaque échec ramène aussitôt le candidat au départ).
 *
 * Minimap : un marqueur par équipe sur la case du nageur ; le marqueur est grisé et teinté de bleu foncé pendant l'apnée.
 */
class WeightRelay extends RelayRace {
    static get ID() {
        return "SUNKEN_WEIGHTS";
    }
    constructor(params) {
        const merged = { ...DEFAULT_PARAMS, ...(params || {}) };
        super(WeightRelay.ID, merged, Math.max(...merged.weights));
        // couleur -> { phase: "READY" | "APNEA", diver, weights: [case de chaque poids, 0 = ramené], index: poids tiré en apnée, retrieved }
        this.state = {};
    }

    start(game) {
        this.initTeams(game);
        this.initRelay();
        this.colors.forEach((color) => {
            this.state[color] = { phase: "READY", diver: null, weights: [...this.params.weights], index: -1, retrieved: 0 };
        });
        game.vars.raceLog = "";
        this.refresh(game);
    }
    cellLabel(index) {
        return index == 0 ? "\u{1F3C1}" : String(index);
    }
    /** Poids de toutes les équipes sur la case `index`, sous forme de boules de la couleur de l'équipe (0 = poids ramenés). */
    ballsAt(index) {
        const balls = [];
        this.colors.forEach((color) => {
            (this.state[color] ? this.state[color].weights : []).forEach((w, i) => {
                if (w == index) {
                    balls.push({ key: color + i, bg: TeamCssColor[color] || null, mine: color == this.playerColor });
                }
            });
        });
        return balls;
    }
    /** Marqueurs d'équipe ; ceux dont le nageur est en apnée sont signalés (grisés et teintés de bleu foncé). */
    markersAt(index) {
        return super.markersAt(index).map((m) => ({
            ...m,
            apnea: !!this.state[m.key] && this.state[m.key].phase == "APNEA",
            title: m.title + (this.state[m.key] && this.state[m.key].phase == "APNEA" ? " (en apnée)" : "")
        }));
    }
    /** Case du poids restant le plus proche du départ (0 s'ils sont tous ramenés). */
    nearestWeight(color) {
        const left = this.state[color].weights.filter((w) => w > 0);
        return left.length ? Math.min(...left) : 0;
    }
    /** Test de SWI facile répété jusqu'à la réussite (un échec ne fait pas avancer). @returns {number} nombre d'essais */
    easySwim(diver) {
        var tries = 0;
        do {
            tries++;
        } while (diver.rollStat("SWI").total < this.params.easyThreshold && tries < 30);
        return tries;
    }

    actTeam(game, color, side) {
        const p = this.params;
        const st = this.state[color];
        const who = this.teamLabel(color);
        const mine = color == this.playerColor;
        const tag = mine ? "" : " (" + who + ")";

        if (st.phase == "READY") {
            // Le candidat suivant nage à la surface vers le poids restant le plus proche
            const diver = this.chooseDiver(color, mine ? side : null);
            this.markDived(color, diver);
            const target = this.nearestWeight(color);
            var tries = 0;
            for (var i = 1; i <= target; i++) {
                tries += this.easySwim(diver);
            }
            st.diver = diver;
            st.index = st.weights.findIndex((w) => w == target);
            st.phase = "APNEA";
            this.positions[color] = target;
            const name = diver.isPlayer ? "Vous nagez" : diver.name + " nage";
            return name + " jusqu'à la case " + target + " (" + tries + " essai" + (tries > 1 ? "s" : "") + " de SWI facile) et passe en apnée devant le poids." + tag;
        }

        // En apnée : test de SWI difficile pour ramener le poids d'une case vers le départ
        const diver = st.diver;
        const name = diver.isPlayer ? "Vous" : diver.name;
        const roll = diver.rollStat("SWI");
        const detail = "(" + this.rollToString("SWI", roll, p.hardThreshold) + ")";
        if (roll.total >= p.hardThreshold) {
            st.weights[st.index]--;
            this.positions[color] = st.weights[st.index];
            // Déplacer un poids d'une case : +1 REP auprès des coéquipiers
            game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: diver.name, value: p.weightRep });
            if (st.weights[st.index] > 0) {
                return name + " tire le poids en apnée " + detail + " : il avance d'une case, le poids est maintenant case " + st.weights[st.index] + "." + tag;
            }
            // Poids ramené au départ : le relais passe au suivant
            st.retrieved++;
            st.phase = "READY";
            st.diver = null;
            if (st.retrieved >= p.weights.length) {
                this.finishRace(game, color, diver, diver.name + " ramène le dernier poids", "l'épreuve des poids immergés");
                return name + " ramène le dernier poids au départ " + detail + " !";
            }
            return name + " ramène le poids au départ " + detail + " (" + st.retrieved + "/" + p.weights.length + "), puis passe le relais." + tag;
        }
        // Échec : il ne parvient pas à bouger le poids, remonte et retourne au départ (tests faciles à chaque case)
        var back = 0;
        for (var c = this.positions[color]; c > 0; c--) {
            back += this.easySwim(diver);
        }
        st.phase = "READY";
        st.diver = null;
        this.positions[color] = 0;
        game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: diver.name, value: -p.failRep });
        return name + " n'arrive pas à bouger le poids " + detail + " : il remonte, regagne le départ (" + back + " essai" + (back > 1 ? "s" : "") + " de SWI facile) et passe le relais." + tag;
    }

    refresh(game) {
        const color = this.playerColor;
        const st = this.state[color];
        const rival = this.colors.find((c) => c != color);
        const p = this.params;
        var text;
        var left;
        var right;
        if (st.phase == "APNEA") {
            const mine = st.diver.isPlayer;
            text = (mine ? "Vous êtes" : st.diver.name + " est") + " en apnée case " + this.positions[color] + " avec le poids : nouveau test de SWI difficile (d20 + SWI ≥ " + p.hardThreshold + ") pour le ramener d'une case.";
            left = right = mine ? "Tirer le poids (SWI difficile)" : "Encourager " + st.diver.name;
        } else {
            const next = this.nextInOrder(color);
            const target = this.nearestWeight(color);
            text = "Prochain poids : case " + target + ". ";
            if (next) {
                text += "Prochain nageur : " + (next.isPlayer ? "vous" : next.name) + ".";
                left = right = next.isPlayer ? "Nager jusqu'au poids" : "Encourager " + next.name;
            } else if (this.freeDivers(color).some((m) => m.isPlayer)) {
                text += "Tout le monde est passé : qui y va ? Pas deux fois de suite.";
                left = "Y aller moi-même";
                right = "Envoyer le meilleur nageur";
            } else {
                text += "Vous venez de nager : un coéquipier y va.";
                left = right = "Encourager l'équipe";
            }
        }
        game.vars.nextStep = text;
        game.vars.stepActionLeft = left;
        game.vars.stepActionRight = right;
        this.statusText = "Poids ramenés : vous " + st.retrieved + "/" + p.weights.length + (rival ? " · adversaires " + this.state[rival].retrieved + "/" + p.weights.length : "")
            + (st.phase == "APNEA" ? " · en apnée" : "");
    }
}

export { WeightRelay }
