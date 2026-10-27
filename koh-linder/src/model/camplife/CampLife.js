import { Card } from "../Card";
import { mark } from "../Personalize";
import { pick, shuffle } from "../CandidateGenerator";
import { decide, DecisionContext } from "../Decision";
import { EffectType } from "../Effect";
import { RelationGauge, RollContext } from "../Character";
import { HistoryType } from "../GameHistory";
import { CAMP_PROJECTS } from "../Team";
import { PitchKind, TRACTATION_PARAMS } from "./Tractation";
import { Period, PERIOD_ORDER, PERIOD_LABELS, PERIOD_ACTIONS, PeriodKind, PERIOD_KINDS } from "../Time";
import { Challenge } from "../challenges/Challenge";
import { Council } from "./Council";
import { TalkFlow } from "./CampTalk";

/** Actions possibles pendant la journée. */
const Action = {
    WAKE_CALM: "WAKE_CALM", // réveil, gauche : se lever tranquillement (+énergie, jet de SOC)
    WAKE_RISE: "WAKE_RISE", // réveil, droite : se lever directement (jet de SOC, rencontre un autre lève-tôt)
    FEAST: "FEAST",         // repas : festin
    RATION: "RATION",       // repas : rationner
    PLANTS: "PLANTS",       // récolte : plantes (INT, seuil élevé)
    FISH: "FISH",           // récolte : coquillages (OBS)
    WATER: "WATER",         // ravitaillement : eau
    WOOD: "WOOD",           // ravitaillement : bois
    BUILD: "BUILD",         // camp : une étape du projet de construction en cours (cabane, puis projets supplémentaires)
    FIRE: "FIRE",           // camp : tenter d'allumer le feu (jet joint d'INT à trois)
    TALK: "TALK",           // discussion (jet de SOC avec un candidat présent)
    PAUSE: "PAUSE",         // camp : se reposer
    SWIM: "SWIM",           // mer : se baigner (+2 énergie, +1 AFF entre les baigneurs d'une même équipe)
    HARPOON: "HARPOON"      // récolte (kit de pêche) : pêche au harpon, SWI + OBS difficile
};

/** Nature d'un jour : survie (vie de camp), épreuve de confort, ou épreuve d'immunité suivie d'un conseil. */
const DayKind = {
    SURVIVAL: "SURVIVAL",
    COMFORT: "COMFORT",
    IMMUNITY: "IMMUNITY"
};
/** Cycle de 3 jours à partir du jour 2 : survie, épreuve de confort, épreuve d'immunité + conseil. */
const DAY_CYCLE = [DayKind.SURVIVAL, DayKind.COMFORT, DayKind.IMMUNITY];

/**
 * Cartes nuit : le passage d'un jour à l'autre en tire une par équipe (une pour tous après la réunification). Remplacent tout montant
 * fixe d'énergie de sommeil. `weight` = probabilité en % (le reste est réparti à parts égales entre les cartes sans poids).
 * `energy` : énergie récupérée (`energyCabin` si la cabane est finie) ; `food` : nourriture ajoutée ; `aff` : AFF mutuel gagné par
 * les membres de l'équipe (dure nuit passée ensemble) ; `fireWood` : bois en plus brûlé par un feu allumé ; `cabinMax` : la
 * cabane retombe à cet état de construction si elle était plus avancée.
 */
const NIGHT_CARDS = [
    { id: "PEACEFUL", name: "Nuit paisible", weight: 40, energy: 10, text: "Tous les candidats récupèrent 10 énergie." },
    { id: "RAIN", name: "Pluie nocturne", energy: 2, energyCabin: 5, fireWood: 2, aff: 2,
        text: "Il pleut toute la nuit : seulement 2 énergie récupérée (5 avec une cabane terminée), le feu brûle 2 bois de plus, mais cette dure nuit passée ensemble rapproche l'équipe." },
    { id: "INSECTS", name: "Invasion d'insectes", energy: 4, text: "Des insectes partout : à peine 4 énergie récupérée." },
    { id: "CRABS", name: "Sortie de crabes", energy: 5, food: 7, text: "Une sortie de crabes : 5 énergie récupérée, et 7 nourriture de plus dans la réserve." },
    { id: "STORM", name: "Tempête", energy: 3, cabinMax: 8, aff: 2,
        text: "Une tempête dévaste le camp : 3 énergie récupérée, la cabane est détruite (retour à 8/15), mais la dure nuit passée ensemble rapproche l'équipe." },
    { id: "TURTLES", name: "Migration de tortues", weight: 5, energy: 8, aff: 3, text: "Une migration de tortues émerveille l'équipe : 8 énergie récupérée et un souvenir partagé." }
];

/**
 * Récompenses des épreuves de confort en équipe, dans cet ordre fixe (la i-ème épreuve de confort donne la i-ème récompense à
 * l'équipe gagnante). Une récompense indisponible (l'allumette si un feu est déjà allumé) est sautée.
 */
const COMFORT_REWARDS = ["FISHING_KIT", "MATCH", "FAUNA_GUIDE", "RICE", "HOT_MEAL", "LOCALS_STAY", "FAMILY_CALL"];

/** Noms courts des actions, pour annoncer au joueur ce que ses coéquipiers ont choisi. */
const ACTION_LABELS = {
    WAKE_CALM: "lever tranquille", WAKE_RISE: "lever direct", FEAST: "festin", RATION: "ration",
    PLANTS: "plantes", FISH: "pêche", HARPOON: "harpon", WATER: "eau", WOOD: "bois", BUILD: "construction", FIRE: "feu", TALK: "discussion", PAUSE: "repos", SWIM: "baignade"
};

/** Noms courts des tâches d'un lieu, en détail des options « Forêt », « Rester au camp », « Mer » de la carte boussole. */
const ACTION_SHORT = {
    PLANTS: "plantes", FISH: "coquillages", HARPOON: "harpon", WATER: "eau", WOOD: "bois", BUILD: "construire", FIRE: "feu",
    PAUSE: "repos", SWIM: "baignade", TALK: "discuter"
};
/** Intitulés des options de la carte boussole (le détail — stat, difficulté, gains — est dans des pastilles à part). */
const ACTION_TITLES = {
    WAKE_CALM: "Se lever tranquillement", WAKE_RISE: "Se lever directement", FEAST: "Festin", RATION: "Rationner",
    PLANTS: "Cueillir des plantes", FISH: "Chercher des coquillages", HARPOON: "Pêcher au harpon", WATER: "Chercher de l'eau",
    WOOD: "Ramasser du bois", BUILD: "Construire", FIRE: "Faire du feu", TALK: "Discuter", PAUSE: "Se reposer", SWIM: "Se baigner"
};

/** Les quatre sens de swipe, dans l'ordre d'affichage. */
const DIRECTIONS = ["left", "up", "right", "down"];

/** Nom court et avancement du projet de construction en cours d'un camp, pour les boutons : « Cabane 3/15 · 2 bois ». */
function buildLabel(camp) {
    const id = camp.currentProject();
    if (!id) {
        return "Plus rien à construire";
    }
    const project = CAMP_PROJECTS[id];
    return "Construire : " + project.name + " (" + camp.projectSteps(id) + "/" + project.steps + " · " + project.wood + " bois)";
}

/**
 * Arbre de choix des tâches du matin et de l'après-midi, parcouru en swipant dans les 4 directions : chaque nœud propose jusqu'à
 * quatre options (left / up / right / down) menant à un autre nœud ou à une action. Un `label` peut être une fonction du camp ; une
 * option avec `if` n'est proposée que si la fonction renvoie vrai (ex: harpon, seulement avec le kit de pêche).
 * Gauche : Forêt (bois, eau, nourriture, discuter) · Haut : rester au camp (feu, repos, construire, discuter) · Droite : Mer
 * (coquillages, baignade, harpon, discuter). Une tâche = 2 swipes.
 */
const TALK_OPTION = { label: "Discuter (SOC)", action: Action.TALK };
const TASK_TREE = {
    ROOT: {
        question: "Où passez-vous ce temps ?",
        left: { label: "Forêt", node: "FOREST" },
        up: { label: "Rester au camp", node: "CAMP" },
        right: { label: "Mer", node: "SEA" }
    },
    FOREST: {
        question: "Que faites-vous en forêt ?",
        left: { label: "Bois (+4)", action: Action.WOOD },
        up: { label: (camp) => camp.equipements.waterSource ? "Eau (+5)" : "Chercher une source d'eau (OBS, très difficile)", action: Action.WATER },
        right: { label: "Nourriture (plantes, INT)", action: Action.PLANTS },
        down: TALK_OPTION
    },
    CAMP: {
        question: "Que faites-vous au camp ?",
        left: { label: (camp) => camp.equipements.fire ? "Feu (allumé)" : "Faire du feu (jet joint d'INT, 5 bois min.)", action: Action.FIRE },
        up: { label: buildLabel, action: Action.BUILD },
        right: { label: "Se reposer (+3 énergie)", action: Action.PAUSE },
        down: TALK_OPTION
    },
    SEA: {
        question: "Que faites-vous à la mer ?",
        left: { label: "Chercher des coquillages (OBS)", action: Action.FISH },
        up: { label: "Pêcher au harpon (SWI + OBS, difficile)", action: Action.HARPOON, if: (camp) => camp.equipements.fishingKit },
        right: { label: "Se baigner (+2 énergie)", action: Action.SWIM },
        down: TALK_OPTION
    }
};

