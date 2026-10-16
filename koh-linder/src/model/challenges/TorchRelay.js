import { pick } from "../CandidateGenerator";
import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { HistoryType } from "../GameHistory";
import { TeamRace } from "./TeamRace";
import { actCarryStep, carryStepTexts, CARRY_PARAMS } from "./CarrySteps";

// Étapes (cases) propres à cette épreuve
const TorchStep = {
    CARRY: "CARRY",       // course avec charge commune : jet joint de STR de toute l'équipe
    DOOR: "DOOR",         // porte nouée : jet d'INT des 2 meilleurs en INT (au retour : simple course avec charge)
    OBSTACLE: "OBSTACLE", // obstacle avec charge : jet joint d'AGI de toute l'équipe
    TORCH: "TORCH",       // le flambeau à allumer : aucun test
    MAST: "MAST"          // le mât : un grimpeur doit accrocher le grappin
};
const { CARRY, DOOR, OBSTACLE, TORCH, MAST } = TorchStep;

// Parcours aller (jusqu'au flambeau), puis tout le parcours en sens inverse jusqu'au mât (la porte devient une course)
const STEPS = [
    CARRY, CARRY, DOOR, CARRY, CARRY, OBSTACLE, CARRY, CARRY, TORCH,
    CARRY, CARRY, OBSTACLE, CARRY, CARRY, CARRY, CARRY, CARRY,
    MAST
];

const STEP_ICONS = { CARRY: "\u{1F4E6}", DOOR: "\u{1F6AA}", OBSTACLE: "\u{1F6A7}", TORCH: "\u{1F525}", MAST: "\u{1F5FC}" };

const DEFAULT_PARAMS = {
    ...CARRY_PARAMS,        // seuils de course, porte et obstacle avec charge (voir CarrySteps)
    mastThreshold: 20       // jet d'AGI (difficile) du grimpeur : d20 + AGI
};

/**
 * Épreuve « Les flambeaux » (par équipe). Chaque équipe porte une lourde caisse de combustible à travers des obstacles jusqu'à
 * une torche et allume son flambeau, puis refait tout le parcours en sens inverse jusqu'au mât du départ. Il faut alors
 * qu'un grimpeur, porté par toute l'équipe (la corde du grappin est trop courte), accroche le grappin et embrase la vasque.
 * La première équipe à embraser sa vasque gagne.
 *
 * Étapes (18 cases) : 2 course avec charge · porte nouée · 2 course · obstacle · 2 course · flambeau (sans test), puis le retour :
 * 2 course · obstacle · 5 course (la porte devient une course) · mât.
 * - Course avec charge : jet joint de STR de toute l'équipe ; réussite : +2 cases (dans la série), échec : +1 case.
 * - Porte nouée : jet joint d'INT des 2 meilleurs en INT ; réussite : passée, sinon l'équipe reste sur la case.
 * - Obstacle avec charge : jet joint d'AGI de toute l'équipe ; réussite : passé, sinon l'équipe reste.
 * - Flambeau : sans test, « {candidat aléatoire} saisit la torche et allume le flambeau de l'équipe ».
 * - Mât : le candidat avec la meilleure AGI est désigné ; le joueur peut se désigner lui-même (sans test) au swipe gauche, ou laisser
 *   le meilleur grimpeur (droite). Le grimpeur fait un jet d'AGI difficile, répété chaque tour jusqu'à la réussite.
 *
 * Variables de texte : voir TeamRace.
 */
class TorchRelay extends TeamRace {
    static get ID() {
        return "TORCHES";
    }
    constructor(params) {
        const merged = { ...DEFAULT_PARAMS, ...(params || {}) };
        super(TorchRelay.ID, merged, STEPS.length - 1, STEPS);
        this.climber = {}; // couleur -> grimpeur désigné
    }

    start(game) {
        this.initTeams(game);
        game.vars.raceLog = "";
        this.refresh(game);
    }
    cellLabel(index) {
        if (index == this.length) {
            return STEP_ICONS[MAST];
        }
        return index == 0 ? "\u{1F3C1}" : STEP_ICONS[STEPS[index - 1]];
    }

    actTeam(game, color, side) {
        const p = this.params;
        const members = this.members[color];
        const who = this.teamLabel(color);
        const step = STEPS[this.positions[color]];
        switch (step) {
            case CARRY:
            case DOOR:
            case OBSTACLE:
                return actCarryStep(this, step, color, members);
            case TORCH: {
                const holder = pick(members);
                this.positions[color]++;
                // Activité utile menée à bien : +3 REP auprès des coéquipiers
                game.applyEffect({
                    type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: holder.name, value: 3,
                    historyType: HistoryType.CHALLENGE_SUCCESS, description: holder.name + " allume le flambeau de l'équipe à l'épreuve des flambeaux"
                });
                return holder.name + " saisit la torche et allume le flambeau de l'équipe." + (color == this.playerColor ? "" : " (" + who + ")");
            }
            case MAST: {
                // Désignation du grimpeur la première fois : le meilleur en AGI, ou le joueur s'il se désigne (sans test)
                if (!this.climber[color]) {
                    const player = members.find((m) => m.isPlayer);
                    this.climber[color] = (player && side == "left") ? player : this.best(color, "AGI");
                }
                const climber = this.climber[color];
                const roll = climber.rollStat("AGI");
                const ok = roll.total >= p.mastThreshold;
                const detail = "(" + this.rollToString("AGI", roll, p.mastThreshold) + ")";
                if (ok) {
                    this.finishRace(game, color, climber, climber.name + " grimpe en haut du mât et embrase la vasque", "l'épreuve des flambeaux");
                    return climber.name + " lance le grappin et grimpe " + detail + " : la vasque s'embrase !";
                }
                return climber.name + " lance le grappin " + detail + " : il glisse, il faut réessayer.";
            }
        }
        return "";
    }

    /** Variables de texte du prochain tour du joueur. */
    refresh(game) {
        const color = this.playerColor;
        const pos = this.positions[color];
        const step = STEPS[pos];
        const prefix = "Case " + Math.min(pos + 1, STEPS.length) + "/" + STEPS.length + " : ";
        var left = "Porter ensemble";
        var right = left;
        var next = "";
        switch (step) {
            case CARRY:
            case DOOR:
            case OBSTACLE: {
                const t = carryStepTexts(step, prefix);
                next = t.next;
                left = t.left;
                right = t.right;
                break;
            }
            case TORCH:
                next = prefix + "le flambeau : aucun test, on allume !";
                left = right = "Allumer le flambeau";
                break;
            case MAST: {
                const best = this.best(color, "AGI");
                const climber = this.climber[color];
                if (climber) {
                    next = prefix + climber.name + " retente de lancer le grappin (jet d'AGI difficile).";
                    left = right = "Lancer le grappin";
                } else {
                    next = prefix + "le mât ! Il faut un grimpeur adroit, soulevé par toute l'équipe. Le plus agile est " + best.name + ".";
                    left = "Me désigner pour grimper";
                    right = "Laisser " + (best.isPlayer ? "faire le plus agile (moi)" : best.name) + " grimper";
                }
                break;
            }
        }
        game.vars.nextStep = next;
        game.vars.stepActionLeft = left;
        game.vars.stepActionRight = right;
        const rival = this.colors.find((c) => c != color);
        this.statusText = "Votre équipe : case " + pos + "/" + this.length + (rival ? " · adversaires : case " + this.positions[rival] : "");
    }
}

export { TorchRelay, TorchStep }
