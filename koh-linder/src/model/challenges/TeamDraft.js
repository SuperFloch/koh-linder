import { mark, il, accord } from "../Personalize";
import { shuffle } from "../CandidateGenerator";
import { decide, DecisionContext } from "../Decision";
import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { HistoryType } from "../GameHistory";
import { TeamColor } from "../Team";
import { Challenge } from "./Challenge";

const DEFAULT_PARAMS = {
    source: "FIRE_COURSE" // épreuve dont les vainqueurs (un duo mixte) deviennent chefs d'équipe : game.results[source].winners
};

/**
 * Formation des deux équipes (rouge et jaune). Les deux vainqueurs de l'épreuve précédente se séparent et deviennent chacun
 * chef d'une équipe. Les chefs choisissent à tour de rôle un candidat, la cheffe (femme) commençant. Chaque chef alterne les
 * sexes, en commençant par le sexe opposé au sien, afin que chaque équipe finisse avec autant d'hommes que de femmes.
 *
 * - Choix d'un chef non-joueur : décision COLLECTIVE de l'équipe (scores relationnels de tous ses membres additionnés,
 *   + d6 par option, meilleur score gagne) ; seules les relations comptent, jamais les stats.
 * - Chef joueur : il clique sur le portrait voulu (parmi le sexe attendu et les candidats encore libres) avant de swiper pour
 *   valider ; il ne peut pas prendre un candidat déjà choisi par l'autre équipe.
 * - Joueur non chef : chaque swipe fait jouer un tour (un choix par chef), il est choisi comme les autres.
 *
 * À la fin, chaque équipe reçoit un nom tribal aléatoire (resources/team_names.json).
 *
 * Variables de texte : {chiefRed}, {chiefYellow}, {firstChief}, {draftLog}, {draftPrompt}, {draftAction},
 * {teamRedName}, {teamYellowName}, {playerTeamText}.
 */
class TeamDraft extends Challenge {
    static get ID() {
        return "TEAM_DRAFT";
    }
    constructor(params) {
        super(TeamDraft.ID, { ...DEFAULT_PARAMS, ...(params || {}) });
        this.visible = true;
        this.display = "DRAFT_PICKER";
        this.candidates = [];
        // Ordre des chefs : la cheffe commence. Par chef : { name, color, needSex, members: [noms] }
        this.chiefs = [];
        this.pool = [];          // noms des candidats pas encore choisis
        this.pickCount = 0;
        this.selection = null;   // nom du candidat sélectionné par le joueur chef
        this.log = "";
    }

    // --- Interface Challenge ---