/** Choix direct (sans arbre) des périodes de réveil, de repas et de nuit : gauche / droite. */
const DIRECT_CHOICES = {
    WAKE: { question: "Le jour se lève. Comment vous réveillez-vous ?", left: { label: "Se lever tranquillement (+3 énergie)", action: Action.WAKE_CALM }, right: { label: "Se lever directement", action: Action.WAKE_RISE } },
    MEAL: { question: "C'est l'heure de manger. Que préparez-vous ?", left: { label: "Festin (gros bonus, grosse consommation)", action: Action.FEAST }, right: { label: "Rationner (petit repas)", action: Action.RATION } },
    SOCIAL: { question: "La nuit est tombée sur le camp. Que faites-vous avant de dormir ?", left: { label: "Discussion au coin du feu", action: Action.TALK }, right: { label: "Pause (repos)", action: Action.PAUSE } }
};

const DEFAULT_PARAMS = {
    startPeriod: Period.AFTERNOON, // période du premier tour (après l'accrochage de la bannière : l'après-midi du jour 1)
    stopAfterNight: false,         // true : la vie de camp s'arrête à la fin de la première nuit (contenu actuel)
    // Calendrier. Par défaut (listes vides) : cycle de 3 jours à partir du jour 2 — survie, épreuve de confort, épreuve d'immunité +
    // conseil —, jusqu'au jour `lastDay` (22 : 7 conseils). Si l'une des listes est renseignée, elles remplacent le cycle (tests).
    lastDay: 22,                   // dernier jour de la vie de camp (0 = pas de limite)
    challengeDays: [],             // jours d'épreuve (explicites) : pas d'action de matin (l'épreuve la remplace)
    councilDays: [],               // jours de conseil (explicites) : pas d'action de nuit

    // Énergie. Le sommeil ne rend plus un montant fixe : une carte nuit est tirée (voir NIGHT_CARDS).
    taskEnergy: { PLANTS: 3, FISH: 3, HARPOON: 3, WATER: 3, WOOD: 3, BUILD: 2, FIRE: 0, TALK: 1, PAUSE: 0, SWIM: 0 }, // coût des tâches du matin et de l'après-midi
    pauseEnergy: 3,                // énergie rendue par une pause (au lieu d'un coût)
    rationEnergy: 2,               // repas rationné
    feastEnergy: 5,                // festin
    feastFireBonus: 3,             // énergie de festin en plus quand le feu est allumé
    rationFood: 1,                 // nourriture consommée par un candidat qui rationne
    feastFood: 3,                  // nourriture consommée par un candidat qui fait un festin

    // Réveil
    wakeCalmEnergy: 3,             // se lever tranquillement
    wakeThreshold: 10,             // jet d20 + SOC (les deux choix de réveil)
    wakeLateRep: 1,                // REP perdue auprès des lève-tôt quand on traîne au lit et que le jet échoue
    wakeRiseFood: 1,               // nourriture ramassée ensemble (se lever directement, jet réussi)

    // Récoltes
    fishThreshold: 10,             // jet d20 + OBS
    fishSuccessFood: 5,
    fishFailFood: 2,
    plantsThreshold: 15,           // jet d20 + INT, seuil élevé
    plantsSuccessFood: 10,
    plantsFailFood: 1,
    harpoonThreshold: 34,          // jet combiné d20 + SWI et d20 + OBS (difficile)
    harpoonSuccessFood: 8,         // échec : 0 nourriture
    faunaGuideBonus: 4,            // bonus aux jets d'OBS de la survie avec le guide local
    woodAmount: 4,                 // bois ramené (ne rate jamais)
    waterAmount: 5,                // eau ramenée une fois la source trouvée (ne rate jamais)
    waterSourceThreshold: 22,      // tant que la source n'est pas trouvée : jet d'OBS très difficile (d20 + OBS)
    waterSourceRep: 3,             // REP gagnée en trouvant la source
    waterSourceWater: 5,           // ravitaillement instantané en trouvant la source
    talkThreshold: 10,             // jet d20 + SOC d'une discussion

    // Construction : voir CAMP_PROJECTS (Team.js) — jet d'INT par étape, bois dépensé en cas de réussite
    swimEnergy: 2,                 // baignade : énergie gagnée
    swimAff: 1,                    // AFF mutuel entre les baigneurs d'une même équipe
    // Feu : jet joint d'INT de 3 aventuriers (3 énergie chacun), 5 bois minimum dans la réserve pour commencer
    fireThreshold: 50,
    fireGroup: 3,
    fireEnergy: 3,
    fireMinWood: 5,
    // Bois brûlé automatiquement par un feu allumé au début de chaque période ; faute de bois, il s'éteint
    fireBurn: { MORNING: 2, AFTERNOON: 3, NIGHT: 4 }
};

/**
 * Vie de camp : le cycle jour / nuit (voir Time.js). Chaque candidat a un nombre d'actions limité par période et doit toutes
 * les dépenser : la période ne se termine que quand le joueur a dépensé les siennes, et pendant ce temps chaque non-joueur
 * dépense aussi les siennes (une action pour chaque action du joueur). Au réveil, les non-joueurs jouent AVANT le joueur
 * (pour savoir qui se lève et qui dort encore).
 *
 * Journée sans épreuve : Réveil (1 action) · Matin (2) · Midi (repas) · Après-midi (3) · Soir (repas) · Nuit (1 action sociale,
 * puis sommeil). Un jour d'épreuve n'a pas de Matin (`challengeDays`), un jour de conseil n'a pas de Nuit (`councilDays`).
 *
 * Tout se joue au swipe : le réveil, les repas et la nuit sont un choix gauche / droite ; les tâches du matin et de l'après-midi
 * se choisissent en descendant un arbre de 3 questions à deux options (voir TASK_TREE).
 *
 * Ressources du camp (par équipe, toutes à 0 au début) : Eau (max 20), Bois, Nourriture.
 * - Cabane : 15 étapes de construction (une action chacune, 2 bois chacune ; impossible sans 2 bois).
 * - Feu : très difficile. L'action « Feu » réunit 3 aventuriers (le joueur ou le non-joueur qui agit et deux coéquipiers choisis
 *   par relation) pour un jet joint d'INT à 50 ; chacun dépense 3 énergie. Impossible tant qu'il y a moins de 5 bois. Allumé,
 *   le feu brûle automatiquement 2 bois le matin, 3 l'après-midi, 4 la nuit ; sans bois il s'éteint et il faut le rallumer.
 *   Avec du feu, le festin rapporte +3 énergie de plus à chacun.
 * - Les tâches du matin et de l'après-midi consomment de l'énergie ; le sommeil en restaure.
 * - Réveil — gauche : se lever tranquillement (+3 énergie) puis jet de SOC ; échec = traîner au lit est mal vu (-1 REP auprès de
 *   tous les lève-tôt). Droite : se lever directement ; on croise au hasard un des lève-tôt ; jet de SOC réussi : +1 AFF
 *   mutuel et +1 nourriture (quelques racines ramassées ensemble), échec : un simple salut, rien ne change.
 *
 * Cartes de personnage : les jets de réveil, de pêche, de plantes et de discussion sont des contextes (RollContext) : une
 * carte du personnage associée à la valeur de d20 obtenue remplace alors la résolution classique.
 *
 * Variations de relation (échelle de référence) : voir `perform`.
 *
 * Variables de texte : {campPrompt}, {campLeft}, {campRight}.
 */
