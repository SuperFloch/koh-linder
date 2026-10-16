import { accord } from "../Personalize";
import { shuffle } from "../CandidateGenerator";
import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { HistoryType } from "../GameHistory";
import { TeamCssColor } from "../Team";
import { TeamRace } from "./TeamRace";
import { CarryStep, CARRY_ICONS, CARRY_PARAMS, actCarryStep, carryStepTexts } from "./CarrySteps";

const { CARRY, DOOR, OBSTACLE } = CarryStep;

// Parcours du coffre : 4 course · porte nouée · 2 course · obstacle avec charge · 2 course · porte nouée · 6 course · ligne d'arrivée
const STEPS = [CARRY, CARRY, CARRY, CARRY, DOOR, CARRY, CARRY, OBSTACLE, CARRY, CARRY, DOOR, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];

const DEFAULT_PARAMS = {
    ...CARRY_PARAMS,        // seuils de course, porte et obstacle avec charge (voir CarrySteps)
    towerHeight: 5,         // étages de la tour : autant de tests pour monter que pour redescendre
    towerThreshold: 30,     // test combiné de STR et d'AGI de difficulté modérée (d20 + STR + d20 + AGI)
    heroRep: 0,             // pas de bonus générique de victoire : voir climberRep
    climberRep: 5,          // REP du grimpeur auprès de son équipe quand il a bloqué la bobine adverse et que son équipe gagne
    climberRivalRep: 3      // REP du grimpeur auprès de l'équipe adverse dans le même cas
};

/**
 * Épreuve « La bobine » (par équipe). Chaque équipe désigne un grimpeur (de préférence agile ; le joueur peut se désigner) qui monte
 * en haut d'une tour en suivant une corde entrelacée entre les piliers, y trouve un bâton, puis redescend par le même chemin.
 * Le bâton sert à BLOQUER LA BOBINE ADVERSE. Pendant ce temps, le reste de l'équipe porte ensemble un lourd coffre attaché à la
 * bobine à travers une série d'obstacles ; tant que sa bobine n'est pas bloquée, l'équipe avance.
 *
 * L'épreuve se termine quand :
 * - une équipe amène son coffre à la ligne d'arrivée : elle gagne ;
 * - ou les deux bobines sont bloquées : gagne l'équipe la plus proche de la ligne d'arrivée (égalité : tirage au sort).
 *
 * - Tour de 5 étages : monter ou descendre d'un étage = test combiné de STR et d'AGI de difficulté modérée (la SOMME de d20 + STR et
 *   d20 + AGI doit atteindre le seuil). Monté puis redescendu, le grimpeur a bloqué la bobine adverse.
 * - Coffre (les étapes sont celles des flambeaux, voir CarrySteps) : 4 course, 1 porte nouée, 2 course, 1 obstacle avec charge,
 *   2 course, 1 porte nouée, 6 course, ligne d'arrivée (17 cases). Le grimpeur ne porte pas.
 * - Si le grimpeur a bloqué la bobine adverse et que son équipe gagne : +5 REP auprès de son équipe et +3 auprès de l'équipe adverse.
 *
 * Le premier tour sert à désigner le grimpeur (swipe gauche : le joueur se désigne ; droite : le plus agile). Minimap : le parcours
 * du coffre, un marqueur par équipe.
 */
class SpoolRace extends TeamRace {
    static get ID() {
        return "SPOOL";
    }
    constructor(params) {
        const merged = { ...DEFAULT_PARAMS, ...(params || {}) };
        super(SpoolRace.ID, merged, STEPS.length, STEPS);
        this.designated = false;
        // couleur -> { climber, level: tests réussis (0 à 2 × hauteur), blocked: bobine bloquée par l'adversaire }
        this.state = {};
    }

