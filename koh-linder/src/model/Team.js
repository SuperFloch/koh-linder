const TeamColor = {
    YELLOW: 'YELLOW',
    RED: 'RED',
    BLUE: 'BLUE',
    GREEN: 'GREEN',
    ORANGE: 'ORANGE',
    PURPLE: 'PURPLE',
    NONE: 'NONE'
}
// Couleurs CSS des équipes (charte graphique). Seules jaune et rouge sont définies pour l'instant.
const TeamCssColor = {
    YELLOW: '#ffe030',
    RED: '#ff4930',
}
class Team {
    constructor(color) {
        this.color = color;
        // Nom du chef d'équipe et nom tribal de l'équipe ("" tant que non attribués)
        this.leader = "";
        this.name = "";
        this.camp = new Camp();
        this.ressources = {};
    }
}
/** Plafonds des ressources quantifiables du camp (pas de plafond = Infinity). */
const CAMP_RESOURCE_MAX = {
    water: 20,
    wood: Infinity,
    food: Infinity
};
/** Nombre d'actions de construction nécessaires pour finir la cabane. */
const CAMP_CABIN_STEPS = 15;

/**
 * Camp d'une équipe : ressources partagées (eau, bois, nourriture, toutes à 0 au début) et aménagements.
 * - `fire` : le feu est allumé (il brûle du bois à chaque période et s'éteint faute de bois).
 * - `cabin` : étapes de construction de la cabane réalisées (0 à CAMP_CABIN_STEPS ; finie à CAMP_CABIN_STEPS).
 * - `fishingKit`, `faunaGuide` : récompenses des épreuves de confort (voir CampLife).
 */
class Camp {
    constructor() {
        this.resources = { water: 0, wood: 0, food: 0 };
        // fishingKit : kit de pêche (tâche « pêche au harpon ») ; faunaGuide : guide local (+4 aux jets d'OBS de la survie)
        this.equipements = { fire: false, cabin: 0, fishingKit: false, faunaGuide: false };
    }
    get cabinDone() {
        return this.equipements.cabin >= CAMP_CABIN_STEPS;
    }
    /** Ajoute une ressource dans la limite du plafond. @returns {number} quantité réellement ajoutée */
    add(resource, amount) {
        const before = this.resources[resource];
        this.resources[resource] = Math.min(CAMP_RESOURCE_MAX[resource], before + amount);
        return this.resources[resource] - before;
    }
    /** Consomme une ressource si le stock suffit. @returns {boolean} false (rien consommé) si le stock est insuffisant */
    spend(resource, amount) {
        if (this.resources[resource] < amount) {
            return false;
        }
        this.resources[resource] -= amount;
        return true;
    }
}

export { Team, Camp, TeamColor, TeamCssColor, CAMP_RESOURCE_MAX, CAMP_CABIN_STEPS }