class CampLife extends Challenge {
    static get ID() {
        return "CAMP_LIFE";
    }
    constructor(params) {
        super(CampLife.ID, { ...DEFAULT_PARAMS, ...(params || {}) });
        // Pas de score d'avancement : ce sont les ressources du camp qui sont affichées (second header)
        this.visible = false;
        this.period = this.params.startPeriod;
        this.actionsDone = 0;     // actions déjà dépensées par le joueur dans la période
        this.node = "ROOT";       // nœud courant de l'arbre des tâches
        this.log = "";            // compte rendu de la dernière action du joueur
        this.notice = "";         // refus d'une action impossible (pas assez de bois...), montré sur la carte boussole
        this.view = null;         // contenu structuré de la carte boussole (voir `buildView`), lu par l'interface
        this.turnNotes = [];      // évènements du tour concernant le joueur (aide au feu, extinction du feu...)
        this.risers = {};         // couleur d'équipe -> noms de ceux qui se sont levés directement (réveil)
        this.finished = false;
        this.pendingChallenge = false; // une épreuve doit être lancée à la fin du tour (matin d'un jour d'épreuve)
        this.actionCount = {};    // nom -> nombre total d'actions dépensées (suivi / tests)
        this.planned = {};        // nom -> action choisie par chaque non-joueur pour l'action en cours (avant le joueur)
        this.round = {};          // nom -> action effectivement réalisée dans le tour en cours
        this.nightEvent = null;   // carte nuit de l'équipe du joueur à montrer sur sa propre carte { day, name, text }
        this.pendingKind = null;  // DayKind de l'épreuve à lancer à la fin du tour
        this.activeKind = null;   // DayKind de l'épreuve en cours (récompense de confort / immunité au retour)
        this.comfortIndex = 0;    // prochaine récompense de confort (COMFORT_REWARDS)
        this.talk = null;         // tractation du joueur en cours (TalkFlow) : la discussion est jouée en plusieurs cartes
        this.talkResult = null;   // compte rendu de la tractation terminée, repris par `perform` (action TALK du joueur)
        this.pendingCouncil = false; // le conseil doit commencer à la fin du tour (soir d'un jour de conseil)
        this.councilHeld = {};    // jour -> true : le conseil de ce jour a déjà eu lieu
        this.dayLog = [];         // résultats d'épreuves { day, text }, résumés par Denis au conseil
        this.turnCard = null;     // { id, onFinish } de la carte de vie de camp, pour y revenir après un conseil
        this.results = [];        // résultats courts de l'action du joueur, montrés dans un toast (voir `showResult`)
        this.mealDecision = {};   // couleur d'équipe -> { action, feast, ration } : le repas est voté par l'équipe
    }
    /** Portraits à choisir pendant une tractation (« détourner »), consultés par l'interface. */
    get picker() {
        return this.talk ? this.talk.picker : null;
    }
    selectName(game, name) {
        if (this.talk) {
            this.talk.select(name);
            this.refresh(game);
        }
    }

    // --- Interface Challenge ---

    start(game) {
        this.candidates = game.candidates.filter((c) => !c.eliminated);
        this.candidates.forEach((c) => { this.actionCount[c.name] = 0; });
        game.period = this.period;
        this.enterPeriod(game);
        this.refresh(game);
    }
    /**
     * Le joueur dépense une action, puis chaque non-joueur dépense la sienne (sauf au réveil, où ils ont déjà joué). Quand
     * toutes les actions de la période sont dépensées, on passe à la période suivante. Renvoie la même carte, ou
     * `card.challenge.onFinish` à la fin.
     */
    playTurn(game, leftOrRight, card) {
        const kind = PERIOD_KINDS[this.period];
        this.turnCard = { id: card.id, onFinish: card.challenge.onFinish };
        const player = game.getEntityByName("{player}");
        if (this.talk) {
            // Tractation du joueur en cours : le swipe répond à la carte de discussion
            const step = this.talk.turn(leftOrRight);
            if (!step.done) {
                this.refresh(game);
                return "ID:" + card.id;
            }
            this.talk = null;
            this.talkResult = step.log;
            return this.runAction(game, card, kind, () => this.perform(game, player, Action.TALK));
        }
        this.notice = "";
        const choice = this.choiceNode(kind)[leftOrRight];
        if (!choice) {
            // Sens sans option (ex: haut sans kit de pêche) : rien ne se passe
            return "ID:" + card.id;
        }
        if (choice.node) {
            // Descente dans l'arbre des tâches : pas encore d'action dépensée
            this.node = choice.node;
            this.refresh(game);
            return "ID:" + card.id;
        }
        const check = this.availability(game, player, choice.action);
        if (!check.ok) {
            // Action impossible pour le moment : rien n'est dépensé, retour au premier choix (jamais d'impasse dans l'arbre)
            this.log = check.reason;
            this.notice = check.reason;
            this.node = "ROOT";
            this.refresh(game);
            return "ID:" + card.id;
        }
        if (choice.action == Action.TALK) {
            // Discuter : tractation en plusieurs cartes (sujet, ton, engagement) ; l'action n'est dépensée qu'à la fin
            const partner = this.talkPartner(game, player);
            if (partner && game.teamMembers(player.team).length >= 3) {
                this.talk = new TalkFlow(game, this, player, partner);
                game.affWatch = [];
                this.log = "";
                this.refresh(game);
                return "ID:" + card.id;
            }
        }
        if (kind == PeriodKind.MEAL) {
            this.decideMeals(game, choice.action);
        }
        return this.runAction(game, card, kind, () => this.perform(game, player, choice.action));
    }
    /**
     * Vote du repas, par équipe : la majorité des membres (le joueur compte pour un) choisit entre festin et ration, et TOUT LE MONDE
     * applique ce choix (égalité de traitement dans le camp) ; en cas d'égalité, le choix du joueur l'emporte dans son équipe. Faute
     * de vivres pour que chacun fasse un festin (3 par candidat), l'équipe rationne.
     */
    decideMeals(game, playerAction) {
        this.mealDecision = {};
        game.teams.forEach((team) => {
            const members = game.teamMembers(team.color);
            if (!members.length) {
                return;
            }
            const choices = members.map((m) => (m.isPlayer ? playerAction : this.planned[m.name]));
            const feast = choices.filter((a) => a == Action.FEAST).length;
            const ration = members.length - feast;
            const hasPlayer = members.some((m) => m.isPlayer);
            let action = feast > ration ? Action.FEAST : (feast < ration ? Action.RATION : (hasPlayer ? playerAction : (Math.random() < 0.5 ? Action.FEAST : Action.RATION)));
            let short = false;
            if (action == Action.FEAST && team.camp.resources.food < members.length * this.params.feastFood) {
                action = Action.RATION;
                short = true;
            }
            this.mealDecision[team.color] = { action, feast, ration, short };
        });
    }
    /** Ajoute un résultat court (« +4 bois ») au toast de l'action du joueur. */
    result(text) {
        this.results.push(text);
    }
    /**
     * Toast de bas de page de l'action du joueur : les résultats courts (« +4 bois », « +2 énergie ») pendant 1 seconde, suivis d'un
     * smiley si l'affection a varié (content ou mécontent, jamais le montant) ; un compte rendu narratif (réveil, feu, discussion...)
     * y figure aussi, plus longtemps.
     */
    showResult(game, narrative, smiley) {
        const parts = [...this.results];
        if (narrative) {
            parts.push(game.personalize(narrative));
        }
        if (smiley) {
            parts.push(smiley);
        }
        if (!parts.length) {
            return;
        }
        const duration = narrative ? Math.max(2500, Math.min(7000, 1500 + 45 * narrative.length)) : 1000;
        game.toast([{ text: parts.join("  ") }], duration);
    }
    /**
     * Dépense l'action du joueur (`playerAction` la réalise et renvoie son compte rendu), fait jouer les non-joueurs, passe à la
     * période suivante si besoin. Renvoie le `next` de la carte (la même carte, la suite d'une épreuve ou d'un conseil, la fin).
     */
    runAction(game, card, kind, playerAction) {
        this.turnNotes = [];
        this.round = {};
        this.results = [];
        game.affWatch = game.affWatch || []; // une tractation en cours a déjà commencé à relever les variations d'affection
        const playerLog = playerAction();
        if (kind != PeriodKind.WAKE) {
            // Les non-joueurs réalisent le choix qu'ils avaient déjà fait AVANT le joueur (voir planNpcs)
            this.candidates.filter((c) => !c.isPlayer).forEach((c) => this.perform(game, c, this.planned[c.name] || this.npcChoice(game, c, kind)));
        }
        this.bathe(game);
        const actionLog = [playerLog, ...this.turnNotes].filter((l) => l).join(" ");
        // Le smiley d'affection ne compte que l'action elle-même (pas la nuit qui suit)
        const smiley = game.affSmiley();
        game.affWatch = null;
        this.log = "";
        this.turnNotes = [];
        this.node = "ROOT";
        this.actionsDone++;
        if (this.actionsDone >= PERIOD_ACTIONS[this.period]) {
            this.endPeriod(game);
        } else {
            this.planNpcs(game, kind);
        }
        // Le compte rendu de l'action est montré tout de suite si la journée s'achève (nuit, conseil, épreuve du lendemain) : il aurait
        // sinon été affiché sur la carte du matin suivant. Sinon il accompagne la question suivante.
        const dayEnds = !!(this.nightEvent || this.pendingCouncil || this.pendingChallenge || this.finished);
        this.log = dayEnds ? this.log : [actionLog, this.log].filter((l) => l).join(" ");
        const result = dayEnds ? actionLog : "";
        // Résultats courts et smiley en toast ; le récit d'une dernière action de journée a sa carte « Fin de journée »
        this.showResult(game, dayEnds ? "" : actionLog, smiley);
        this.refresh(game);
        if (this.pendingChallenge && !this.finished) {
            // Jour d'épreuve : une épreuve de la collection (cards/challenges), tirée au sort dans le bon contexte (équipe avant la
            // réunification, individuelle après), remplace le matin ; on reprend la vie de camp à midi ensuite.
            this.pendingChallenge = false;
            this.activeKind = this.pendingKind;
            return this.withDayEndCard(game, result, this.withNightCard(game, "CHALLENGE:" + game.challengeContext + ":" + card.id));
        }
        if (this.pendingCouncil && !this.finished) {
            // Soir d'un jour de conseil : le conseil remplace la nuit ; le sommeil suit (voir `afterCouncil`)
            this.pendingCouncil = false;
            if (Council.canHold(game)) {
                game.applyEffect({ type: EffectType.CHALLENGE_START, target: Council.ID });
                return this.withDayEndCard(game, result, "ID:council_turn");
            }
            return this.withDayEndCard(game, result, this.afterCouncil(game));
        }
        return this.withDayEndCard(game, result, this.withNightCard(game, this.finished ? card.challenge.onFinish : "ID:" + card.id));
    }
    /**
     * Fin du conseil (appelé par Game pour `next: "CAMP_RESUME"`) : l'influence des tractations et l'immunité sont effacées, la nuit
     * passe (carte nuit), puis retour à la vie de camp — ou fin de l'aventure du joueur s'il vient d'être éliminé.
     * @returns {string} `next` à suivre
     */
    afterCouncil(game) {
        game.immuneTeam = null;
        game.tractations.reset();
        const player = game.getEntityByName("{player}");
        this.endPeriod(game);
        this.refresh(game);
        if (player.eliminated) {
            return "ID:council_out";
        }
        const card = this.turnCard;
        return this.withNightCard(game, this.finished ? card.onFinish : "ID:" + card.id);
    }
    /**
     * Si une carte nuit vient d'être tirée pour l'équipe du joueur, elle a sa propre carte (nom de la carte nuit, texte) montrée
     * avant la suite `next`.
     * @returns {string} `next` à suivre : la carte nuit en attente (QUEUED) ou la suite directement
     */
    withNightCard(game, next) {
        const event = this.nightEvent;
        this.nightEvent = null;
        if (!event) {
            return next;
        }
        game.queuedCards.push(Card.deserialize({
            id: "night_" + event.day,
            single_use: false,
            name: event.name,
            type: "NARRATION",
            theme: "NUIT",
            img: "",
            text: event.text,
            choices: { left: { text: "Suivant", next }, right: { text: "Suivant", next } }
        }));
        return "QUEUED";
    }
    /**
     * Bilan immédiat de la dernière action de la journée (discussion du soir, par exemple) : sans cette carte, le compte rendu
     * n'apparaissait que sur la carte du lendemain matin. Mise en file avant la carte nuit ou le conseil qui suivent.
     * @returns {string} `next` à suivre
     */
    withDayEndCard(game, text, next) {
        if (!text) {
            return next;
        }
        game.queuedCards.unshift(Card.deserialize({
            id: "dayend_" + game.currentDay + "_" + this.actionCount[game.getEntityByName("{player}").name],
            single_use: false,
            name: "Fin de journée",
            type: "NARRATION",
            theme: "CAMP",
            img: "",
            text: game.personalize(text),
            choices: { left: { text: "Suivant", next }, right: { text: "Suivant", next } }
        }));
        return "QUEUED";
    }
    /**
     * Baignade : les baigneurs d'une même équipe (le joueur et les non-joueurs qui ont choisi la mer) gagnent un peu d'affection
     * mutuelle (+1 AFF, banal : pas d'historique).
     */
    bathe(game) {
        const bathers = this.candidates.filter((c) => this.round[c.name] == Action.SWIM);
        game.teams.forEach((team) => {
            const group = bathers.filter((c) => c.team == team.color);
            group.forEach((a) => group.filter((b) => b !== a).forEach((b) => a.changeRelation(b.name, RelationGauge.AFF, this.params.swimAff)));
            const player = group.find((c) => c.isPlayer);
            if (player && group.length > 1) {
                // Se baigner à plusieurs rapproche : smiley content dans le toast de l'action
                if (game.affWatch) {
                    game.affWatch.push(1);
                }
            }
        });
    }
    close(game) {
        game.period = null;
    }