    start(game) {
        this.initTeams(game);
        this.colors.forEach((color) => {
            this.state[color] = { climber: null, level: 0, blocked: false };
        });
        game.vars.raceLog = "";
        this.refresh(game);
    }
    cellLabel(index) {
        return index == 0 ? "\u{1F3C1}" : (index == this.length ? "\u{1F9F5}" : CARRY_ICONS[STEPS[index - 1]]);
    }
    /**
     * Indicateur vertical à gauche de la minimap : hauteur de chaque grimpeur dans la tour (0 = pied, `towerHeight` = sommet).
     * @returns {{size: number, label: string, items: {key: string, bg: string|null, mine: boolean, value: number, title: string}[]}}
     */
    gauge() {
        const h = this.params.towerHeight;
        return {
            size: h,
            label: "\u{1F5FC}",
            items: this.colors.map((color) => {
                const level = this.state[color].level;
                const value = level <= h ? level : 2 * h - level;
                return {
                    key: color, bg: TeamCssColor[color] || null, mine: color == this.playerColor, value,
                    title: "Grimpeur " + (this.teamNames[color] || color) + " : " + this.floorText(color)
                };
            })
        };
    }
    rivalOf(color) {
        return this.colors.find((c) => c != color);
    }
    towerDone(color) {
        return this.state[color].level >= 2 * this.params.towerHeight;
    }
    /** Porteurs du coffre : toute l'équipe sauf le grimpeur. */
    carriers(color) {
        return this.members[color].filter((m) => m !== this.state[color].climber);
    }
    /** Où en est le grimpeur : « étage 2/5 (montée) »... */
    floorText(color) {
        const h = this.params.towerHeight;
        const level = this.state[color].level;
        if (level == 0) {
            return "au pied de la tour";
        }
        if (level < h) {
            return "étage " + level + "/" + h + " (montée)";
        }
        if (level == h) {
            return "au sommet, le bâton en main";
        }
        return level >= 2 * h ? "redescendu" : "étage " + (2 * h - level) + "/" + h + " (descente)";
    }

    actTeam(game, color, side) {
        const p = this.params;
        const st = this.state[color];
        const mine = color == this.playerColor;
        const who = this.teamLabel(color);
        if (!this.designated) {
            // Premier tour : désignation du grimpeur
            const player = this.members[color].find((m) => m.isPlayer);
            st.climber = (mine && player && side == "left") ? player : this.best(color, "AGI");
            return (st.climber.isPlayer ? "Vous vous désignez" : st.climber.name + " est " + accord(st.climber, "désigné")) + " pour grimper." + (mine ? "" : " (" + who + ")");
        }
        const logs = [];
        // Le grimpeur monte ou descend d'un étage
        if (!this.towerDone(color)) {
            const climber = st.climber;
            const name = climber.isPlayer ? "Vous" : climber.name;
            const roll = this.combinedRoll(climber, "STR", "AGI", p.towerThreshold);
            if (roll.ok) {
                st.level++;
                if (this.towerDone(color)) {
                    this.state[this.rivalOf(color)].blocked = true;
                    logs.push(name + " redescend " + roll.text + " et bloque la bobine adverse avec le bâton !");
                } else if (st.level == p.towerHeight) {
                    logs.push(name + " atteint le sommet " + roll.text + " et saisit le bâton.");
                } else {
                    logs.push(name + (st.level < p.towerHeight ? " monte " : " descend ") + roll.text + " : " + this.floorText(color) + ".");
                }
            } else {
                logs.push(name + " glisse " + roll.text + " : " + this.floorText(color) + ".");
            }
        }
        // Les porteurs avancent tant que la bobine n'est pas bloquée
        if (st.blocked) {
            logs.push("La bobine est bloquée : le coffre ne bouge plus !");
        } else if (this.positions[color] < this.length) {
            logs.push(actCarryStep(this, STEPS[this.positions[color]], color, this.carriers(color)));
            if (this.positions[color] >= this.length) {
                this.finish(game, color);
            }
        }
        return logs.join(" ");
    }

