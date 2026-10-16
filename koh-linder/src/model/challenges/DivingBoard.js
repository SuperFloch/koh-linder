import { accord } from "../Personalize";
import { shuffle } from "../CandidateGenerator";
import { TeamRace } from "./TeamRace";

const DEFAULT_PARAMS = {
    baseThreshold: 6,   // seuil PAR MEMBRE du premier jet joint de STR (très facile)
    tensionStep: 1,     // le seuil par membre augmente de 1 à chaque nouveau test
    minutesPerTest: 5,  // pour la narration : chaque test correspond à 5 minutes
    trackLength: 20,    // cases de la minimap (une par test, plafonnée)
    heroRep: 0          // pas de REP : tout le monde perd en même temps
};

/**
 * Épreuve « Le plongeoir » (par équipe, endurance). Chaque équipe garde en l'air, en tirant sur une corde, une plateforme suspendue
 * sur laquelle se tient l'un des siens (au-dessus de l'eau). Le candidat suspendu n'a aucun test à faire : on désigne celui qui a la
 * moins de STR (le joueur peut se désigner lui-même au moment du choix).
 *
 * Les autres tirent : à chaque tour, un jet joint de STR de tous les porteurs (somme de d20 + STR comparée au seuil), qui
 * correspond à 5 minutes de narration. Le premier test est très facile, mais le seuil par membre augmente de 1 à chaque nouveau test.
 * La première équipe qui rate son jet joint laisse tomber son suspendu à l'eau et offre la victoire à l'autre équipe. Aucune REP
 * négative : tout le monde perd en même temps.
 *
 * Le premier tour sert à désigner le suspendu (swipe gauche : le joueur se désigne ; droite : le moins fort de l'équipe).
 * Minimap : une case par test réussi (plafonnée), un marqueur par équipe.
 * Variables de texte supplémentaires : {fallenName} (le suspendu qui est tombé).
 */
class DivingBoard extends TeamRace {
    static get ID() {
        return "DIVING_BOARD";
    }
    constructor(params) {
        const merged = { ...DEFAULT_PARAMS, ...(params || {}) };
        super(DivingBoard.ID, merged, merged.trackLength);
        this.designated = false;
        this.hanging = {};   // couleur -> candidat suspendu
        this.tests = 0;      // tests déjà passés (identique pour les deux équipes)
    }

    start(game) {
        this.initTeams(game);
        game.vars.raceLog = "";
        this.refresh(game);
    }
    cellLabel(index) {
        return index == 0 ? "\u{1F3C1}" : (index % 4 == 0 ? this.minutes(index) + "'" : "");
    }
    minutes(tests) {
        return tests * this.params.minutesPerTest;
    }
    /** Seuil (de l'équipe entière) du prochain test pour des porteurs au nombre de `count`. */
    threshold(count) {
        const p = this.params;
        return count * (p.baseThreshold + p.tensionStep * this.tests);
    }
    /** Le moins fort de l'équipe (égalités tirées au hasard). */
    weakest(color) {
        return shuffle(this.members[color]).sort((a, b) => a.attributes.STR - b.attributes.STR)[0];
    }
    pullers(color) {
        return this.members[color].filter((m) => m !== this.hanging[color]);
    }

    /** C'est le premier qui rate qui perd : l'équipe adverse joue avant, pour que l'égalité (les deux ratent) favorise le joueur. */
    roundOrder() {
        return [...this.colors.filter((c) => c != this.playerColor), this.playerColor];
    }

    actTeam(game, color, side) {
        if (!this.designated) {
            const mine = color == this.playerColor;
            const player = this.members[color].find((m) => m.isPlayer);
            this.hanging[color] = (mine && player && side == "left") ? player : this.weakest(color);
            const h = this.hanging[color];
            return (h.isPlayer ? "Vous montez sur la plateforme suspendue." : h.name + " monte sur la plateforme suspendue.") + (mine ? "" : " (" + this.teamLabel(color) + ")");
        }
        const pullers = this.pullers(color);
        const threshold = this.threshold(pullers.length);
        const roll = this.teamRoll(pullers, "STR", threshold);
        const hanging = this.hanging[color];
        const who = hanging.isPlayer ? "Vous" : hanging.name;
        if (roll.ok) {
            this.positions[color] = this.tests + 1;
            return "Minute " + this.minutes(this.tests + 1) + " : l'équipe tire sur la corde " + roll.text + ", " + who + " reste en équilibre.";
        }
        // La corde glisse : le suspendu tombe à l'eau, l'autre équipe gagne
        const rival = this.colors.find((c) => c != color);
        game.vars.fallenName = hanging.name;
        this.finishRace(game, rival, this.hanging[rival], this.hanging[rival].name + " tient bon sur la plateforme", "l'épreuve du plongeoir");
        return "Minute " + this.minutes(this.tests + 1) + " : la corde glisse " + roll.text + " ! " + who + (hanging.isPlayer ? " tombez" : " tombe") + " à l'eau.";
    }

    playRound(game, side) {
        const sections = super.playRound(game, side);
        if (!this.designated) {
            this.designated = true;
        } else if (!this.winner) {
            this.tests++;
        }
        return sections;
    }

    refresh(game) {
        const color = this.playerColor;
        const rival = this.colors.find((c) => c != color);
        var text;
        var left;
        var right;
        if (!this.designated) {
            const weak = this.weakest(color);
            text = "Qui se tient sur la plateforme suspendue ? Le moins fort de l'équipe est " + (weak.isPlayer ? "vous" : weak.name) + ". Les autres tireront sur la corde.";
            left = "Me désigner (suspendu)";
            right = weak.isPlayer ? "Y aller (le moins fort, c'est moi)" : "Laisser " + weak.name + " monter";
        } else if (this.hanging[color].isPlayer) {
            text = "Minute " + this.minutes(this.tests) + " : vous êtes suspendu, en équilibre. Vos coéquipiers tirent sur la corde. Prochain jet joint de STR : " + this.threshold(this.pullers(color).length) + ".";
            left = right = "Garder l'équilibre";
        } else {
            text = "Minute " + this.minutes(this.tests) + " : " + this.hanging[color].name + " est " + accord(this.hanging[color], "suspendu") + ". Prochain jet joint de STR de toute l'équipe : " + this.threshold(this.pullers(color).length) + ".";
            left = right = "Tirer sur la corde";
        }
        game.vars.nextStep = text;
        game.vars.stepActionLeft = left;
        game.vars.stepActionRight = right;
        this.statusText = this.designated ? "Tests réussis : " + this.tests + " (" + this.minutes(this.tests) + " minutes)" + (rival ? " · suspendus : " + this.hanging[color].name + " et " + this.hanging[rival].name : "") : "";
    }
}

export { DivingBoard }
