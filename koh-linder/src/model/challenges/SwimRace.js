import { mark } from "../Personalize";
import { shuffle } from "../CandidateGenerator";
import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { decide, DecisionContext } from "../Decision";
import { HistoryType } from "../GameHistory";
import { RaceChallenge } from "./RaceChallenge";

const DEFAULT_PARAMS = {
    length: 10,           // nombre de cases jusqu'à la rive
    diveThreshold: 12,    // test d'AGI du plongeon
    soloThreshold: 14,    // test de SWI pour nager en solo (seuil plus haut)
    groupThreshold: 10    // test de SOC pour nager avec les autres
    // REP du classement : voir `rankRewards` dans les paramètres de Challenge (STEP_PARAMS)
};

const SwimMode = {
    SOLO: "SOLO",
    GROUP: "GROUP"
};

/**
 * Épreuve de nage du bateau jusqu'à la rive. Chaque candidat a un score d'avancement (case 0 = bateau, `length` = rive).
 * Chaque tour, tous les candidats encore en course agissent en même temps :
 * - SOLO : test de SWI (seuil haut). Réussite : +2 cases, échec : +1 case.
 * - GROUP : test de SOC. +1 case dans tous les cas. Réussite : un compagnon gagne en AFF envers le nageur.
 *   Échec : le compagnon doit l'aider et perd en estime (REP) envers lui.
 * Les candidats non joueurs choisissent leur mode eux-mêmes (les bons nageurs préfèrent le solo).
 *
 * Variables de texte alimentées : {raceLog} (compte rendu du tour du joueur), {playerRankLabel}, {raceWinner}.
 */
class SwimRace extends RaceChallenge {
    static get ID() {
        return "SWIM";
    }
    constructor(params) {
        const merged = { ...DEFAULT_PARAMS, ...(params || {}) };
        super(SwimRace.ID, merged, merged.length);
        this.swimming = true; // la minimap a des cases bleues (contexte de natation)
        this.rankingApplied = false;
    }

    // --- Interface Challenge ---

    start(game) {
        this.initRace(game);
        // Les non-joueurs plongent dès le départ ; le plongeon du joueur est joué par une carte
        this.candidates.filter((c) => !c.isPlayer).forEach((c) => this.dive(c));
        game.vars.raceLog = "";
    }
    cellLabel(index) {
        return index == 0 ? "⛵" : (index == this.length ? "\u{1F3DD}" : String(index));
    }
    /**
     * Tour d'une épreuve de nage : gauche = nager seul, droite = nager avec les autres.
     * Renvoie la même carte tant que le joueur n'a pas atteint la rive, sinon `card.challenge.onFinish`.
     */
    playTurn(game, leftOrRight, card) {
        const player = game.getEntityByName("{player}");
        game.vars.raceLog = this.playRound(player.name, leftOrRight == "left" ? SwimMode.SOLO : SwimMode.GROUP);
        if (this.hasArrived(player.name)) {
            return card.challenge.onFinish;
        }
        return "ID:" + card.id;
    }
    /**
     * Termine la course des autres, applique les gains/pertes de REP selon le rang (aux yeux de tous les autres candidats)
     * et prépare les variables {playerRankLabel} et {raceWinner}.
     */
    end(game) {
        const player = game.getEntityByName("{player}");
        this.finishRemaining();
        if (!this.rankingApplied) {
            const rewards = this.rankRewards();
            Object.keys(rewards).forEach((name) => {
                if (rewards[name] != 0) {
                    const rank = this.rankOf(name);
                    // Les gains/pertes de plus de 1 s'inscrivent dans l'historique (réussite ou échec d'épreuve)
                    game.applyEffect({
                        type: EffectType.RELATION, gauge: RelationGauge.REP, target: "ALL", about: name, value: rewards[name],
                        historyType: rewards[name] > 0 ? HistoryType.CHALLENGE_SUCCESS : HistoryType.CHALLENGE_FAILURE,
                        description: name + " arrive " + this.rankWord(rank - 1, this.arrived.length, game.getEntityByName(name)) + " à l'épreuve de nage jusqu'à la rive"
                    });
                }
            });
            this.rankingApplied = true;
        }
        const rank = this.rankOf(player.name);
        game.vars.playerRankLabel = rank == 1 ? "1re" : rank + "e";
        game.vars.raceWinner = this.arrived[0];
    }

    // --- Règles propres à la nage ---