    // --- Cycle jour / nuit ---

    /**
     * Nature du jour (DayKind). Les listes explicites `challengeDays` / `councilDays`, si elles sont renseignées, remplacent le
     * cycle : un jour d'épreuve y est un jour de confort. Sinon, cycle de 3 jours à partir du jour 2 : survie, confort, immunité.
     */
    dayKind(day) {
        const p = this.params;
        if (p.challengeDays.length || p.councilDays.length) {
            return p.challengeDays.includes(day) ? DayKind.COMFORT : DayKind.SURVIVAL;
        }
        return day < 2 ? DayKind.SURVIVAL : DAY_CYCLE[(day - 2) % DAY_CYCLE.length];
    }
    /** Jour de conseil (épreuve d'immunité le matin, conseil à la place de la nuit). */
    isCouncilDay(day) {
        const p = this.params;
        if (p.challengeDays.length || p.councilDays.length) {
            return p.councilDays.includes(day);
        }
        return this.dayKind(day) == DayKind.IMMUNITY;
    }
    /** Une période est sautée si l'épreuve ou le conseil du jour la remplace. */
    skipsPeriod(day, period) {
        if (period == Period.MORNING && this.dayKind(day) != DayKind.SURVIVAL) {
            return true;
        }
        return period == Period.NIGHT && this.isCouncilDay(day);
    }
    /** Fin de période : période suivante ; à la fin du jour (nuit comprise, même sautée pour un conseil), la nuit passe. */
    endPeriod(game) {
        var index = PERIOD_ORDER.indexOf(this.period);
        while (true) {
            index++;
            if (index >= PERIOD_ORDER.length) {
                if (this.isCouncilDay(game.currentDay) && !this.councilHeld[game.currentDay]) {
                    // Le conseil remplace la nuit : on s'arrête ici, `afterCouncil` reprendra par le sommeil
                    this.councilHeld[game.currentDay] = true;
                    this.pendingCouncil = true;
                    return;
                }
                this.sleep(game);
                const p = this.params;
                if (p.stopAfterNight || (p.lastDay && game.currentDay >= p.lastDay)) {
                    this.finished = true;
                    return;
                }
                game.currentDay++;
                index = 0;
            }
            if (!this.skipsPeriod(game.currentDay, PERIOD_ORDER[index])) {
                break;
            }
            // Le matin d'un jour d'épreuve est remplacé par l'épreuve : on la lancera à la fin de ce tour
            if (PERIOD_ORDER[index] == Period.MORNING) {
                this.pendingChallenge = true;
                this.pendingKind = this.dayKind(game.currentDay);
            }
        }
        this.period = PERIOD_ORDER[index];
        this.actionsDone = 0;
        this.node = "ROOT";
        game.period = this.period;
        this.enterPeriod(game);
    }
    /**
     * Début de période : les feux allumés brûlent leur bois (ou s'éteignent) ; au réveil, les non-joueurs jouent avant le joueur.
     */
    enterPeriod(game) {
        this.candidates = game.candidates.filter((c) => !c.eliminated);
        this.burnFire(game, this.period);
        this.planned = {};
        if (PERIOD_KINDS[this.period] == PeriodKind.WAKE) {
            this.risers = {};
            shuffle(this.candidates.filter((c) => !c.isPlayer)).forEach((c) => {
                const action = this.npcChoice(game, c, PeriodKind.WAKE);
                this.planned[c.name] = action;
                this.perform(game, c, action);
            });
        } else {
            this.planNpcs(game, PERIOD_KINDS[this.period]);
        }
        // Les évènements de début de période (feu, réveil) sont montrés avec la première question
        this.log = [this.log, ...this.turnNotes].filter((l) => l).join(" ");
        this.turnNotes = [];
    }
    /**
     * Les non-joueurs déterminent leur choix d'action AVANT le joueur, à chaque action : ils le réaliseront après celle du joueur
     * (`playTurn`). Le joueur voit les choix de ses coéquipiers pour décider avec qui passer le temps (voir `refresh`).
     */
    planNpcs(game, kind) {
        this.planned = {};
        this.candidates.filter((c) => !c.isPlayer).forEach((c) => { this.planned[c.name] = this.npcChoice(game, c, kind); });
    }
    /** « Pêche : Alice, Bob · Bois : Cara » : ce que les coéquipiers du joueur ont choisi pour cette action. */
    teammateChoices(game, player) {
        const groups = {};
        game.teamMembers(player.team).filter((m) => !m.isPlayer && this.planned[m.name]).forEach((m) => {
            const label = ACTION_LABELS[this.planned[m.name]] || this.planned[m.name];
            (groups[label] = groups[label] || []).push(m.name);
        });
        return Object.entries(groups).map(([label, names]) => label + " : " + names.join(", ")).join(" · ");
    }
    /**
     * Description d'une option pour la carte boussole : intitulé, détail, stats testées, difficulté et pastilles (gain, coût, info).
     * Les difficultés sont des mots, jamais des seuils chiffrés de jets, et rien ne révèle les stats des candidats.
     */
    optionInfo(game, camp, choice, kind) {
        const p = this.params;
        if (choice.node) {
            // Lieu de l'arbre des tâches : ses tâches en détail (sans « discuter », proposé partout)
            const sub = TASK_TREE[choice.node];
            const tasks = DIRECTIONS.map((d) => sub[d]).filter((o) => o && o.action != Action.TALK && (!o.if || o.if(camp)))
                .map((o) => ACTION_SHORT[o.action]);
            return { label: choice.label, place: choice.node, sub: tasks.join(" · "), stats: [], level: "", chips: [] };
        }
        const a = choice.action;
        const gain = (text) => ({ kind: "gain", text });
        const cost = (text) => ({ kind: "cost", text });
        const info = (text) => ({ kind: "info", text });
        var stats = [];
        var level = "";
        var label = ACTION_TITLES[a] || choice.label;
        const chips = [];
        switch (a) {
            case Action.WOOD: chips.push(gain("+" + p.woodAmount + " bois")); break;
            case Action.WATER:
                if (camp.equipements.waterSource) {
                    chips.push(gain("+" + p.waterAmount + " eau"));
                } else {
                    label = "Chercher une source"; stats = ["OBS"]; level = "très difficile"; chips.push(gain("source d'eau"));
                }
                break;
            case Action.PLANTS: stats = ["INT"]; level = "difficile"; chips.push(gain("+" + p.plantsFailFood + " à +" + p.plantsSuccessFood + " vivres")); break;
            case Action.FISH: stats = ["OBS"]; level = "facile"; chips.push(gain("+" + p.fishFailFood + " à +" + p.fishSuccessFood + " vivres")); break;
            case Action.HARPOON: stats = ["SWI", "OBS"]; level = "difficile"; chips.push(gain("0 à +" + p.harpoonSuccessFood + " vivres")); break;
            case Action.SWIM: chips.push(gain("+" + p.swimEnergy + " énergie")); break;
            case Action.PAUSE: chips.push(gain("+" + p.pauseEnergy + " énergie")); break;
            case Action.FIRE:
                if (camp.equipements.fire) {
                    label = "Le feu brûle";
                } else {
                    stats = ["INT"]; level = "très difficile"; chips.push(info("à " + p.fireGroup), info(p.fireMinWood + " bois min."));
                }
                chips.push(cost("−" + p.fireEnergy + " énergie"));
                break;
            case Action.BUILD: {
                const id = camp.currentProject();
                if (id) {
                    const project = CAMP_PROJECTS[id];
                    label = project.name + " " + camp.projectSteps(id) + "/" + project.steps;
                    stats = ["INT"];
                    level = project.difficulty <= 9 ? "facile" : (project.difficulty <= 11 ? "moyen" : "difficile");
                    chips.push(cost("−" + project.wood + " bois"));
                } else {
                    label = "Plus rien à construire";
                }
                break;
            }
            case Action.TALK: stats = ["SOC"]; chips.push(info(kind == PeriodKind.TASK ? "tractation" : "au coin du feu")); break;
            case Action.WAKE_CALM: stats = ["SOC"]; level = "facile"; chips.push(gain("+" + p.wakeCalmEnergy + " énergie")); break;
            case Action.WAKE_RISE: stats = ["SOC"]; level = "facile"; chips.push(info("croiser un lève-tôt")); break;
            case Action.FEAST:
                chips.push(gain("+" + (p.feastEnergy + (camp.equipements.fire ? p.feastFireBonus : 0)) + " énergie"), cost("−" + p.feastFood + " vivres / pers."));
                break;
            case Action.RATION: chips.push(gain("+" + p.rationEnergy + " énergie"), cost("−" + p.rationFood + " vivre / pers.")); break;
        }
        const energy = kind == PeriodKind.TASK && a != Action.FIRE ? p.taskEnergy[a] || 0 : 0;
        if (energy > 0) {
            chips.push(cost("−" + energy + " énergie"));
        }
        return { label, place: null, sub: "", stats, level, chips };
    }
    /**
     * Contenu structuré de la carte boussole (`this.view`) : chaque option est placée dans le sens de son swipe, avec les
     * coéquipiers qui ont choisi la même chose (leurs avatars). Pas de compte rendu d'action : seul un refus est signalé.
     */
    buildView(game, kind, node) {
        const player = game.getEntityByName("{player}");
        const camp = game.teamOf(player).camp;
        const mates = game.teamMembers(player.team).filter((m) => !m.isPlayer && this.planned[m.name]);
        const who = (m) => ({ id: m.id, name: m.name, sex: m.sex });
        // Actions auxquelles mène une option : elle-même, ou toutes celles d'un lieu (sans « discuter », proposé partout)
        const actionsOf = (choice) => (choice.node
            ? DIRECTIONS.map((d) => TASK_TREE[choice.node][d]).filter((o) => o && o.action != Action.TALK).map((o) => o.action)
            : [choice.action]);
        const placed = new Set();
        const options = DIRECTIONS.filter((dir) => node[dir]).map((dir) => {
            const choice = node[dir];
            const actions = actionsOf(choice);
            const people = mates.filter((m) => actions.includes(this.planned[m.name]));
            people.forEach((m) => placed.add(m.name));
            const check = choice.action ? this.availability(game, player, choice.action) : { ok: true, reason: "" };
            return { dir, ...this.optionInfo(game, camp, choice, kind), people: people.map(who), blocked: check.ok ? "" : check.reason };
        });
        // Au premier choix des tâches, ceux qui veulent discuter (option proposée dans chaque lieu) ; dans un lieu, on ne montre que
        // les coéquipiers de ce lieu
        const elsewhere = kind == PeriodKind.TASK && this.node == "ROOT"
            ? mates.filter((m) => !placed.has(m.name) && this.planned[m.name] == Action.TALK).map((m) => ({ ...who(m), action: ACTION_LABELS[Action.TALK] }))
            : [];
        const total = PERIOD_ACTIONS[this.period];
        const place = this.node != "ROOT" ? DIRECTIONS.map((d) => TASK_TREE.ROOT[d]).find((o) => o && o.node == this.node) : null;
        var hint = "";
        if (kind == PeriodKind.WAKE) {
            const up = (this.risers[player.team] || []).length;
            hint = up ? up + " coéquipier" + (up > 1 ? "s sont" : " est") + " déjà debout." : "Personne n'est encore debout.";
        } else if (kind == PeriodKind.MEAL) {
            hint = "Le repas est voté par l'équipe : la majorité l'emporte, tout le monde mange pareil (égalité : votre choix).";
        }
        return {
            period: PERIOD_LABELS[this.period],
            action: total > 1 ? (this.actionsDone + 1) + " / " + total : "",
            place: place ? place.label : "",
            placeKey: place ? place.node : "",
            step: kind == PeriodKind.TASK ? (this.node == "ROOT" ? "Choix 1 / 2" : "Choix 2 / 2") : "",
            question: node.question,
            hint,
            notice: this.notice,
            player: who(player),
            options,
            elsewhere
        };
    }
    /**
     * Carte nuit tirée au hasard (probabilités en %, le reste réparti à parts égales entre les cartes sans poids).
     * @returns {Object} une entrée de NIGHT_CARDS
     */
    drawNightCard() {
        const fixed = NIGHT_CARDS.reduce((s, c) => s + (c.weight || 0), 0);
        const free = NIGHT_CARDS.filter((c) => !c.weight).length;
        var roll = Math.random() * 100;
        for (const card of NIGHT_CARDS) {
            roll -= card.weight || (100 - fixed) / free;
            if (roll <= 0) {
                return card;
            }
        }
        return NIGHT_CARDS[0];
    }
    /**
     * Passage d'un jour à l'autre : chaque équipe tire sa propre carte nuit tant que les équipes sont sur des îles séparées (une
     * seule pour tous après la réunification). Remplace tout montant fixe d'énergie de sommeil.
     */
    sleep(game) {
        const player = game.getEntityByName("{player}");
        // Un feu allumé brûle aussi la nuit même quand la nuit est remplacée par un conseil
        if (this.isCouncilDay(game.currentDay)) {
            this.burnFire(game, Period.NIGHT);
        }
        const shared = game.reunified ? this.drawNightCard() : null;
        game.teams.filter((t) => game.teamMembers(t.color).length > 0).forEach((team) => {
            const card = shared || this.drawNightCard();
            const text = this.applyNightCard(game, team, card);
            if (team.color == player.team) {
                this.nightEvent = { day: game.currentDay, name: card.name, text };
            }
        });
    }
    /** Applique une carte nuit à une équipe. @returns {string} le texte de la carte (complété des conséquences) */
    applyNightCard(game, team, card) {
        const camp = team.camp;
        const members = game.teamMembers(team.color);
        const extra = [];
        const energy = card.energyCabin !== undefined && camp.cabinDone ? card.energyCabin : card.energy;
        const nightBonus = camp.bonus("NIGHT", "energy"); // paillasse
        members.forEach((c) => c.changeEnergy(energy + nightBonus));
        if (card.food) {
            camp.add("food", card.food);
        }
        if (card.fireWood && camp.equipements.fire) {
            if (camp.spend("wood", card.fireWood)) {
                extra.push("Le feu a consommé " + card.fireWood + " bois de plus.");
            } else {
                camp.equipements.fire = false;
                extra.push("Faute de bois, le feu s'est éteint dans la nuit !");
            }
        }
        if (card.cabinMax !== undefined && camp.equipements.cabin > card.cabinMax) {
            camp.equipements.cabin = card.cabinMax;
        }
        if (card.aff) {
            game.applyEffect({
                type: EffectType.TEAM_RELATION, target: team.color, gauge: RelationGauge.AFF, value: card.aff,
                description: card.name + " : une nuit passée ensemble rapproche l'équipe {team}"
            });
        }
        return [card.text, ...extra].join(" ");
    }
    /** Le feu allumé de chaque équipe brûle le bois de la période (ou s'éteint). */
    burnFire(game, period) {
        const base = this.params.fireBurn[period];
        const player = game.getEntityByName("{player}");
        if (!base) {
            return;
        }
        game.teams.forEach((team) => {
            const camp = team.camp;
            if (!camp.equipements.fire) {
                return;
            }
            // Le foyer en pierres réduit la consommation de bois de chaque période
            const burn = Math.max(0, base + camp.bonus("FIRE", "burn"));
            const mine = team.color == player.team;
            if (camp.spend("wood", burn)) {
                if (mine) {
                    this.turnNotes.push("Le feu a consommé " + burn + " bois.");
                }
            } else {
                camp.equipements.fire = false;
                if (mine) {
                    this.turnNotes.push("Faute de bois, le feu s'est éteint !");
                }
            }
        });
    }

