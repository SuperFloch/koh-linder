import { shuffle } from "../CandidateGenerator";
import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { HistoryType } from "../GameHistory";
import { TeamCssColor } from "../Team";
import { TeamRace } from "./TeamRace";

const DEFAULT_PARAMS = {
    size: 5,              // puzzle de size × size pièces
    threshold: 32,        // jet combiné du meneur : d20 + OBS et d20 + INT (somme)
    thinkBonus: 5,        // bonus au jet quand le meneur a réfléchi davantage
    gainPieces: 2,        // pièces qui deviennent bien placées sur une réussite
    lossPieces: 1,        // pièce qui devient mal placée sur un échec sans réflexion
    turnEnergy: 1,        // énergie perdue à chaque tour par les candidats qui ne sont pas meneurs
    heroRep: 0,           // les REP du meneur sont gérées par la fin de l'épreuve (leaderRep)
    winnerLeaderRep: 5,       // REP du meneur vainqueur auprès de ses coéquipiers
    winnerLeaderRivalRep: 3,  // et auprès de l'équipe adverse
    loserLeaderRep: -3,       // REP du meneur perdant auprès de son équipe
    loserLeaderRivalRep: -2   // et auprès de l'équipe adverse
};

/**
 * Épreuve « Le puzzle aquatique » (par équipe). Chaque équipe a un puzzle de 5 × 5 pièces, de gros morceaux flottants d'une même
 * image. Un MENEUR est désigné : seul hors de l'eau, il voit l'image et dirige les opérations. La première équipe qui reconstitue
 * son puzzle gagne ; si les deux y parviennent dans le même tour, c'est l'équipe du joueur (règle générale des égalités).
 *
 * Au début, 0 pièce est bien placée. Les tours de jeu font passer le temps. À chaque tour, le meneur fait un jet combiné d'OBS et
 * d'INT (somme de d20 + OBS et d20 + INT ≥ seuil), avec un choix au swipe :
 * - Gauche, « réfléchir davantage » : il passe ce tour à réfléchir ; au tour suivant son jet, résolu automatiquement, reçoit +5.
 * - Droite, « appliquer la combinaison trouvée » : le jet est résolu tout de suite.
 * Réussite (avec ou sans réflexion) : 2 pièces deviennent bien placées. Échec sans réflexion : une pièce bien placée devient
 * mal placée. Échec après réflexion : aucun changement.
 * Chaque tour coûte 1 énergie à tous les candidats qui ne sont pas meneurs.
 *
 * Fin : le meneur de l'équipe gagnante reçoit +5 REP auprès de ses coéquipiers et +3 auprès de l'équipe adverse ; le meneur de
 * l'équipe perdante -3 auprès de son équipe et -2 auprès de l'adversaire.
 *
 * Le premier tour sert à désigner le meneur (gauche : le joueur se désigne ; droite : le meilleur en OBS + INT).
 * Minimap : une grille 5 × 5 par équipe, une case de la couleur de l'équipe par pièce bien placée.
 */
class WaterPuzzle extends TeamRace {
    static get ID() {
        return "WATER_PUZZLE";
    }
    constructor(params) {
        const merged = { ...DEFAULT_PARAMS, ...(params || {}) };
        super(WaterPuzzle.ID, merged, merged.size * merged.size);
        this.designated = false;
        this.turn = 0;
        // couleur -> { leader, thinking: le meneur a réfléchi au tour précédent, cells: booléen par pièce (bien placée ou non) }
        this.state = {};
        this.reached = [];   // équipes qui ont terminé pendant le tour en cours
    }