    /** Plongeon : AGI. Réussite : case 2, échec : case 1. */
    dive(candidate) {
        const roll = candidate.rollStat("AGI");
        const success = roll.total >= this.params.diveThreshold;
        this.positions[candidate.name] = success ? 2 : 1;
        return { roll, success };
    }
    aiMode(candidate) {
        return Math.random() < 0.2 + 0.07 * candidate.attributes.SWI ? SwimMode.SOLO : SwimMode.GROUP;
    }
    /**
     * Joue un tour pour tous les candidats encore en course.
     * @param {string} playerName nom du joueur
     * @param {string} playerMode SwimMode choisi par le joueur (ignoré s'il est déjà arrivé)
     * @returns {string} compte rendu du tour du joueur ("" s'il n'est plus en course)
     */
    playRound(playerName, playerMode) {
        const active = this.candidates.filter((c) => !this.hasArrived(c.name));
        const modes = {};
        active.forEach((c) => { modes[c.name] = c.isPlayer ? playerMode : this.aiMode(c); });

        const moves = {};
        var playerLog = "";
        active.forEach((c) => {
            var log;
            if (modes[c.name] == SwimMode.SOLO) {
                const roll = c.rollStat("SWI");
                const ok = roll.total >= this.params.soloThreshold;
                moves[c.name] = ok ? 2 : 1;
                log = "Vous nagez seul (" + this.rollToString("SWI", roll, this.params.soloThreshold) + ") : "
                    + (ok ? "belle coulée, vous avancez de 2 cases." : "vous peinez, vous n'avancez que d'une case.");
            } else {
                const roll = c.rollStat("SOC");
                const ok = roll.total >= this.params.groupThreshold;
                moves[c.name] = 1;
                const companion = this.pickCompanion(c, active, modes);
                if (companion) {
                    // L'opinion du compagnon envers le nageur évolue
                    if (ok) {
                        companion.changeRelation(c.name, RelationGauge.AFF, 1);
                    } else {
                        companion.changeRelation(c.name, RelationGauge.REP, -1);
                    }
                }
                const withWho = companion ? companion.name : "les autres";
                log = "Vous nagez avec " + withWho + " (" + this.rollToString("SOC", roll, this.params.groupThreshold) + ") : "
                    + (ok ? "la complicité est là, vous avancez d'une case." : withWho + " doit aider " + mark(c.name) + ", qui avance d'une case mais perd en estime.");
            }
            if (c.isPlayer) {
                playerLog = log;
            }
        });

        Object.keys(moves).forEach((name) => { this.positions[name] += moves[name]; });

        // Arrivées de ce tour : le plus avancé d'abord, égalités tirées au hasard
        shuffle(active.filter((c) => this.positions[c.name] >= this.length))
            .sort((a, b) => this.positions[b.name] - this.positions[a.name])
            .forEach((c) => this.arrived.push(c.name));
        return playerLog;
    }
    /** Compagnon de nage : de préférence un autre nageur en mode GROUP, sinon quelqu'un de la même case, sinon n'importe qui. */
    pickCompanion(swimmer, active, modes) {
        const others = active.filter((c) => c !== swimmer);
        if (!others.length) {
            return null;
        }
        var pool = others.filter((c) => modes[c.name] == SwimMode.GROUP);
        if (!pool.length) {
            pool = others.filter((c) => this.positions[c.name] == this.positions[swimmer.name]);
        }
        if (!pool.length) {
            pool = others;
        }
        // Choix d'un non-joueur (ou du nageur) : décision individuelle positive, au score relationnel
        return decide({ deciders: [swimmer], options: pool, context: DecisionContext.POSITIVE });
    }
    /** Termine la course pour les candidats restants (sans le joueur, déjà arrivé). */
    finishRemaining() {
        var guard = 0;
        while (this.arrived.length < this.candidates.length && guard++ < 100) {
            this.playRound(null, null);
        }
    }
    /**
     * Bonus/malus de REP selon le rang (voir Challenge.rankReward) : 1er +5, 2e +4, avant-dernier -4, dernier -5.
     * @returns {Object} { nom: delta } (les autres rangs n'ont ni bonus ni malus)
     */
    rankRewards() {
        const n = this.arrived.length;
        const rewards = {};
        this.arrived.forEach((name, i) => {
            rewards[name] = this.rankReward(i, n);
        });
        return rewards;
    }
    rankOf(name) {
        return this.arrived.indexOf(name) + 1;
    }
}

export { SwimRace, SwimMode }