    start(game) {
        const source = game.results[this.params.source];
        if (!source || source.winners.length != 2) {
            throw new Error("TeamDraft : il faut deux vainqueurs dans les résultats de " + this.params.source);
        }
        this.candidates = game.candidates.filter((c) => !c.eliminated);
        const [colorA, colorB] = shuffle([TeamColor.RED, TeamColor.YELLOW]);
        const chiefs = source.winners.map((n) => game.getEntityByName(n));
        // La cheffe (sexe F) choisit en premier
        chiefs.sort((a, b) => (a.sex == "F" ? 0 : 1) - (b.sex == "F" ? 0 : 1));
        this.chiefs = chiefs.map((c, i) => {
            const color = i == 0 ? colorA : colorB;
            c.team = color;
            const team = game.teams.find((t) => t.color == color);
            team.leader = c.name;
            return { name: c.name, color, needSex: c.sex == "M" ? "F" : "M", members: [c.name] };
        });
        const chiefNames = this.chiefs.map((c) => c.name);
        this.pool = this.candidates.filter((c) => !chiefNames.includes(c.name)).map((c) => c.name);
        // Nombre d'équipiers choisis par chaque chef
        this.perChief = Math.floor(this.pool.length / 2);

        const byColor = (color) => this.chiefs.find((c) => c.color == color).name;
        game.vars.chiefRed = byColor(TeamColor.RED);
        game.vars.chiefYellow = byColor(TeamColor.YELLOW);
        game.vars.firstChief = this.chiefs[0].name;
        game.vars.draftLog = "";
        this.refresh(game);
    }
    /** Avance les choix automatiques jusqu'au premier tour du joueur (s'il est chef). */
    update(game, effect) {
        if (this.playerChief(game)) {
            this.log = this.advance(game, false);
        }
        this.publish(game);
    }
    /**
     * Tour de formation : le joueur chef valide son choix (portrait cliqué), puis les autres choisissent.
     * Renvoie la même carte tant que les équipes ne sont pas complètes, sinon `card.challenge.onFinish`.
     */
    playTurn(game, leftOrRight, card) {
        const lines = [];
        if (this.isPlayerTurn(game)) {
            if (!this.isSelectable(game, this.selection)) {
                this.log = "Cliquez d'abord sur le portrait du candidat souhaité dans votre équipe, puis swipez pour valider.";
                this.publish(game);
                return "ID:" + card.id;
            }
            lines.push(this.pick(game, this.currentChief(), this.selection));
            this.selection = null;
            lines.push(this.advance(game, false));
        } else {
            // Joueur non chef : un tour = un choix par chef
            lines.push(this.advance(game, true));
        }
        this.log = lines.filter((l) => l).join("\n");
        this.publish(game);
        return this.isComplete() ? card.challenge.onFinish : "ID:" + card.id;
    }
    /** Donne un nom tribal à chaque équipe. */
    end(game) {
        const names = shuffle(game.content.resources.team_names.values);
        game.teams.forEach((team, i) => {
            if (team.leader) {
                team.name = names[i % names.length];
            }
        });
        const nameOf = (color) => game.teams.find((t) => t.color == color).name;
        game.vars.teamRedName = nameOf(TeamColor.RED);
        game.vars.teamYellowName = nameOf(TeamColor.YELLOW);
        const player = game.getEntityByName("{player}");
        const label = player.team == TeamColor.RED ? "Rouges" : "Jaunes";
        game.vars.playerTeamLabel = label;
        game.vars.playerTeamName = nameOf(player.team);
        game.vars.playerTeamText = "Vous faites partie des " + label + ", l'équipe des " + nameOf(player.team) + ".";
        // Les équipes sont formées : chaque membre gagne +1 AFF envers chacun des autres membres de son équipe
        game.applyEffect({ type: EffectType.TEAM_RELATION, target: "ALL", gauge: RelationGauge.AFF, value: 1 });
        this.visible = false;
    }

    // --- Règles ---