    // --- Épreuves de confort et d'immunité ---

    /**
     * Retour à la vie de camp après une épreuve d'équipe tirée au sort (appelé par Game à la carte RETURN) : récompense de confort
     * de l'équipe gagnante, ou immunité de l'équipe gagnante.
     */
    onChallengeReturn(game) {
        const kind = this.activeKind;
        this.activeKind = null;
        const entry = game.lastChallenge;
        const result = entry && game.results[entry.id];
        if (!kind || !result || !result.winner) {
            return;
        }
        const player = game.getEntityByName("{player}");
        const team = game.teams.find((t) => t.color == result.winner);
        const label = "Les " + (result.winner == "RED" ? "Rouges" : "Jaunes");
        const notes = [];
        this.dayLog.push({ day: game.currentDay, text: (kind == DayKind.IMMUNITY ? "Épreuve d'immunité" : "Épreuve de confort") + " (" + entry.name + ") : victoire des " + (result.winner == "RED" ? "Rouges" : "Jaunes") + "." });
        if (kind == DayKind.IMMUNITY) {
            game.immuneTeam = result.winner;
            notes.push(label + " remportent l'immunité : ils n'iront pas au conseil.");
        } else if (kind == DayKind.COMFORT) {
            const reward = this.applyComfortReward(game, team);
            notes.push(result.winner == player.team ? "Récompense de confort — " + reward : label + " remportent l'épreuve de confort et sa récompense.");
        }
        this.log = notes.join(" ");
        this.refresh(game);
    }
    /**
     * Récompense de confort suivante, dans l'ordre fixe de COMFORT_REWARDS (une récompense indisponible est sautée).
     * @returns {string} texte de la récompense
     */
    applyComfortReward(game, team) {
        const camp = team.camp;
        const members = game.teamMembers(team.color);
        const feast = (energy, aff) => {
            members.forEach((c) => c.changeEnergy(energy));
            if (aff) {
                game.applyEffect({ type: EffectType.TEAM_RELATION, target: team.color, gauge: RelationGauge.AFF, value: aff, description: "Récompense de confort partagée dans l'équipe {team}" });
            }
        };
        for (var tries = 0; tries < COMFORT_REWARDS.length; tries++) {
            const reward = COMFORT_REWARDS[this.comfortIndex % COMFORT_REWARDS.length];
            this.comfortIndex++;
            switch (reward) {
                case "FISHING_KIT":
                    camp.equipements.fishingKit = true;
                    return "un kit de pêche ! Nouvelle tâche de récolte : la pêche au harpon.";
                case "MATCH":
                    if (game.teams.some((t) => t.camp.equipements.fire)) {
                        continue; // disponible seulement si aucune équipe n'a son feu allumé
                    }
                    camp.equipements.fire = true;
                    return "une allumette ! Le feu du camp est allumé instantanément.";
                case "FAUNA_GUIDE":
                    camp.equipements.faunaGuide = true;
                    return "un guide local sur la faune : +" + this.params.faunaGuideBonus + " aux jets d'OBS de la survie.";
                case "RICE":
                    camp.add("food", 40);
                    return "une réserve de riz : +40 nourriture.";
                case "HOT_MEAL": {
                    feast(25);
                    const meals = game.content.resources.hot_meals;
                    const dish = meals ? pick(meals.values) : "un repas gourmand";
                    return "un repas chaud ! Au menu : " + dish + ". +25 énergie pour toute l'équipe.";
                }
                case "LOCALS_STAY":
                    feast(15, 3);
                    return "un séjour chez les locaux : +15 énergie pour toute l'équipe et un souvenir partagé.";
                case "FAMILY_CALL":
                    feast(5, 4);
                    return "un appel téléphonique à la famille : +5 énergie pour tous et des larmes de joie partagées.";
            }
        }
        return "rien de disponible.";
    }
    /** Nœud de choix courant : l'arbre pour les tâches, un choix direct pour les autres périodes. */
    choiceNode(kind) {
        if (this.talk) {
            return this.talk.node();
        }
        if (kind != PeriodKind.TASK) {
            return DIRECT_CHOICES[kind];
        }
        // Les options conditionnelles (`if`) du camp du joueur (ex: harpon avec le kit de pêche) sont retirées si non remplies
        const node = TASK_TREE[this.node];
        const camp = this.game ? this.game.teamOf(this.game.getEntityByName("{player}")).camp : null;
        const filtered = { question: node.question };
        DIRECTIONS.forEach((dir) => {
            if (node[dir] && (!node[dir].if || !camp || node[dir].if(camp))) {
                filtered[dir] = node[dir];
            }
        });
        return filtered;
    }