    start(game) {
        this.initTeams(game);
        this.colors.forEach((color) => {
            this.state[color] = { leader: null, thinking: false, cells: new Array(this.length).fill(false) };
        });
        game.vars.raceLog = "";
        this.refresh(game);
    }
    /** Grilles de la minimap : une par équipe, joueur en premier. */
    grids() {
        return this.colors
            .map((color) => ({ key: color, mine: color == this.playerColor, bg: TeamCssColor[color] || "#fae79d", cells: this.state[color].cells, count: this.positions[color] }))
            .sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0));
    }
    /** Meilleur candidat de l'équipe pour diriger (OBS + INT). */
    bestLeader(color) {
        return shuffle(this.members[color]).sort((a, b) => (b.attributes.OBS + b.attributes.INT) - (a.attributes.OBS + a.attributes.INT))[0];
    }
    /** Place ou retire `count` pièces au hasard ; met à jour le compteur. */
    movePieces(color, count, placed) {
        const st = this.state[color];
        const free = shuffle(st.cells.map((on, i) => (on == !placed ? i : -1)).filter((i) => i >= 0)).slice(0, count);
        free.forEach((i) => { st.cells[i] = placed; });
        this.positions[color] = st.cells.filter((on) => on).length;
    }

    actTeam(game, color, side) {
        const p = this.params;
        const st = this.state[color];
        const mine = color == this.playerColor;
        const tag = mine ? "" : " (" + this.teamLabel(color) + ")";
        if (!this.designated) {
            const player = this.members[color].find((m) => m.isPlayer);
            st.leader = (mine && player && side == "left") ? player : this.bestLeader(color);
            return (st.leader.isPlayer ? "Vous prenez" : st.leader.name + " prend") + " la direction des opérations, hors de l'eau." + tag;
        }
        const leader = st.leader;
        const name = leader.isPlayer ? "Vous" : leader.name;
        // Tous les candidats qui ne dirigent pas dépensent de l'énergie à chaque tour
        this.members[color].filter((m) => m !== leader).forEach((m) => m.changeEnergy(-p.turnEnergy));

        var thought = st.thinking;
        if (!thought) {
            const think = mine && leader.isPlayer ? side == "left" : 21 + leader.attributes.OBS + leader.attributes.INT < p.threshold;
            if (think) {
                st.thinking = true;
                return name + " réfléchit davantage à la combinaison, en observant l'image." + tag;
            }
        }
        st.thinking = false;
        const bonus = thought ? p.thinkBonus : 0;
        const roll = this.combinedRoll(leader, "OBS", "INT", p.threshold - bonus);
        const detail = roll.text + (thought ? " (+" + bonus + " d'avoir réfléchi)" : "");
        if (roll.ok) {
            const before = this.positions[color];
            this.movePieces(color, p.gainPieces, true);
            if (this.positions[color] >= this.length) {
                this.reached.push(color);
            }
            return name + (thought ? " applique la combinaison trouvée " : " donne la combinaison ") + detail + " : " + (this.positions[color] - before) + " pièces se mettent en place ! (" + this.positions[color] + "/" + this.length + ")" + tag;
        }
        if (thought) {
            return name + " applique la combinaison " + detail + " : ça ne change rien." + tag;
        }
        if (this.positions[color] > 0) {
            this.movePieces(color, p.lossPieces, false);
            return name + " donne une mauvaise combinaison " + detail + " : une pièce se déplace de sa place (" + this.positions[color] + "/" + this.length + ")." + tag;
        }
        return name + " donne une mauvaise combinaison " + detail + " : rien n'était placé, rien ne bouge." + tag;
    }

    playRound(game, side) {
        this.reached = [];
        const sections = super.playRound(game, side);
        if (!this.designated) {
            this.designated = true;
        } else {
            this.turn++;
            if (this.reached.length) {
                // Plusieurs équipes terminent dans le même tour : l'équipe du joueur d'abord (ordre du tour)
                this.finish(game, this.roundOrder().find((c) => this.reached.includes(c)));
            }
        }
        return sections;
    }

    /** Victoire de `winner` : REP des meneurs (vainqueur et perdant) auprès de leur équipe et de l'équipe adverse. */
    finish(game, winner) {
        const p = this.params;
        const loser = this.colors.find((c) => c != winner);
        const lead = this.state[winner].leader;
        this.finishRace(game, winner, lead, lead.name + " dirige son équipe jusqu'au puzzle complet", "l'épreuve du puzzle aquatique");
        // Meneur vainqueur : +5 auprès de ses coéquipiers, +3 auprès de l'équipe adverse
        game.applyEffect({
            type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: lead.name, value: p.winnerLeaderRep,
            historyType: HistoryType.CHALLENGE_SUCCESS, description: lead.name + " dirige son équipe vers la victoire au puzzle aquatique"
        });
        this.rep(game, this.members[loser], lead, p.winnerLeaderRivalRep, HistoryType.CHALLENGE_SUCCESS, lead.name + " impressionne l'équipe adverse au puzzle aquatique");
        if (loser) {
            const other = this.state[loser].leader;
            // Meneur perdant : -3 auprès de son équipe, -2 auprès de l'équipe adverse
            game.applyEffect({
                type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: other.name, value: p.loserLeaderRep,
                historyType: HistoryType.CHALLENGE_FAILURE, description: other.name + " échoue à diriger son équipe au puzzle aquatique"
            });
            this.rep(game, this.members[winner], other, p.loserLeaderRivalRep, HistoryType.CHALLENGE_FAILURE, other.name + " déçoit l'équipe adverse au puzzle aquatique");
        }
    }
    /** REP de `about` auprès de chaque membre de `team` (une seule entrée d'historique). */
    rep(game, team, about, value, type, description) {
        team.forEach((m) => game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: m.name, about: about.name, value, history: false }));
        game.record(type, [about, ...team], description, { gauge: RelationGauge.REP, value, challenge: this.id });
    }

    refresh(game) {
        const color = this.playerColor;
        const st = this.state[color];
        const rival = this.colors.find((c) => c != color);
        var text;
        var left;
        var right;
        if (!this.designated) {
            const best = this.bestLeader(color);
            text = "Qui dirige les opérations hors de l'eau et voit l'image du puzzle ? Le meilleur est " + (best.isPlayer ? "vous" : best.name) + " (OBS + INT).";
            left = "Me désigner comme meneur";
            right = best.isPlayer ? "Diriger (le meilleur, c'est moi)" : "Laisser " + best.name + " diriger";
        } else if (st.leader.isPlayer) {
            if (st.thinking) {
                text = "Tour " + (this.turn + 1) + " : vous avez bien réfléchi, la combinaison est prête (+" + this.params.thinkBonus + " au jet).";
                left = right = "Appliquer la combinaison";
            } else {
                text = "Tour " + (this.turn + 1) + " : vous dirigez. " + this.positions[color] + "/" + this.length + " pièces bien placées. Réfléchir davantage (+" + this.params.thinkBonus + " au jet, mais vous passez ce tour) ou appliquer la combinaison tout de suite ?";
                left = "Réfléchir davantage (+" + this.params.thinkBonus + ", passe un tour)";
                right = "Appliquer la combinaison";
            }
        } else {
            text = "Tour " + (this.turn + 1) + " : " + st.leader.name + " dirige, vous poussez les pièces dans l'eau (-" + this.params.turnEnergy + " énergie). " + this.positions[color] + "/" + this.length + " pièces bien placées.";
            left = right = "Pousser les pièces";
        }
        game.vars.nextStep = text;
        game.vars.stepActionLeft = left;
        game.vars.stepActionRight = right;
        this.statusText = "Pièces bien placées : vous " + this.positions[color] + "/" + this.length + (rival ? " · adversaires " + this.positions[rival] : "");
    }
}

export { WaterPuzzle }