    isComplete() {
        return this.pool.length == 0;
    }
    /** Chef dont c'est le tour (les chefs alternent, la cheffe en premier). */
    currentChief() {
        return this.chiefs[this.pickCount % 2];
    }
    /** Le chef contrôlé par le joueur, s'il y en a un. */
    playerChief(game) {
        const player = game.getEntityByName("{player}");
        return this.chiefs.some((c) => c.name == player.name) ? player : null;
    }
    isPlayerTurn(game) {
        const chief = this.playerChief(game);
        return !!chief && !this.isComplete() && this.currentChief().name == chief.name;
    }
    /** Un candidat est sélectionnable s'il est libre et du sexe attendu pour ce tour (jamais un déjà choisi par l'autre équipe). */
    isSelectable(game, name) {
        if (!name || !this.pool.includes(name) || !this.isPlayerTurn(game)) {
            return false;
        }
        return game.getEntityByName(name).sex == this.currentChief().needSex;
    }
    /** Appelé quand le joueur clique sur un portrait. */
    select(game, name) {
        if (this.isSelectable(game, name)) {
            this.selection = this.selection == name ? null : name;
            this.refresh(game);
        }
    }
    /**
     * Joue des choix automatiques. `oneRound` : un choix par chef (joueur non chef) ; sinon jusqu'au tour du joueur chef.
     * @returns {string} compte rendu des choix effectués
     */
    advance(game, oneRound) {
        const lines = [];
        var made = 0;
        while (!this.isComplete()) {
            if (this.isPlayerTurn(game)) {
                break;
            }
            if (oneRound && made >= 2) {
                break;
            }
            const chief = this.currentChief();
            lines.push(this.pick(game, chief, this.choose(game, chief)));
            made++;
        }
        return lines.join("\n");
    }
    /** Choix d'un chef non-joueur : décision collective de son équipe, au meilleur score relationnel. */
    choose(game, chief) {
        const members = chief.members.map((n) => game.getEntityByName(n));
        const options = this.pool.map((n) => game.getEntityByName(n)).filter((c) => c.sex == chief.needSex);
        return decide({ deciders: members, options, context: DecisionContext.POSITIVE }).name;
    }
    /** Enregistre le choix d'un candidat par un chef. */
    pick(game, chief, name) {
        const candidate = game.getEntityByName(name);
        candidate.team = chief.color;
        // Rang de ce choix pour ce chef (0 = premier équipier choisi ; le chef lui-même n'est pas compté)
        const order = chief.members.length - 1;
        chief.members.push(name);
        this.pool = this.pool.filter((n) => n != name);
        chief.needSex = chief.needSex == "M" ? "F" : "M";
        this.pickCount++;
        this.applyPickRelations(game, chief, candidate, order);
        const player = game.getEntityByName("{player}");
        if (chief.name == player.name) {
            return "Vous choisissez " + name + ".";
        }
        return candidate.isPlayer ? chief.name + " choisit " + mark(candidate.name) + " dans son équipe !" : chief.name + " choisit " + name + ".";
    }
    /**
     * Conséquences relationnelles d'un choix (échelle de référence) :
     * - 1er équipier choisi par un chef : +3 AFF envers le chef, +2 REP auprès de tout le monde ;
     * - 2e : +2 AFF envers le chef ; les suivants : +1 AFF, sauf le dernier de l'équipe (rien) ;
     * - le dernier choisi de chaque sexe (le choix qui vide le sexe dans le groupe restant) : -2 REP auprès de tout le monde.
     * Les changements de plus de 1 s'inscrivent dans l'historique (type TEAM_SELECTION).
     */
    applyPickRelations(game, chief, candidate, order) {
        const name = candidate.name;
        const rel = (gauge, target, about, value, description) => game.applyEffect({
            type: EffectType.RELATION, gauge, target, about, value, historyType: HistoryType.TEAM_SELECTION, description
        });
        const last = order == this.perChief - 1;
        if (order == 0) {
            rel(RelationGauge.AFF, name, chief.name, 3, name + " est " + (candidate.sex == "F" ? "la première choisie" : "le premier choisi") + " par " + chief.name + " : " + il(candidate) + " lui en est reconnaissant" + (candidate.sex == "F" ? "e" : ""));
            rel(RelationGauge.REP, "ALL", name, 2, name + " est " + accord(candidate, "choisi") + " en premier par " + chief.name + " : tout le monde " + (candidate.sex == "F" ? "la" : "le") + " remarque");
        } else if (order == 1) {
            rel(RelationGauge.AFF, name, chief.name, 2, name + " est " + (candidate.sex == "F" ? "la deuxième choisie" : "le deuxième choisi") + " par " + chief.name);
        } else if (!last) {
            rel(RelationGauge.AFF, name, chief.name, 1);
        }
        // Dernier choisi de son sexe : il n'en reste plus de ce sexe dans le groupe
        if (this.pool.every((n) => game.getEntityByName(n).sex != candidate.sex)) {
            rel(RelationGauge.REP, "ALL", name, -2, name + " est " + (candidate.sex == "M" ? "le dernier homme choisi" : "la dernière femme choisie") + " : tout le monde " + (candidate.sex == "F" ? "la" : "le") + " remarque");
        }
    }
    avatarBorder(candidate) {
        return null;
    }
    /** Variables de texte et statut du tour courant. */
    refresh(game) {
        game.vars.draftLog = this.log;
        if (this.isComplete()) {
            game.vars.draftPrompt = "Les équipes sont formées !";
            game.vars.draftAction = "Continuer";
        } else if (this.isPlayerTurn(game)) {
            const sex = this.currentChief().needSex == "M" ? "un homme" : "une femme";
            game.vars.draftPrompt = "À vous de choisir " + sex + " : cliquez sur son portrait, puis swipez pour valider.";
            game.vars.draftAction = this.selection ? "Choisir " + this.selection : "Choisissez un candidat";
        } else {
            game.vars.draftPrompt = this.currentChief().name + " et l'autre chef vont choisir leurs équipiers.";
            game.vars.draftAction = "Continuer";
        }
    }
    publish(game) {
        this.refresh(game);
    }
}

export { TeamDraft }
