import { il } from "../Personalize";
import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { RelayRace } from "./RelayRace";

const DEFAULT_PARAMS = {
    collars: 10,         // nombre de colliers (= cases)
    baseThreshold: 4,    // seuil du jet de SWI du collier n : base + parCollier × n (plus il est loin, plus c'est dur)
    perCollar: 1.8,
    collarRep: 1,        // REP gagnée par un plongeur qui ramène un collier (étape d'épreuve franchie)
    failRep: 1           // REP perdue par un plongeur qui échoue, auprès de ses coéquipiers
};

/**
 * Épreuve « La plongée » (par équipe). 10 colliers sont accrochés le long d'une corde qui plonge au plus profond de la mer.
 * C'est un relais (règles du relais : voir RelayRace) : chaque équipe envoie un plongeur après l'autre chercher le collier suivant ;
 * la première équipe qui a ramassé les 10 colliers gagne.
 *
 * - Chaque collier = une case. Pour le ramasser, le plongeur fait un jet de SWI contre un seuil qui augmente avec la profondeur.
 *   Réussite : +1 REP ; échec : le collier n'est pas ramené (-1 REP auprès de ses coéquipiers) et le relais continue.
 * - L'ordre de passage au premier tour est la SWI croissante (les premiers colliers sont les plus faciles).
 *
 * Minimap : une colonne par collier ramassé (0 à 10), un marqueur par équipe.
 */
class DiveRelay extends RelayRace {
    static get ID() {
        return "DIVE_RELAY";
    }
    constructor(params) {
        const merged = { ...DEFAULT_PARAMS, ...(params || {}) };
        super(DiveRelay.ID, merged, merged.collars);
        this.swimming = true; // la minimap a des cases bleues (contexte de natation)
    }

    start(game) {
        this.initTeams(game);
        this.initRelay();
        game.vars.raceLog = "";
        this.refresh(game);
    }
    cellLabel(index) {
        return index == 0 ? "@wave" : (index == this.length ? "@necklace" : String(index));
    }
    threshold(collar) {
        return Math.ceil(this.params.baseThreshold + this.params.perCollar * collar);
    }

    actTeam(game, color, side) {
        const p = this.params;
        const who = this.teamLabel(color);
        const collar = this.positions[color] + 1;
        const diver = this.chooseDiver(color, color == this.playerColor ? side : null);
        const threshold = this.threshold(collar);
        const roll = diver.rollStat("SWI");
        const ok = roll.total >= threshold;
        this.markDived(color, diver);
        const detail = "(" + this.rollToString("SWI", roll, threshold) + ")";
        const name = diver.isPlayer ? "Vous" : diver.name;
        if (ok) {
            this.positions[color] = collar;
            if (collar >= p.collars) {
                this.finishRace(game, color, diver, diver.name + " ramène le dernier collier", "l'épreuve de la plongée");
                return name + " plonge " + detail + " et ramène le dernier collier !";
            }
            game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: diver.name, value: p.collarRep });
            return name + " plonge pour le collier " + collar + " " + detail + " et le ramène !" + (color == this.playerColor ? "" : " (" + who + ")");
        }
        game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: diver.name, value: -p.failRep });
        return name + " plonge pour le collier " + collar + " " + detail + " : trop profond, " + il(diver) + " revient les mains vides." + (color == this.playerColor ? "" : " (" + who + ")");
    }

    refresh(game) {
        const color = this.playerColor;
        const collar = this.positions[color] + 1;
        const next = this.nextInOrder(color);
        const rival = this.colors.find((c) => c != color);
        var text = "Collier " + collar + "/" + this.length + " (jet de SWI contre " + this.threshold(collar) + "). ";
        var left;
        var right;
        if (next) {
            text += "Prochain plongeur : " + (next.isPlayer ? "vous" : next.name) + ".";
            left = right = next.isPlayer ? "Plonger (SWI)" : "Encourager " + next.name;
        } else if (this.freeDivers(color).some((m) => m.isPlayer)) {
            text += "Tout le monde est passé : qui plonge ? Pas deux fois de suite.";
            left = "Plonger moi-même";
            right = "Envoyer le meilleur nageur";
        } else {
            text += "Vous venez de plonger : on ne plonge pas deux fois de suite, un coéquipier y va.";
            left = right = "Encourager l'équipe";
        }
        game.vars.nextStep = text;
        game.vars.stepActionLeft = left;
        game.vars.stepActionRight = right;
        this.statusText = "Colliers : votre équipe " + this.positions[color] + "/" + this.length + (rival ? " · adversaires " + this.positions[rival] : "");
    }
}

export { DiveRelay }
