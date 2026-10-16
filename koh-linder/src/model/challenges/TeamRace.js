import { shuffle } from "../CandidateGenerator";
import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { HistoryType } from "../GameHistory";
import { TeamCssColor } from "../Team";
import { RaceChallenge } from "./RaceChallenge";

/** Paramètres communs aux épreuves d'équipe (fusionnés sous ceux de chaque épreuve). */
const TEAM_PARAMS = {
    victoryAff: 5, // Victoire collective : +5 AFF mutuel entre les membres de l'équipe gagnante
    heroRep: 5     // Performance décisive : +5 REP auprès de ses coéquipiers pour celui qui apporte la victoire
};

const TEAM_LABELS = { RED: "Rouges", YELLOW: "Jaunes" };

/**
 * Base des épreuves d'équipe en course : les deux équipes jouent en même temps, chaque swipe du joueur fait jouer un tour à
 * son équipe (et à l'équipe adverse). La première équipe qui remplit l'objectif gagne.
 *
 * Minimap : un seul marqueur de progression par équipe, de la couleur de l'équipe (l'équipe du joueur est repérée par la ligne
 * de statut). Les positions sont indexées par couleur d'équipe.
 *
 * Conséquences de la victoire (échelle de référence) : victoire collective +5 AFF mutuel dans l'équipe gagnante et +5 REP pour
 * celui qui apporte la victoire (auprès de ses coéquipiers), toutes deux inscrites dans l'historique. L'équipe perdante ne change
 * pas. (Les récompenses de confort / d'immunité seront ajoutées plus tard.)
 *
 * Variables de texte : {raceLog}, {nextStep}, {stepActionLeft}, {stepActionRight}, {winnerTeamName}, {winnerTeamLabel}, {winnerHero}.
 */
class TeamRace extends RaceChallenge {
    constructor(id, params, length, steps) {
        super(id, { ...TEAM_PARAMS, ...(params || {}) }, length, steps);
        this.colors = [];       // couleurs des équipes engagées
        this.members = {};      // couleur -> candidats
        this.teamNames = {};    // couleur -> nom tribal
        this.playerColor = null;
        this.winner = null;     // couleur de l'équipe gagnante
        this.hero = null;       // nom de celui qui a apporté la victoire
    }

    // --- Mise en place ---

    /** Inscrit les équipes constituées sur la ligne de départ. */
    initTeams(game) {
        game.logSections = [];
        this.candidates = game.candidates.filter((c) => !c.eliminated && c.team != "NONE" && !game.sitOut.includes(c.name));
        this.colors = game.teams.filter((t) => game.activeMembers(t.color).length > 0).map((t) => t.color);
        this.colors.forEach((color) => {
            this.members[color] = game.activeMembers(color);
            this.teamNames[color] = game.teams.find((t) => t.color == color).name;
            this.positions[color] = 0;
        });
        this.playerColor = game.getEntityByName("{player}").team;
    }
    displayPosition(color) {
        return Math.min(this.positions[color], this.length);
    }
    /** Un marqueur par équipe, de la couleur de l'équipe. */
    markersAt(index) {
        return this.colors
            .filter((color) => this.displayPosition(color) == index)
            .map((color) => ({
                key: color,
                text: (TEAM_LABELS[color] || color).charAt(0),
                isPlayer: color == this.playerColor,
                border: color == this.playerColor ? "#fae79d" : null,
                bg: TeamCssColor[color] || null,
                large: false,
                title: "Équipe " + (this.teamNames[color] || color)
            }));
    }
    /** "Votre équipe" ou "Les Jaunes". */
    teamLabel(color) {
        return color == this.playerColor ? "Votre équipe" : "Les " + (TEAM_LABELS[color] || color);
    }
    /** Nombre de cases consécutives de même type devant l'équipe `color`. */
    teamSegment(color) {
        const pos = this.positions[color];
        var n = 0;
        while (this.steps[pos + n] == this.steps[pos]) {
            n++;
        }
        return n;
    }

    // --- Outils de jet d'équipe ---

