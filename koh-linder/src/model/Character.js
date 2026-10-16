import { Card } from "./Card";
import { TeamColor } from "./Team";

// Les valeurs sont les clés utilisées dans `attributes` et dans les cartes (ex: TEST:{player}:STR:12:...)
const Attribute = {
    STR: "STR", // Constitution (Force/Endurance)
    INT: "INT", // Intellect
    SWI: "SWI", // Nage
    AGI: "AGI", // Agilité/Précision
    OBS: "OBS", // Observation
    SOC: "SOC", // Social
};
/**
 * Jauges relationnelles qu'un candidat a envers chacun des autres (non bornées, 0 = neutre).
 * - AFF : affection, à quel point l'autre lui est sympathique.
 * - REP : réputation, à quel point la compétence/utilité/efficacité de l'autre est reconnue.
 * Ces valeurs ne doivent JAMAIS être affichées au joueur (elles influent sur les votes des conseils).
 */
const RelationGauge = {
    AFF: "AFF",
    REP: "REP",
};

// Lancer un jet de ces stats coûte de l'énergie (voir Candidate.rollStat)
const PHYSICAL_STATS = ["STR", "SWI"];
const PHYSICAL_ROLL_ENERGY_COST = 1;

const ENERGY_START = 50;
const ENERGY_MAX = 100;

/**
 * Contextes de jet auxquels une carte de personnage peut être associée (`cards[].context` dans infos.json, avec une valeur
 * naturelle de d20 : `cards[].d20`). Quand le candidat fait un jet dans ce contexte et obtient cette valeur, la carte remplace
 * la résolution classique du jet (voir Game.drawCharacterCard).
 * Contextes branchés : WAKE (jet de SOC du réveil), FISH, PLANTS, TALK (vie de camp), RUN, HURDLE (étapes de course individuelles).
 */
const RollContext = {
    WAKE: "WAKE",
    FISH: "FISH",
    PLANTS: "PLANTS",
    TALK: "TALK",
    RUN: "RUN",
    HURDLE: "HURDLE",
    INDIVIDUAL_INT: "INDIVIDUAL_INT" // jet d'INT lors d'une épreuve individuelle (ex: allumer le feu du parcours)
};

/**
 * Mode d'une carte de personnage (`cards[].mode` dans infos.json) : REPLACE (défaut) = la carte remplace TOTALEMENT l'évènement
 * (ex: la méditation de Thierry) ; INSERT = la carte s'intercale entre le jet et sa résolution, qui se déroule ensuite normalement
 * (ex: l'éclair de génie de Laurent).
 */
const CardMode = {
    REPLACE: "REPLACE",
    INSERT: "INSERT"
};

/** Niveaux de rareté des personnages de la réserve. */
const Rarity = {
    RARE: "RARE",
    MYTHIC: "MYTHIC",
    LEGENDARY: "LEGENDARY",
};
const RarityLabel = {
    RARE: "Rare",
    MYTHIC: "Mythique",
    LEGENDARY: "Légendaire",
};

class Character {
    constructor(charEntity) {
        this.id = charEntity.id;
        this.name = charEntity.name;
        this.sex = charEntity.sex;
        this.age = charEntity.age;
        this.job = charEntity.job;
        // Rareté (Rarity) d'un personnage de la réserve ; null pour un profil généré ou créé par le joueur
        this.rarity = charEntity.rarity || null;
        // Coût en Koh-points pour rendre le personnage jouable (0 = jouable d'emblée)
        this.unlockCost = charEntity.unlockCost || 0;
        this.cards = charEntity.cards || [];
        // Biographie (texte libre affiché dans la fiche de la galerie)
        this.bio = charEntity.bio || "";
        this.attributes = {
            STR: 0,
            INT: 0,
            SWI: 0,
            AGI: 0,
            OBS: 0,
            SOC: 0,
            ...charEntity.attributes
        };
    }
}
class Candidate extends Character {
    constructor(charEntity) {
        super(charEntity);
        // Forme physique : diminue quand le candidat agit, remonte la nuit et en mangeant
        this.energy = ENERGY_START;
        this.eliminated = false;
        this.isPlayer = false;
        // Aucune équipe au début de l'aventure : attribuée à la fin de la première épreuve
        this.team = TeamColor.NONE;
        this.modifiers = [];
        // Votes déjà inscrits à son nom pour le prochain conseil auquel il assistera (ex: derniers de la 1re épreuve)
        this.councilVotes = 0;
        // Opinion de ce candidat envers chacun des autres : { nomDeLAutre: { AFF, REP } }
        this.relations = {};
    }
    changeEnergy(delta) {
        this.energy = Math.max(0, Math.min(ENERGY_MAX, this.energy + Number(delta)));
    }
    /** Score relationnel (AFF + REP) de ce candidat envers `otherName`, sans créer d'entrée. */
    relationScore(otherName) {
        const r = this.relations[otherName];
        return r ? r.AFF + r.REP : 0;
    }
    /** Affection (AFF) de ce candidat envers `otherName`, sans créer d'entrée. */
    affection(otherName) {
        const r = this.relations[otherName];
        return r ? r.AFF : 0;
    }
    /**
     * Opinion de ce candidat envers `otherName` (créée à 0/0 si inexistante).
     */
    getRelation(otherName) {
        if (!this.relations[otherName]) {
            this.relations[otherName] = { AFF: 0, REP: 0 };
        }
        return this.relations[otherName];
    }
    /**
     * Fait varier une jauge de l'opinion de ce candidat envers `otherName` (sans aucune limite : AFF et REP ne sont pas bornées).
     */
    changeRelation(otherName, gauge, delta) {
        const relation = this.getRelation(otherName);
        relation[gauge] = relation[gauge] + Number(delta);
    }
    /**
     * Lance un d20 et ajoute la valeur de la stat.
     */
    rollStat(stat) {
        // Un jet physique (STR ou SWI) fatigue : -1 énergie, quel que soit le contexte (épreuve, carte DICE...)
        if (PHYSICAL_STATS.includes(stat)) {
            this.changeEnergy(-PHYSICAL_ROLL_ENERGY_COST);
        }
        const d20 = Math.floor(Math.random() * 20) + 1;
        const bonus = this.attributes[stat] || 0;
        return { d20, bonus, total: d20 + bonus };
    }
    statTest(stat, valueToReach) {
        return this.rollStat(stat).total >= Number(valueToReach);
    }
    getStatTestCard(stat, valueToReach, success, fail) {
        var isSuccess = this.statTest(stat, valueToReach);
        var theCard = Card.deserialize({
            "id": "Test",
            "single_use": false,
            "name": "TheTest",
            "theme": "TEST",
            "type": "NARRATION",
            "text": isSuccess ? "Reussite !" : "Echec",
            "choices": {
                "left": {
                    "effects": [],
                    "text": "Continuer",
                    "next": isSuccess ? success : fail
                },
                "right": {
                    "effects": [],
                    "text": "Continuer",
                    "next": isSuccess ? success : fail
                }
            }
        });
        return theCard;
    }
}
export { Character, Candidate, Attribute, RollContext, CardMode, Rarity, RarityLabel,RelationGauge, ENERGY_START, ENERGY_MAX, PHYSICAL_STATS, PHYSICAL_ROLL_ENERGY_COST }