    playRound(game, side) {
        const sections = super.playRound(game, side);
        if (!this.designated) {
            this.designated = true;
        } else if (!this.winner && this.colors.every((c) => this.state[c].blocked)) {
            // Les deux bobines sont bloquées : la plus proche de l'arrivée l'emporte
            const [a, b] = this.roundOrder(); // égalité : favorable à l'équipe du joueur
            this.finish(game, this.positions[a] >= this.positions[b] ? a : b);
        }
        return sections;
    }

    /** Victoire de `color` : le héros est son grimpeur s'il a bloqué la bobine adverse, sinon un porteur tiré au hasard. */
    finish(game, color) {
        const st = this.state[color];
        const blocker = this.towerDone(color);
        const p = this.params;
        const hero = blocker ? st.climber : shuffle(this.carriers(color))[0];
        this.finishRace(game, color, hero, hero.name + " porte le coffre jusqu'à l'arrivée", "l'épreuve de la bobine");
        if (blocker) {
            game.applyEffect({
                type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: hero.name, value: p.climberRep,
                historyType: HistoryType.CHALLENGE_SUCCESS, description: hero.name + " bloque la bobine adverse et offre la victoire à son équipe"
            });
            this.members[this.rivalOf(color)].forEach((m) => game.applyEffect({
                type: EffectType.RELATION, gauge: RelationGauge.REP, target: m.name, about: hero.name, value: p.climberRivalRep, history: false
            }));
            game.record(HistoryType.CHALLENGE_SUCCESS, [hero, ...this.members[this.rivalOf(color)]], hero.name + " bloque la bobine adverse et impressionne l'équipe rivale", { gauge: RelationGauge.REP, value: p.climberRivalRep, challenge: this.id });
        }
    }

    refresh(game) {
        const color = this.playerColor;
        const st = this.state[color];
        const rival = this.rivalOf(color);
        const p = this.params;
        var text;
        var left;
        var right;
        if (!this.designated) {
            const best = this.best(color, "AGI");
            text = "Qui grimpe en haut de la tour ? Le plus agile de l'équipe est " + (best.isPlayer ? "vous" : best.name) + ".";
            left = "Me désigner pour grimper";
            right = best.isPlayer ? "Y aller (le plus agile, c'est moi)" : "Laisser " + best.name + " grimper";
        } else {
            const you = st.climber.isPlayer;
            const lines = [];
            if (st.blocked) {
                lines.push("Votre bobine est bloquée : le coffre ne peut plus avancer.");
            }
            if (this.towerDone(color)) {
                lines.push((you ? "Vous avez" : st.climber.name + " a") + " bloqué la bobine adverse.");
            } else if (you) {
                lines.push("Vous grimpez : " + this.floorText(color) + " (test STR + AGI ≥ " + p.towerThreshold + ").");
            } else {
                lines.push(st.climber.name + " grimpe : " + this.floorText(color) + ".");
            }
            const step = STEPS[this.positions[color]];
            const t = !st.blocked && step ? carryStepTexts(step, "Case " + (this.positions[color] + 1) + "/" + this.length + " : ") : null;
            if (t && !you) {
                lines.push(t.next);
            }
            text = lines.join(" ");
            left = you && !this.towerDone(color) ? "Grimper (STR + AGI)" : (t && !you ? t.left : "Continuer");
            right = you && !this.towerDone(color) ? left : (t && !you ? t.right : "Continuer");
        }
        game.vars.nextStep = text;
        game.vars.stepActionLeft = left;
        game.vars.stepActionRight = right;
        this.statusText = "Coffre : votre équipe case " + this.positions[color] + "/" + this.length
            + (rival ? " · adversaires case " + this.positions[rival] : "")
            + (this.designated ? " · votre grimpeur : " + this.floorText(color) + (rival ? " · leur grimpeur : " + this.floorText(rival) : "") : "");
    }
}

export { SpoolRace }