    // --- Actions ---

    /** Une action est-elle possible maintenant ? @returns {{ok: boolean, reason: string}} */
    availability(game, c, action) {
        const p = this.params;
        const camp = game.teamOf(c).camp;
        if (action == Action.BUILD) {
            const id = camp.currentProject();
            if (!id) {
                return { ok: false, reason: "Tous les projets de construction sont terminés." };
            }
            const project = CAMP_PROJECTS[id];
            if (camp.resources.wood < project.wood) {
                return { ok: false, reason: "Pas assez de bois : chaque étape de « " + project.name + " » demande " + project.wood + " bois." };
            }
        }
        if (action == Action.HARPOON && !camp.equipements.fishingKit) {
            return { ok: false, reason: "Il faut un kit de pêche pour pêcher au harpon." };
        }
        if (action == Action.FIRE) {
            if (camp.equipements.fire) {
                return { ok: false, reason: "Le feu brûle déjà." };
            }
            if (camp.resources.wood < p.fireMinWood) {
                return { ok: false, reason: "Il faut au moins " + p.fireMinWood + " bois dans la réserve pour tenter d'allumer le feu." };
            }
            if (game.teamMembers(c.team).length < p.fireGroup) {
                return { ok: false, reason: "Il faut " + p.fireGroup + " aventuriers pour allumer le feu." };
            }
        }
        return { ok: true, reason: "" };
    }
    /**
     * Exécute une action pour un candidat (joueur ou non) et renvoie un compte rendu (utilisé pour le joueur).
     * Variations de relation, sur l'échelle de référence (auprès des coéquipiers) :
     * - Pêche : réussite +2 REP, échec -1 ; plantes : réussite (très bonne récolte) +4, échec -1 ;
     * - Eau, bois : +1 REP (tâche faite au minimum) ; étape de cabane +1, dernière étape +3 ; feu allumé : +5 REP et +3 AFF
     *   mutuel pour les 3 (réussite collective) ;
     * - Discussion : réussite +2 AFF mutuelle, échec -1 AFF ; festin : +1 AFF ;
     * - Réveil : traîner au lit sur un jet raté -1 REP auprès des lève-tôt ; se lever et croiser quelqu'un avec un jet réussi +1 AFF.
     */
    perform(game, c, action) {
        const p = this.params;
        const team = game.teamOf(c);
        const camp = team.camp;
        const you = c.isPlayer;
        // Garde-fou : un non-joueur ne tente pas une action impossible
        if (!c.isPlayer && !this.availability(game, c, action).ok) {
            action = Action.PAUSE;
        }
        // Le repas est un vote d'équipe : tout le monde applique le choix de la majorité
        const decided = (action == Action.FEAST || action == Action.RATION) ? this.mealDecision[c.team] : null;
        if (decided) {
            action = decided.action;
        }
        this.actionCount[c.name]++;
        this.round[c.name] = action;
        const taskCost = p.taskEnergy[action];
        if (taskCost !== undefined && PERIOD_KINDS[this.period] == PeriodKind.TASK) {
            c.changeEnergy(-taskCost);
        }
        // Variation de REP auprès des coéquipiers ; type d'historique propre à la vie de camp
        const rep = (value, description) => game.applyEffect({
            type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: c.name, value, description,
            historyType: value > 0 ? HistoryType.CAMP_CONTRIBUTION : HistoryType.CAMP_FAULT
        });
        // Jet d'une carte de personnage éventuelle : si elle se déclenche, elle remplace la résolution classique
        const cardLog = (rolled) => rolled.card ? "Carte « " + rolled.card.name + " » : " + rolled.text : null;

        switch (action) {
            case Action.WAKE_CALM:
            case Action.WAKE_RISE: {
                const rolled = this.rollWithCards(c, "SOC", RollContext.WAKE);
                if (rolled.card) {
                    // La carte de personnage remplace TOTALEMENT l'évènement : ni énergie du réveil calme, ni salut, ni pénalité
                    return you ? cardLog(rolled) : "";
                }
                if (action == Action.WAKE_CALM) {
                    c.changeEnergy(p.wakeCalmEnergy);
                }
                const ok = rolled.roll.total >= p.wakeThreshold;
                const detail = "(" + this.rollToString("SOC", rolled.roll, p.wakeThreshold) + ")";
                const earlier = (this.risers[team.color] || []).map((n) => game.getEntityByName(n)).filter((o) => o && o.name != c.name);
                if (action == Action.WAKE_CALM) {
                    if (!ok) {
                        // Traîner au lit est mal vu par ceux qui sont déjà levés
                        earlier.forEach((o) => o.changeRelation(c.name, RelationGauge.REP, -p.wakeLateRep));
                    }
                    return you ? "Vous vous levez tranquillement " + detail + " : " + (ok ? "personne ne lui en veut." : (earlier.length ? "traîner au lit est mal vu par ceux qui sont déjà debout." : "vous avez traîné, mais personne n'était encore debout.")) : "";
                }
                // Se lever directement : on croise au hasard un des lève-tôt
                const partner = earlier.length ? pick(earlier) : null;
                this.markRiser(team, c);
                if (!partner) {
                    return you ? "Vous vous levez directement " + detail + " : personne d'autre n'est encore debout." : "";
                }
                if (ok) {
                    game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: partner.name, about: c.name, value: 1 });
                    game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: c.name, about: partner.name, value: 1 });
                    camp.add("food", p.wakeRiseFood);
                    if (partner.isPlayer) {
                        this.turnNotes.push(c.name + " et " + mark(partner.name) + " ramassent quelques racines ensemble (+" + p.wakeRiseFood + " nourriture).");
                    }
                    return you ? "Vous vous levez directement " + detail + " : vous ramassez quelques racines avec " + partner.name + " (+" + p.wakeRiseFood + " nourriture)." : "";
                }
                return you ? "Vous vous levez directement " + detail + " : " + partner.name + " salue " + mark(c.name) + ", sans plus." : "";
            }
            case Action.FEAST:
            case Action.RATION: {
                const feast = action == Action.FEAST && camp.resources.food >= p.feastFood;
                const cost = feast ? p.feastFood : p.rationFood;
                const fed = camp.spend("food", cost);
                let gained = 0;
                if (fed) {
                    gained = (feast ? p.feastEnergy + (camp.equipements.fire ? p.feastFireBonus : 0) : p.rationEnergy) + camp.bonus("MEAL", "energy");
                    c.changeEnergy(gained);
                    if (feast) {
                        game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: "TEAM", about: c.name, value: 1 });
                    }
                }
                if (you) {
                    // Résultat du vote de l'équipe (festin ou ration pour tous) et énergie regagnée
                    const vote = decided ? " (vote " + decided.feast + "-" + decided.ration + (decided.short ? ", vivres insuffisantes" : "") + ")" : "";
                    this.result(!fed ? "Plus rien à manger" : (feast ? "Festin" : "Ration") + vote + " : +" + gained + " énergie");
                }
                return "";
            }
            case Action.FISH: {
                const rolled = this.rollWithCards(c, "OBS", RollContext.FISH);
                if (rolled.card) {
                    return you ? cardLog(rolled) : "";
                }
                // Guide local sur la faune : bonus aux jets d'OBS de la survie
                const guide = camp.equipements.faunaGuide ? p.faunaGuideBonus : 0;
                const roll = { ...rolled.roll, bonus: rolled.roll.bonus + guide, total: rolled.roll.total + guide };
                const ok = roll.total >= p.fishThreshold;
                const gain = camp.add("food", (ok ? p.fishSuccessFood : p.fishFailFood) + camp.bonus("FISH", "food"));
                rep(ok ? 2 : -1, c.name + (ok ? " rapporte une belle pêche de coquillages" : " rapporte une pêche de coquillages décevante"));
                if (you) {
                    this.result("+" + gain + " nourriture");
                }
                return "";
            }
            case Action.HARPOON: {
                // Pêche au harpon (kit de pêche) : jet combiné difficile de SWI et d'OBS (guide local compris)
                const guide = camp.equipements.faunaGuide ? p.faunaGuideBonus : 0;
                const outcome = this.combinedRoll(c, "SWI", "OBS", p.harpoonThreshold, guide);
                const gain = outcome.ok ? camp.add("food", p.harpoonSuccessFood + camp.bonus("HARPOON", "food")) : 0;
                rep(outcome.ok ? 3 : -1, c.name + (outcome.ok ? " rapporte un beau poisson harponné" : " rate sa pêche au harpon"));
                if (you) {
                    this.result(outcome.ok ? "+" + gain + " nourriture" : "Rien rapporté");
                }
                return "";
            }
            case Action.PLANTS: {
                const rolled = this.rollWithCards(c, "INT", RollContext.PLANTS);
                if (rolled.card) {
                    return you ? cardLog(rolled) : "";
                }
                const ok = rolled.roll.total >= p.plantsThreshold;
                const gain = camp.add("food", (ok ? p.plantsSuccessFood : p.plantsFailFood) + camp.bonus("PLANTS", "food"));
                rep(ok ? 4 : -1, c.name + (ok ? " rapporte une récolte de plantes nourrissantes exceptionnelle" : " revient presque bredouille de la cueillette"));
                if (you) {
                    this.result("+" + gain + " nourriture");
                }
                return "";
            }
            case Action.WATER:
            case Action.WOOD: {
                if (action == Action.WATER && !camp.equipements.waterSource) {
                    // La source d'eau doit être trouvée avant de pouvoir ravitailler : jet d'OBS très difficile (guide local compris)
                    const guide = camp.equipements.faunaGuide ? p.faunaGuideBonus : 0;
                    const roll = c.rollStat("OBS");
                    const total = roll.total + guide;
                    if (total < p.waterSourceThreshold) {
                        if (you) {
                            this.result("Source d'eau introuvable");
                        }
                        return "";
                    }
                    camp.equipements.waterSource = true;
                    const found = camp.add("water", p.waterSourceWater);
                    rep(p.waterSourceRep, c.name + " trouve la source d'eau du camp");
                    if (!you) {
                        this.turnNotes.push(c.name + " a trouvé une source d'eau ! (+" + found + " eau)");
                    }
                    if (you) {
                        this.result("Source d'eau trouvée : +" + found + " eau");
                    }
                    return "";
                }
                const resource = action == Action.WATER ? "water" : "wood";
                const amount = (action == Action.WATER ? p.waterAmount : p.woodAmount) + camp.bonus(action, resource);
                const gain = camp.add(resource, amount);
                if (gain > 0) {
                    rep(1);
                }
                if (you) {
                    this.result("+" + gain + (action == Action.WATER ? " eau" : " bois") + (gain < amount ? " (réserve pleine)" : ""));
                }
                return "";
            }
            case Action.BUILD: {
                // Une étape du projet en cours : jet d'INT contre la difficulté du projet ; le bois n'est dépensé qu'en cas de réussite
                const id = camp.currentProject();
                const project = CAMP_PROJECTS[id];
                const roll = c.rollStat("INT");
                const ok = roll.total >= project.difficulty;
                if (!ok) {
                    if (you) {
                        this.result(project.name + " : pas de progrès");
                    }
                    return "";
                }
                camp.spend("wood", project.wood);
                const done = camp.advanceProject(id);
                // Une étape banale +1 REP ; la dernière, qui termine le projet, est une activité utile (+3)
                rep(done ? 3 : 1, done ? c.name + " termine le projet de construction du camp : " + project.name : undefined);
                if (you) {
                    this.result(project.name + " " + camp.projectSteps(id) + "/" + project.steps + " (−" + project.wood + " bois)");
                }
                // Un projet terminé est un évènement : son bonus est annoncé
                return you && done ? project.name + " est terminé ! " + project.bonusText + "." : "";
            }
            case Action.SWIM: {
                const swim = p.swimEnergy + camp.bonus("SWIM", "energy");
                c.changeEnergy(swim);
                if (you) {
                    this.result("+" + swim + " énergie");
                }
                return "";
            }
            case Action.FIRE:
                return this.tryFire(game, c);
            case Action.TALK: {
                if (you && this.talkResult) {
                    // Tractation jouée en plusieurs cartes (TalkFlow) : son compte rendu remplace le jet de discussion
                    const result = this.talkResult;
                    this.talkResult = null;
                    return result;
                }
                const partner = this.talkPartner(game, c);
                if (!partner) {
                    return you ? "Personne à qui parler." : "";
                }
                if (!you && Math.random() < TRACTATION_PARAMS.npcPitchChance && game.teamMembers(c.team).length >= 3) {
                    // Les non-joueurs aussi font des tractations entre eux (voir Tractation.npcPitch)
                    const pitch = game.tractations.npcPitch(game, c, partner);
                    if (pitch && pitch.toPlayer) {
                        const verb = pitch.kind == PitchKind.CHARGE ? "devrait partir" : "mérite d'être protégé" + (pitch.target.sex == "F" ? "e" : "");
                        this.turnNotes.push(c.name + " glisse à " + mark(partner.name) + " : « Pour moi, " + pitch.target.name + " " + verb + ". »");
                    }
                    if (pitch) {
                        return "";
                    }
                }
                const rolled = this.rollWithCards(c, "SOC", RollContext.TALK);
                if (rolled.card) {
                    return you ? cardLog(rolled) : "";
                }
                const ok = rolled.roll.total >= p.talkThreshold;
                if (ok) {
                    // Moment positif partagé : +2 AFF dans les deux sens (une seule entrée d'historique)
                    game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: partner.name, about: c.name, value: 2, history: false });
                    game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: c.name, about: partner.name, value: 2, history: false });
                    game.record(HistoryType.GOOD_MOMENT, [c, partner], c.name + " et " + partner.name + " passent un bon moment à discuter", { gauge: RelationGauge.AFF, value: 2 });
                } else {
                    game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: partner.name, about: c.name, value: -1 });
                }
                return you ? "Vous discutez avec " + partner.name + " (" + this.rollToString("SOC", rolled.roll, p.talkThreshold) + ") : " + (ok ? "la conversation est agréable." : "la conversation tourne court.") : "";
            }
            case Action.PAUSE:
                c.changeEnergy(p.pauseEnergy + camp.bonus("PAUSE", "energy"));
                if (you) {
                    this.result("+" + (p.pauseEnergy + camp.bonus("PAUSE", "energy")) + " énergie");
                }
                return "";
        }
        return "";
    }
    /** Enregistre un candidat parmi ceux de son équipe qui se sont levés directement. */
    markRiser(team, c) {
        if (!this.risers[team.color]) {
            this.risers[team.color] = [];
        }
        this.risers[team.color].push(c.name);
    }
    /**
     * Tentative d'allumer le feu : `c` réunit deux coéquipiers (choisis par relation) pour un jet joint d'INT ; chacun des trois
     * dépense de l'énergie. Réussite : le feu est allumé (+5 REP chacun auprès de l'équipe, +3 AFF mutuel : réussite collective).
     */
    tryFire(game, c) {
        const p = this.params;
        const camp = game.teamOf(c).camp;
        const mates = game.teamMembers(c.team).filter((o) => o.name != c.name);
        const helpers = [];
        while (helpers.length < p.fireGroup - 1) {
            helpers.push(decide({ deciders: [c], options: mates.filter((o) => !helpers.includes(o)), context: DecisionContext.POSITIVE }));
        }
        const group = [c, ...helpers];
        group.forEach((m) => m.changeEnergy(-p.fireEnergy));
        const outcome = this.jointRoll(group, "INT", p.fireThreshold);
        const names = group.map((m) => m.name).slice(0, -1).join(", ") + " et " + group[group.length - 1].name;
        if (outcome.ok) {
            camp.equipements.fire = true;
            group.forEach((m) => {
                game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: m.name, value: 5, history: false });
                group.filter((o) => o !== m).forEach((o) => game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: o.name, about: m.name, value: 3, history: false }));
            });
            game.record(HistoryType.CAMP_CONTRIBUTION, group, names + " parviennent à allumer le feu du camp", { gauge: RelationGauge.REP, value: 5, action: Action.FIRE });
            game.record(HistoryType.GOOD_MOMENT, group, names + " partagent la joie d'avoir allumé le feu", { gauge: RelationGauge.AFF, value: 3, action: Action.FIRE });
        }
        // Résumé pour le joueur, qu'il agisse ou qu'il prête main-forte
        const involved = group.find((m) => m.isPlayer);
        const text = "Jet joint pour allumer le feu " + outcome.text + " (-" + p.fireEnergy + " énergie chacun) : " + (outcome.ok ? "le feu prend !" : "le feu refuse de prendre.");
        if (c.isPlayer) {
            return "Avec " + helpers.map((h) => h.name).join(" et ") + ", " + text.charAt(0).toLowerCase() + text.slice(1);
        }
        if (involved) {
            this.turnNotes.push(c.name + " demande de l'aide à " + mark(involved.name) + " pour allumer le feu. " + text);
        }
        return "";
    }
    /** Interlocuteur d'une discussion : un non-joueur choisit par relation (décision positive), le joueur tombe sur un coéquipier au hasard. */
    talkPartner(game, c) {
        const mates = game.teamMembers(c.team).filter((o) => o.name != c.name);
        if (!mates.length) {
            return null;
        }
        if (c.isPlayer) {
            // Le joueur passe le temps avec un coéquipier qui a choisi lui aussi de discuter (sinon au hasard)
            const talkers = mates.filter((o) => this.planned[o.name] == Action.TALK);
            return pick(talkers.length ? talkers : mates);
        }
        return decide({ deciders: [c], options: mates, context: DecisionContext.POSITIVE });
    }
    /** Choix d'action d'un non-joueur selon les besoins du camp (pondération au hasard). */
    npcChoice(game, c, kind) {
        const camp = game.teamOf(c).camp;
        const members = game.teamMembers(c.team).length;
        const r = camp.resources;
        const roulette = (weights) => {
            const entries = Object.entries(weights).filter(([, w]) => w > 0);
            var roll = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
            for (const [action, w] of entries) {
                roll -= w;
                if (roll <= 0) {
                    return action;
                }
            }
            return entries[entries.length - 1][0];
        };
        switch (kind) {
            case PeriodKind.WAKE:
                return Math.random() < 0.5 ? Action.WAKE_CALM : Action.WAKE_RISE;
            case PeriodKind.MEAL:
                return r.food >= members * this.params.feastFood && Math.random() < 0.3 ? Action.FEAST : Action.RATION;
            case PeriodKind.SOCIAL:
                return c.energy < 30 && Math.random() < 0.6 ? Action.PAUSE : Action.TALK;
            default: {
                const foodNeed = r.food < members * 2 ? 6 : (r.food < members * 4 ? 3 : 1);
                const plantsLiking = c.attributes.INT >= c.attributes.OBS ? 0.6 : 0.3;
                return roulette({
                    [Action.PLANTS]: foodNeed * plantsLiking,
                    [Action.FISH]: foodNeed * (1 - plantsLiking),
                    [Action.HARPOON]: this.availability(game, c, Action.HARPOON).ok ? foodNeed * 0.7 : 0,
                    [Action.WATER]: r.water >= 20 ? 0 : (r.water < 10 ? 4 : 1),
                    [Action.WOOD]: r.wood < 6 ? 4 : 1,
                    [Action.FIRE]: this.availability(game, c, Action.FIRE).ok ? 1.5 : 0,
                    [Action.BUILD]: this.availability(game, c, Action.BUILD).ok ? 2 : 0,
                    [Action.SWIM]: c.energy < 35 ? 2.5 : 0.8,
                    [Action.TALK]: 1.5,
                    [Action.PAUSE]: c.energy < 25 ? 4 : 0.5
                });
            }
        }
    }

    // --- Affichage ---

    /** Variables de texte du tour courant : question, options gauche / droite, dernier compte rendu. */
    refresh(game) {
        const kind = PERIOD_KINDS[this.period];
        const node = this.choiceNode(kind);
        const player = game.getEntityByName("{player}");
        const camp = game.teamOf(player).camp;
        const label = (choice) => (typeof choice.label == "function" ? choice.label(camp) : choice.label);
        const total = PERIOD_ACTIONS[this.period];
        const header = "Jour " + game.currentDay + " · " + PERIOD_LABELS[this.period] + (total > 1 ? " · action " + (this.actionsDone + 1) + "/" + total : "");
        var hint = kind == PeriodKind.TASK && this.node == "ROOT" ? " Chaque tâche consomme de l'énergie." : "";
        if (kind == PeriodKind.WAKE) {
            const up = (this.risers[player.team] || []).length;
            hint = " " + (up ? up + " coéquipier" + (up > 1 ? "s sont" : " est") + " déjà debout." : "Personne n'est encore debout.");
        }
        // Choix déjà faits par les coéquipiers pour cette action (ils jouent avant le joueur)
        const mates = this.talk ? "" : this.teammateChoices(game, player);
        const choices = mates ? "\nChoix de l'équipe — " + mates : "";
        if (this.talk) {
            hint = "";
        }
        game.vars.campPrompt = (this.log ? game.personalize(this.log) + "\n" : "") + header + choices + "\n" + node.question + hint;
        game.vars.campLeft = label(node.left);
        game.vars.campRight = label(node.right);
        // Haut / bas : vides quand le nœud n'a pas ces options (la carte ne propose alors pas ce sens de swipe)
        game.vars.campUp = node.up ? label(node.up) : "";
        game.vars.campDown = node.down ? label(node.down) : "";
        // Carte boussole (interface) : pas pendant une tractation, qui garde sa carte de texte
        this.view = this.talk ? null : this.buildView(game, kind, node);
        game.period = this.period;
    }
}

export { CampLife, Action, TASK_TREE }
