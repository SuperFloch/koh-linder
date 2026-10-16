import { pick } from "../CandidateGenerator";
import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { HistoryType } from "../GameHistory";
import { TeamRace } from "./TeamRace";

const DEFAULT_PARAMS = {
    sticks: 5,            // nombre de bâtons ; la dernière case est celle du poignard
    basePerMember: 9.5,   // jet d'équipe de STR : seuil par membre = base + tension × numéro de la case (de plus en plus tendu)
    tensionPerCase: 0.9,
    fallRep: 1,           // REP perdue par un candidat qui fait 1 (il chute) auprès de ses coéquipiers
    stickRep: 2           // REP gagnée par celui qui attrape un bâton (effort remarqué)
};

/**
 * Épreuve « Les élastiques » (par équipe, épreuve de force brute). Tous les membres d'une équipe sont attachés au même pieu par
 * un élastique et doivent ramasser des bâtons gravés de plus en plus loin (élastique de plus en plus tendu) : 5 bâtons, puis le
 * poignard qui symbolise la victoire. La première équipe qui a déposé 5 bâtons et attrape le poignard gagne.
 *
 * Parcours en 7 cases : la case départ (le pieu, 0), une case par bâton (1 à 5) et la case du poignard (6). Chaque case a un seuil
 * de difficulté croissant jusqu'au poignard.
 * - Pour atteindre un bâton, l'équipe doit retraverser TOUTES les cases depuis le départ, même celles dont le bâton a déjà été
 *   pris : chaque case est un tirage d'élastique commun (jet joint de STR de toute l'équipe, toujours refait à chaque trajet).
 * - Réussite : l'équipe passe à la case suivante ; sur la case de son bâton, « {candidat} attrape le bâton pour son équipe ! »
 *   et revient INSTANTANÉMENT au pieu déposer le bâton (aucun test au retour). Échec : l'équipe reste sur la case.
 * - Si un candidat fait 1 au dé : il chute, perd 1 REP auprès de ses coéquipiers et l'équipe ne progresse pas (même si la somme suffit).
 * - Le poignard (case 6) donne la victoire immédiatement, sans retour.
 *
 * Minimap : une colonne par case ; la ligne de statut indique les bâtons déposés.
 */
class ElasticRace extends TeamRace {
    static get ID() {
        return "ELASTICS";
    }
    constructor(params) {
        const merged = { ...DEFAULT_PARAMS, ...(params || {}) };
        super(ElasticRace.ID, merged, merged.sticks + 1);
        this.state = {}; // couleur -> { deposited }
    }

    start(game) {
        this.initTeams(game);
        this.colors.forEach((color) => { this.state[color] = { deposited: 0 }; });
        game.vars.raceLog = "";
        this.refresh(game);
    }
    cellLabel(index) {
        if (index == 0) {
            return "\u{1FAA7}";
        }
        return index == this.length ? "\u{1F5E1}" : "\u{1FAB5}" + index;
    }
    /** Case de l'objet visé : le prochain bâton (cases 1 à 5), puis le poignard (case 6). */
    targetCase(color) {
        return this.state[color].deposited < this.params.sticks ? this.state[color].deposited + 1 : this.length;
    }
    thresholdPerMember(caseIndex) {
        return this.params.basePerMember + this.params.tensionPerCase * caseIndex;
    }

    actTeam(game, color, side) {
        const p = this.params;
        const members = this.members[color];
        const st = this.state[color];
        const who = this.teamLabel(color);
        const dest = this.positions[color] + 1;
        const roll = this.teamRoll(members, "STR", Math.round(members.length * this.thresholdPerMember(dest)));

        if (roll.nat1.length) {
            // Un candidat qui fait 1 chute : il perd de la REP, l'équipe ne progresse pas
            roll.nat1.forEach((m) => game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: m.name, value: -p.fallRep }));
            return who + " tire sur l'élastique vers la case " + dest + " " + roll.text + " : " + roll.nat1.map((m) => m.isPlayer ? "vous chutez" : m.name + " chute").join(" et ") + ", l'équipe ne progresse pas.";
        }
        if (!roll.ok) {
            return who + " tire sur l'élastique vers la case " + dest + " " + roll.text + " : trop tendu, l'équipe reste sur la case.";
        }
        this.positions[color] = dest;
        if (dest != this.targetCase(color)) {
            return who + " passe la case " + dest + " " + roll.text + ".";
        }
        const holder = pick(members);
        if (dest == this.length) {
            // Le poignard : victoire immédiate, pas de retour
            this.finishRace(game, color, holder, holder.name + " attrape le poignard pour son équipe", "l'épreuve des élastiques");
            return holder.name + " attrape le poignard pour son équipe !";
        }
        // Un bâton : retour instantané au pieu (aucun test), dépôt du bâton
        st.deposited++;
        this.positions[color] = 0;
        game.applyEffect({
            type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: holder.name, value: p.stickRep,
            historyType: HistoryType.CHALLENGE_SUCCESS, description: holder.name + " attrape le bâton " + st.deposited + " pour son équipe à l'épreuve des élastiques"
        });
        return holder.name + " attrape le bâton pour son équipe ! Retour instantané au pieu : " + (color == this.playerColor ? "bâton déposé" : who + " dépose le bâton") + " (" + st.deposited + "/" + p.sticks + ").";
    }

    refresh(game) {
        const color = this.playerColor;
        const st = this.state[color];
        const p = this.params;
        const rival = this.colors.find((c) => c != color);
        const target = this.targetCase(color);
        const next = this.positions[color] + 1;
        game.vars.nextStep = (st.deposited >= p.sticks
            ? "Tous les bâtons sont déposés : le poignard est à la case " + this.length + ", sans retour !"
            : "Prochain bâton : case " + target + ". Il faut retraverser toutes les cases depuis le pieu.")
            + " Prochaine case : " + next + " (case actuelle : " + this.positions[color] + ").";
        game.vars.stepActionLeft = "Tirer sur l'élastique";
        game.vars.stepActionRight = game.vars.stepActionLeft;
        this.statusText = "Bâtons : vous " + st.deposited + "/" + p.sticks + (rival ? " · adversaires " + this.state[rival].deposited + "/" + p.sticks : "");
    }
}

export { ElasticRace }