    /** Jet d'équipe : tous les membres lancent d20 + stat, la somme est comparée au seuil (version compacte du jet joint). */
    teamRoll(members, stat, threshold) {
        const rolls = members.map((member) => ({ member, roll: member.rollStat(stat) }));
        const total = rolls.reduce((sum, r) => sum + r.roll.total, 0);
        return {
            ok: total >= threshold,
            total,
            rolls,
            nat1: rolls.filter((r) => r.roll.d20 == 1).map((r) => r.member),
            text: "(jet d'équipe de " + stat + " : " + total + " / " + threshold + ")"
        };
    }
    /** Candidat de l'équipe avec la plus haute valeur d'une stat (égalités tirées au hasard). */
    best(color, stat, exclude) {
        const pool = shuffle(this.members[color].filter((m) => m.name != exclude));
        return pool.sort((a, b) => b.attributes[stat] - a.attributes[stat])[0];
    }

    // --- Interface Challenge ---

    /** Tour : le joueur donne son swipe, puis toutes les équipes jouent (ordre aléatoire) tant que personne n'a gagné. */
    playTurn(game, leftOrRight, card) {
        // Compte rendu en sections séparées (une par équipe, bordure de sa couleur) : voir InGamePage
        game.logSections = this.playRound(game, leftOrRight);
        game.vars.raceLog = "";
        if (this.winner) {
            return card.challenge.onFinish;
        }
        this.refresh(game);
        return "ID:" + card.id;
    }
    /**
     * Ordre dans lequel les équipes jouent un tour. Règle générale : en cas d'égalité non prévue par les règles, le résultat est
     * favorable au joueur ou à son équipe ; l'équipe du joueur joue donc en premier (elle l'emporte si les deux équipes atteignent
     * l'objectif dans le même tour). Une épreuve dont c'est l'ÉCHEC qui départage (ex. le plongeoir) l'inverse.
     */
    roundOrder() {
        return [this.playerColor, ...this.colors.filter((c) => c != this.playerColor)];
    }
    /** @returns {{color: string, mine: boolean, text: string}[]} une section par équipe, celle du joueur en premier */
    playRound(game, side) {
        const logs = {};
        this.roundOrder().forEach((color) => {
            if (this.winner) {
                return;
            }
            logs[color] = this.actTeam(game, color, side);
        });
        return this.colors
            .filter((color) => logs[color])
            .map((color) => ({ color, mine: color == this.playerColor, text: logs[color] }))
            .sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0));
    }
    /** À définir par l'épreuve : fait agir l'équipe `color` pour ce tour et renvoie un compte rendu. */
    actTeam(game, color, side) {
        return "";
    }
    /** Met à jour les variables de texte (à définir par l'épreuve). */
    refresh(game) { }
    end(game) {
        // Le gagnant est déjà connu (finishRace) ; rien d'autre à résoudre
    }
    close(game) {
        game.logSections = [];
        this.statusText = "";
    }

    // --- Victoire ---

    /**
     * Enregistre la victoire de l'équipe `color`, apportée par `hero` : AFF mutuel de victoire collective, REP du héros
     * (historique), variables de texte et résultats pour la suite.
     */
    finishRace(game, color, hero, heroDescription, raceName) {
        this.winner = color;
        this.hero = hero.name;
        const p = this.params;
        const members = this.members[color];
        const teamName = this.teamNames[color];
        // Victoire collective : +5 AFF mutuel (une seule entrée d'historique)
        members.forEach((a) => members.filter((b) => b !== a).forEach((b) => a.changeRelation(b.name, RelationGauge.AFF, p.victoryAff)));
        game.record(HistoryType.GOOD_MOMENT, members, "Les " + (TEAM_LABELS[color] || color) + " (" + teamName + ") remportent ensemble " + raceName, { gauge: RelationGauge.AFF, value: p.victoryAff, challenge: this.id });
        // Performance décisive : +5 REP pour celui qui apporte la victoire
        // (heroRep à 0 : pas de bonus pour le dernier, la REP ayant déjà été attribuée étape par étape)
        if (p.heroRep) {
            game.applyEffect({
                type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: hero.name, value: p.heroRep,
                historyType: HistoryType.CHALLENGE_SUCCESS, description: heroDescription
            });
        }
        game.vars.winnerTeamName = teamName;
        game.vars.winnerTeamLabel = TEAM_LABELS[color] || color;
        game.vars.winnerHero = hero.name;
        game.results[this.id] = { winner: color, hero: hero.name };
    }
}

export { TeamRace, TEAM_LABELS }
