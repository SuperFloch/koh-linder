import { Card, CardType } from "./Card";
import { EffectType } from "./Effect";
import { Team, TeamColor } from "./Team";
import { RelationGauge } from "./Character";
import { generateCandidates, pick, shuffle } from "./CandidateGenerator";
import { createChallenge } from "./challenges";
import { GameHistory, HistoryType } from "./GameHistory";
const GAME_DEFAULT_DURATION = 40;
class Game {
    /**
     * @param {Object} content contenu chargé par ContentLoader (start, cards, characters, resources)
     * @param {Character} playerCharacter personnage incarné par le joueur
     */
    constructor(content, playerCharacter, options) {
        options = options || {};
        this.content = content;
        // Mode débogage « épreuve seule » : partie lancée sur une épreuve précise (pas de Koh-points à la fin)
        this.debug = !!options.debug;
        // Dernière carte d'une épreuve lancée seule : après elle, la partie se termine
        this.standaloneEnd = options.standaloneEnd || null;
        // Avant la réunification, les épreuves tirées au sort sont d'équipe ; après, individuelles
        this.reunified = false;
        // Épreuves tirées au sort déjà jouées (on évite de les rejouer tant qu'il en reste d'autres)
        this.playedChallenges = [];
        // Cartes de retour : quand une épreuve tirée au sort se termine (next "RETURN"), on reprend la carte empilée ici
        this.returnStack = [];
        // Dernière épreuve tirée au sort (entrée du catalogue) et candidats écartés de son déroulé (avantage numérique)
        this.lastChallenge = null;
        this.sitOut = [];
        // Équipe immunisée au prochain conseil (épreuve d'immunité gagnée), null si aucune
        this.immuneTeam = null;
        this.cardPile = content.cards;
        this.candidates = generateCandidates(content.characters, content.resources, playerCharacter);
        this.dayCount = GAME_DEFAULT_DURATION;
        // Jour in-game (la partie commence le jour 1, sur le bateau) et période de la journée (null avant la vie de camp)
        this.currentDay = 1;
        this.period = null;

        this.currentInterlocutor = "";
        // Compte rendu du dernier tour d'une épreuve d'équipe : une section par équipe { color, mine, text } (voir InGamePage)
        this.logSections = [];
        // Variables disponibles dans les textes des cartes : {region}, {lastRoll}...
        this.vars = {
            region: pick(content.resources.regions.values),
            lastRoll: ""
        };
        // Épreuves en cours, par identifiant (voir model/challenges). Elles alimentent `vars` avec leurs propres variables.
        this.challenges = {};
        // Résultats des épreuves terminées, par identifiant d'épreuve (ex: results.FIRE_COURSE.winners), pour les épreuves suivantes
        this.results = {};
        // Mémoire des évènements marquants (achievements, journal de fin de partie)
        this.history = new GameHistory();
        // Cartes de personnage déclenchées par les jets du joueur, à montrer avant la suite ; carte à reprendre ensuite
        this.pendingCards = [];
        this.resumeCard = null;

        this.finished = false;
        this.cardQueue = [];
        this.currentCardIndex = 0;

        // Les équipes existent mais aucun candidat n'en fait partie au début : elles sont attribuées à la fin de la première épreuve
        this.teams = [new Team(TeamColor.RED), new Team(TeamColor.YELLOW)];

        if (options.randomTeams) {
            this.assignRandomTeams();
        }

        var startCard = this.cardPile.find((c) => c.id == (options.startCard || content.start));
        if (startCard) {
            this.cardQueue.push(startCard);
            this.enterCard(startCard);
        } else {
            console.error("Carte de départ introuvable :", content.start);
            this.finished = true;
        }
    }
    /**
     * Koh-points gagnés à la fin de la partie : 1 par jour de survie dans l'aventure.
     */
    get kohPointsEarned() {
        return this.currentDay;
    }
    get currentCard() {
        return this.cardQueue[this.currentCardIndex];
    }
    right() {
        this.next("right");
    }
    left() {
        this.next("left");
    }
    next(leftOrRight) {
        var currentCard = this.currentCard;
        if (this.finished || !currentCard) {
            return;
        }
        var choice = currentCard.choices[leftOrRight];
        (choice.effects || []).forEach((e) => { this.applyEffect(e); });

        var nextString = choice.next;
        if (this.standaloneEnd && currentCard.id == this.standaloneEnd) {
            nextString = "END";
        } else if (currentCard.type == CardType.DICE) {
            nextString = this.rollDice(currentCard.dice);
        } else if (currentCard.type == CardType.CHALLENGE_TURN) {
            nextString = this.getChallenge(currentCard.challenge.id).playTurn(this, leftOrRight, currentCard);
        }
        var nextCard = this.getNextCard(nextString, currentCard);
        if (this.pendingCards.length) {
            // Une carte de personnage a été déclenchée par un jet du joueur : elle s'intercale avant la suite
            this.resumeCard = nextCard;
            nextCard = this.pendingCards.shift();
        }
        if (nextCard) {
            this.cardQueue.push(nextCard);
            this.currentCardIndex++;
            this.enterCard(nextCard);
        } else {
            this.finished = true;
        }
    }
    /**
     * Applique les effets `on_enter` d'une carte dès qu'elle devient la carte courante.
     */
    enterCard(card) {
        (card.on_enter || []).forEach((e) => { this.applyEffect(e); });
    }
    /**
     * Épreuve en cours dont le score d'avancement doit être affiché au-dessus de la carte (null si aucune).
     */
    get activeChallenge() {
        return Object.values(this.challenges).find((c) => c.visible) || null;
    }
    /**
     * Épreuve en cours désignée par son identifiant (propriété `target` des effets et `challenge.id` des cartes).
     */
    getChallenge(id) {
        var challenge = this.challenges[id];
        if (!challenge) {
            throw new Error("Épreuve non démarrée : " + id);
        }
        return challenge;
    }
    /**
     * Résout le jet de dé d'une carte DICE et renvoie le `next` à suivre.
     * Le détail du jet est disponible dans {lastRoll}.
     */
    rollDice(dice) {
        var entity = this.getEntityByName(dice.entity);
        var roll = entity.rollStat(dice.stat);
        var success = roll.total >= Number(dice.threshold);
        this.vars.lastRoll = dice.stat + " " + roll.bonus + " + d20 " + roll.d20 + " = " + roll.total + " / " + dice.threshold;
        return success ? dice.success : dice.fail;
    }
    applyEffect(effect) {
        switch (effect.type) {
            case EffectType.ENERGY:
                this.getTargets(effect.target, effect.about).forEach((c) => c.changeEnergy(effect.value));
                break;
            case EffectType.RELATION:
                var about = this.getEntityByName(effect.about || "{player}");
                var gauge = effect.gauge || RelationGauge.AFF;
                var relationTargets = this.getTargets(effect.target, effect.about);
                relationTargets.forEach((c) => c.changeRelation(about.name, gauge, effect.value));
                // Tout changement de plus de 1 en AFF ou en REP s'inscrit dans l'historique (sauf `history: false`,
                // quand l'appelant inscrit lui-même une entrée groupée)
                if (effect.history !== false && Math.abs(Number(effect.value)) > 1) {
                    this.recordRelationChange(effect, about, gauge, relationTargets);
                }
                break;
            case EffectType.SET_INTERLOCUTOR:
                if (effect.target == "RANDOM") {
                    var others = this.candidates.filter((c) => !c.isPlayer && !c.eliminated);
                    this.currentInterlocutor = pick(others).name;
                } else {
                    this.currentInterlocutor = this.getEntityByName(effect.target).name;
                }
                break;
            // Effets d'épreuve : `target` = identifiant de l'épreuve, la logique est dans model/challenges
            case EffectType.CHALLENGE_START:
                // effect.params : surcharge des paramètres de l'épreuve
                var challenge = createChallenge(effect.target, effect.params);
                this.challenges[effect.target] = challenge;
                challenge.game = this; // pour les cartes de personnage déclenchées par les jets (Challenge.rollWithCards)
                challenge.start(this);
                break;
            case EffectType.CHALLENGE_MOVE:
                this.getChallenge(effect.target).move(this, effect);
                break;
            case EffectType.CHALLENGE_UPDATE:
                this.getChallenge(effect.target).update(this, effect);
                break;
            case EffectType.CHALLENGE_END:
                this.getChallenge(effect.target).end(this);
                break;
            case EffectType.CHALLENGE_CLOSE:
                this.getChallenge(effect.target).close(this);
                delete this.challenges[effect.target];
                break;
            case EffectType.TEAM_RELATION:
                this.applyTeamRelation(effect);
                break;
            case EffectType.PICK_TEAMMATES:
                var pool = this.teamMembers(this.resolveTeamColor(effect.target)).filter((c) => !(effect.excludePlayer && c.isPlayer));
                shuffle(pool).slice(0, Number(effect.value)).forEach((c, i) => { this.vars[effect.vars[i]] = c.name; });
                break;
            case EffectType.ELIMINATION:
                this.getEntityByName(effect.target).eliminated = true;
                break;
        }
    }
    /**
     * @param {string} nextString valeur du champ `next` : "ID:x", "THEME:X", "TEST:...", "END" ou vide
     * @param {Card} currentCard carte qui vient d'être jouée (sert au tirage dans le même thème si `next` est vide)
     * @returns {Card|null} null si la pile est épuisée ou fin
     */
    getNextCard(nextString, currentCard) {
        nextString = nextString || "";
        var tokens = nextString.split(":");

        switch (tokens[0]) {
            case "CHALLENGE": {
                // CHALLENGE:<TEAM|INDIVIDUAL>:<id de la carte de retour> : lance une épreuve tirée au sort, puis reprend la carte de retour
                const entry = this.drawChallenge(tokens[1]);
                if (!entry) {
                    return this.cardPile.find((c) => c.id == tokens[2]) || null;
                }
                this.returnStack.push(tokens[2]);
                const startCard = this.cardPile.find((c) => c.id == entry.start) || null;
                // Équipes inégales (éliminations) : tirage au sort des participants de l'équipe en avantage numérique
                const benched = startCard && entry.context == "TEAM" ? this.drawSitOut() : [];
                return benched.length ? this.sitOutCard(benched, startCard) : startCard;
            }
            case "RETURN": {
                // Fin d'une épreuve tirée au sort : retour à la carte empilée (rien si l'épreuve a été lancée seule)
                this.sitOut = [];
                const camp = this.challenges.CAMP_LIFE;
                if (camp && this.lastChallenge) {
                    camp.onChallengeReturn(this);
                }
                const returnId = this.returnStack.pop();
                return returnId ? (this.cardPile.find((c) => c.id == returnId) || null) : null;
            }
            case "RESUME":
                // Fin d'une carte de personnage intercalée : suivante en attente, sinon la carte qui était prévue
                if (this.pendingCards.length) {
                    return this.pendingCards.shift();
                }
                var resume = this.resumeCard;
                this.resumeCard = null;
                return resume || null;
            case "":
                // Vide : une autre carte, au hasard, du même thème
                return this.drawFromTheme(currentCard.theme, currentCard.id);
            case "END":
                return null;
            case "ID":
                var found = this.cardPile.find(c => c.id == tokens[1]);
                if (!found) {
                    console.error("Carte introuvable :", tokens[1]);
                }
                return found || null;
            case "THEME":
                return this.drawFromTheme(tokens[1], currentCard ? currentCard.id : null);
            case "TEST":
                // TEST:Entity_Name:STAT:VALUE:Success_Event:Fail_Event
                var peopleToTest = this.getEntityByName(tokens[1]);
                return peopleToTest.getStatTestCard(tokens[2], tokens[3], tokens[4].split("§").join(":"), tokens[5].split("§").join(":"));
            default:
                console.error("Valeur de next inconnue :", nextString);
                return null;
        }
    }
    drawFromTheme(theme, excludedId) {
        var usedIds = this.cardQueue.filter(c => c.single_use).map(c => c.id);
        var possibleCards = this.cardPile.filter(c => c.theme == theme && c.id != excludedId && !usedIds.includes(c.id));
        if (!possibleCards.length) {
            return null;
        }
        return pick(possibleCards);
    }
    /**
     * Inscrit une entrée dans l'historique.
     * @param {string} type HistoryType
     * @param {Array} participants candidats impliqués (objets Candidate ou noms)
     * @param {string} description texte du journal (accepte les variables {player}, {interlocutor}...)
     * @param {Object} [data] détails optionnels pour les achievements
     */
    record(type, participants, description, data) {
        const entities = participants.map((p) => (typeof p == "string" ? this.getEntityByName(p) : p));
        // Équipes des participants au moment de l'évènement (le journal masque les évènements de l'équipe adverse)
        return this.history.add(type, entities.map((e) => e.id), this.format(description), this.currentDay, data, entities.map((e) => e.team));
    }
    /**
     * Entrée d'historique d'un effet RELATION de plus de 1. Type et description peuvent être donnés par l'effet
     * (`historyType`, `description`) ; sinon : AFF + = GOOD_MOMENT, AFF - = DISPUTE, REP + = CHALLENGE_SUCCESS,
     * REP - = CHALLENGE_FAILURE. Les participants sont le candidat concerné (`about`) et la cible si elle est unique.
     */
    recordRelationChange(effect, about, gauge, targets) {
        const value = Number(effect.value);
        const positive = value > 0;
        const type = effect.historyType || (gauge == RelationGauge.AFF
            ? (positive ? HistoryType.GOOD_MOMENT : HistoryType.DISPUTE)
            : (positive ? HistoryType.CHALLENGE_SUCCESS : HistoryType.CHALLENGE_FAILURE));
        const single = effect.target != "ALL" && effect.target != "TEAM" && targets.length == 1 ? targets[0] : null;
        const participants = single ? [about, single] : [about];
        var description = effect.description;
        if (!description) {
            const withWho = single ? " avec " + single.name : "";
            description = gauge == RelationGauge.AFF
                ? (positive ? about.name + " se rapproche" + (single ? " de " + single.name : " des autres") : "Dispute de " + about.name + withWho)
                : (positive ? about.name + " gagne en considération" + (single ? " auprès de " + single.name : "") : about.name + " perd en considération" + (single ? " auprès de " + single.name : ""));
        }
        return this.record(type, participants, description, { gauge, value });
    }
    /**
     * Résout la cible d'un effet en liste de candidats.
     * "ALL" = tous les autres candidats encore en jeu, "TEAM" = coéquipiers de `about` (hors `about`).
     */
    getTargets(target, about) {
        var aboutEntity = this.getEntityByName(about || "{player}");
        var others = this.candidates.filter((c) => !c.eliminated && c !== aboutEntity);
        switch (target) {
            case "ALL":
                return others;
            case "TEAM":
                return others.filter((c) => c.team != TeamColor.NONE && c.team == aboutEntity.team);
            default:
                var entity = this.getEntityByName(target);
                return entity ? [entity] : [];
        }
    }
    /**
     * Tire au hasard une épreuve du catalogue (content.challenges, marquées `random`) pour le contexte donné :
     * "TEAM" avant la réunification, "INDIVIDUAL" après. Les épreuves déjà jouées sont évitées tant qu'il en reste d'autres.
     * @returns {Object|null} l'entrée du catalogue, ou null s'il n'y en a aucune pour ce contexte
     */
    drawChallenge(context) {
        const pool = (this.content.challenges || []).filter((ch) => ch.random && ch.context == context);
        if (!pool.length) {
            return null;
        }
        const fresh = pool.filter((ch) => !this.playedChallenges.includes(ch.id));
        const entry = pick(fresh.length ? fresh : pool);
        this.playedChallenges.push(entry.id);
        this.lastChallenge = entry;
        delete this.results[entry.id]; // pas de résultat périmé d'une partie précédente de la même épreuve
        return entry;
    }
    /**
     * Avantage numérique (après des éliminations) : l'équipe la plus nombreuse tire au sort ses participants. Un sac contient autant
     * de boules blanches que de candidats dans l'équipe adverse, le reste en noires ; chacun pioche sans remise. Les blancs
     * participent, les noirs sont écartés de l'épreuve (`sitOut`).
     * @returns {Candidate[]} les candidats écartés (liste vide si les équipes sont à égalité)
     */
    drawSitOut() {
        this.sitOut = [];
        const sizes = this.teams.map((t) => ({ color: t.color, members: this.teamMembers(t.color) })).filter((t) => t.members.length > 0);
        if (sizes.length < 2) {
            return [];
        }
        const smallest = Math.min(...sizes.map((t) => t.members.length));
        const benched = [];
        sizes.filter((t) => t.members.length > smallest).forEach((t) => {
            // Le tirage sans remise revient à mélanger les candidats : les `smallest` premiers ont une boule blanche
            benched.push(...shuffle(t.members).slice(smallest));
        });
        this.sitOut = benched.map((c) => c.name);
        return benched;
    }
    /** Carte de Denis qui annonce les candidats écartés (boules noires) avant le début de l'épreuve. */
    sitOutCard(benched, nextCard) {
        const player = this.getEntityByName("{player}");
        const names = benched.map((c) => c.name);
        const list = names.length > 1 ? names.slice(0, -1).join(", ") + " et " + names[names.length - 1] : names[0];
        const team = this.teams.find((t) => t.color == benched[0].team);
        const label = team && team.name ? "L'équipe des " + team.name : "Une équipe";
        const yours = player.team == benched[0].team
            ? (names.includes(player.name) ? "Vous piochez une boule noire. " : "Vous piochez une boule blanche. ")
            : "";
        return Card.deserialize({
            id: "sitout_" + this.playedChallenges.length,
            single_use: false,
            name: "Denis Brognard",
            type: "NARRATION",
            theme: "TIRAGE_AU_SORT",
            img: "",
            text: label + " est plus nombreuse. Chacun pioche une boule dans le sac : blanche, on participe ; noire, on reste au bord. " + yours
                + "« " + list + ", vous ne participerez pas à cette épreuve. »",
            choices: {
                left: { text: "Suivant", next: "ID:" + nextCard.id },
                right: { text: "Suivant", next: "ID:" + nextCard.id }
            }
        });
    }
    /** Membres d'une équipe qui participent à l'épreuve en cours (hors candidats écartés par le tirage au sort). */
    activeMembers(color) {
        return this.teamMembers(color).filter((c) => !this.sitOut.includes(c.name));
    }
    /** Contexte des épreuves du jour : TEAM tant que les équipes ne sont pas réunies, puis INDIVIDUAL. */
    get challengeContext() {
        return this.reunified ? "INDIVIDUAL" : "TEAM";
    }
    /**
     * Répartit les candidats en deux équipes (rouge / jaune) équilibrées en hommes et en femmes, avec un chef par équipe et un
     * nom tribal (utilisé par le lancement d'une épreuve seule en débogage).
     */
    assignRandomTeams() {
        const names = shuffle(this.content.resources.team_names.values);
        const colors = [TeamColor.RED, TeamColor.YELLOW];
        // Un seul tirage par sexe, coupé en deux moitiés (une par équipe)
        const groups = { M: shuffle(this.candidates.filter((c) => c.sex == "M")), F: shuffle(this.candidates.filter((c) => c.sex == "F")) };
        colors.forEach((color, i) => {
            const members = [];
            ["M", "F"].forEach((sex) => {
                const group = groups[sex];
                const take = Math.ceil(group.length / 2);
                members.push(...(i == 0 ? group.slice(0, take) : group.slice(take)));
            });
            members.forEach((c) => { c.team = color; });
            const team = this.teams.find((t) => t.color == color);
            team.leader = members[0].name;
            team.name = names[i];
        });
    }
    /**
     * Cartes de personnage : une carte du candidat associée à ce contexte de jet ET à cette valeur de d20 (valeur naturelle,
     * avant bonus) remplace la résolution classique du jet. S'il y en a plusieurs, une est tirée au hasard.
     * @param {Candidate} candidate
     * @param {string} context un RollContext (WAKE, FISH...)
     * @param {number} d20 valeur obtenue sur le dé
     * @returns {Object|null} la carte du personnage, ou null (résolution classique)
     */
    drawCharacterCard(candidate, context, d20) {
        // `d20` d'une carte : une valeur ou un tableau de valeurs (la carte peut être tirée sur plusieurs valeurs de jet)
        const matching = (candidate.cards || []).filter((c) => c.context == context && [].concat(c.d20).map(Number).includes(d20));
        return matching.length ? pick(matching) : null;
    }
    /**
     * Joue une carte de personnage : applique ses effets (`{self}` désigne le candidat) et, si c'est le joueur, intercale la
     * carte (texte à lire) avant la suite.
     * @returns {string} le texte de la carte (déjà formaté)
     */
    playCharacterCard(candidate, card) {
        const swap = (value) => (typeof value == "string" ? value.split("{self}").join(candidate.name) : value);
        (card.effects || []).forEach((effect) => {
            const resolved = {};
            Object.keys(effect).forEach((key) => { resolved[key] = swap(effect[key]); });
            this.applyEffect(resolved);
        });
        const text = this.format(swap(card.text || ""));
        if (candidate.isPlayer) {
            this.pendingCards.push(Card.deserialize({
                id: "charcard_" + card.id,
                single_use: false,
                name: card.name,
                type: "NARRATION",
                theme: "CHARACTER_CARD",
                text: text,
                choices: {
                    left: { text: "Continuer", next: "RESUME" },
                    right: { text: "Continuer", next: "RESUME" }
                }
            }));
        }
        return text;
    }
    /** Candidats encore en jeu d'une équipe. */
    teamMembers(color) {
        return this.candidates.filter((c) => !c.eliminated && c.team == color);
    }
    /** Couleur d'équipe désignée par "PLAYER_TEAM", "RED", "YELLOW"... */
    resolveTeamColor(target) {
        return target == "PLAYER_TEAM" ? this.getEntityByName("{player}").team : target;
    }
    /** Équipe (objet Team) du candidat. */
    teamOf(candidate) {
        return this.teams.find((t) => t.color == candidate.team) || null;
    }
    /**
     * Effet TEAM_RELATION : liens d'équipe. Chaque membre modifie sa jauge envers chacun des autres membres ; une entrée
     * d'historique groupée par équipe si le changement dépasse 1.
     */
    applyTeamRelation(effect) {
        const gauge = effect.gauge || RelationGauge.AFF;
        const value = Number(effect.value);
        const colors = effect.target == "ALL" ? this.teams.map((t) => t.color) : [this.resolveTeamColor(effect.target)];
        colors.forEach((color) => {
            const members = this.teamMembers(color);
            if (members.length < 2) {
                return;
            }
            members.forEach((a) => members.filter((b) => b !== a).forEach((b) => a.changeRelation(b.name, gauge, value)));
            if (effect.history !== false && Math.abs(value) > 1) {
                const team = this.teams.find((t) => t.color == color);
                const label = team && team.name ? team.name : color;
                const type = effect.historyType || (gauge == RelationGauge.AFF
                    ? (value > 0 ? HistoryType.GOOD_MOMENT : HistoryType.DISPUTE)
                    : (value > 0 ? HistoryType.CHALLENGE_SUCCESS : HistoryType.CHALLENGE_FAILURE));
                const description = (effect.description || "Moment partagé au sein de l'équipe {team}").split("{team}").join(label);
                this.record(type, members, description, { gauge, value, team: color });
            }
        });
    }
    getEntityById(id) {
        return this.candidates.find((c) => c.id == id);
    }
    getEntityByName(name) {
        switch (name) {
            case "{player}":
                return this.candidates.find(c => c.isPlayer);
            case "{interlocutor}":
                return this.candidates.find(c => c.name == this.currentInterlocutor);
            default:
                // "{variable}" : candidat dont le nom est dans game.vars (ex. {bannerA} rempli par PICK_TEAMMATES)
                var varMatch = /^\{(\w+)\}$/.exec(name || "");
                if (varMatch && this.vars[varMatch[1]]) {
                    name = this.vars[varMatch[1]];
                }
                return this.candidates.find(c => c.name == name);
        }
    }
    /**
     * Remplace les variables {player}, {interlocutor}, {region}, {lastRoll}... dans un texte de carte.
     */
    format(text) {
        if (!text) {
            return "";
        }
        var player = this.getEntityByName("{player}");
        var interlocutor = this.getEntityByName("{interlocutor}");
        return text
            .split("{player}").join(player ? player.name : "")
            .split("{interlocutor}").join(interlocutor ? interlocutor.name : "")
            .replace(/\{(\w+)\}/g, (match, key) => (key in this.vars ? this.vars[key] : match));
    }
}
export { Game, GAME_DEFAULT_DURATION }
