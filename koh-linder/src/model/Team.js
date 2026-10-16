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
/**
 * Projets de construction du camp, chargés depuis `resources/camp_projects.json` (voir `loadCampProjects`, appelé par Game). Chaque
 * projet : `id`, `name`, `steps`, `difficulty` (jet d'INT par étape : d20 + INT ≥ difficulté), `wood` (bois dépensé par étape
 * réussie), `bonusText` et `bonus[action][clé]` appliqué une fois le projet terminé (clés : food, wood, water, energy, burn ;
 * actions : celles de CampLife, plus MEAL = repas et NIGHT = carte nuit ; `burn` négatif = bois de moins brûlé par période par le
 * feu). La cabane (`CABIN`) est toujours le projet en cours tant qu'elle n'est pas finie (elle le redevient si une tempête la
 * détruit) ; ensuite un projet supplémentaire est tiré au hasard parmi ceux qui restent.
 * Objet vide au départ, rempli en place pour que tous les modules qui l'importent le voient.
 */
const CAMP_PROJECTS = {};
/** Nombre d'étapes de la cabane avant chargement du contenu (valeur de secours). */
const CAMP_CABIN_STEPS = 15;

/** Charge les projets de construction depuis la ressource `camp_projects` ({ values: [...] }). */
function loadCampProjects(resource) {
    const values = resource && resource.values ? resource.values : [];
    Object.keys(CAMP_PROJECTS).forEach((id) => { delete CAMP_PROJECTS[id]; });
    values.forEach((project) => { CAMP_PROJECTS[project.id] = project; });
    if (!CAMP_PROJECTS.CABIN) {
        CAMP_PROJECTS.CABIN = { id: "CABIN", name: "Cabane", steps: CAMP_CABIN_STEPS, difficulty: 8, wood: 2, bonusText: "", bonus: {} };
    }
}

/**
 * Camp d'une équipe : ressources partagées (eau, bois, nourriture, toutes à 0 au début) et aménagements.
 * - `fire` : le feu est allumé (il brûle du bois à chaque période et s'éteint faute de bois).
 * - `cabin` : étapes de construction de la cabane réalisées (0 à CAMP_CABIN_STEPS ; finie à CAMP_CABIN_STEPS).
 * - `fishingKit`, `faunaGuide` : récompenses des épreuves de confort (voir CampLife).
 */
class Camp {
    constructor() {
        this.resources = { water: 0, wood: 0, food: 0 };
        // waterSource : source d'eau trouvée (avant, la tâche « Eau » cherche la source) ; fishingKit : kit de pêche (tâche « pêche au harpon ») ; faunaGuide : guide local (+4 aux jets d'OBS de la survie)
        this.equipements = { fire: false, cabin: 0, fishingKit: false, faunaGuide: false, waterSource: false };
        // Étapes réalisées des projets de construction autres que la cabane { id: étapes } et projet supplémentaire en cours
        this.projects = {};
        this.extraProject = null;
    }
    get cabinDone() {
        return this.equipements.cabin >= CAMP_PROJECTS.CABIN.steps;
    }
    /** Étapes réalisées d'un projet de construction (la cabane est dans `equipements.cabin`). */
    projectSteps(id) {
        return id == "CABIN" ? this.equipements.cabin : (this.projects[id] || 0);
    }
    projectDone(id) {
        return this.projectSteps(id) >= CAMP_PROJECTS[id].steps;
    }
    /**
     * Projet de construction en cours : la cabane tant qu'elle n'est pas finie, sinon un projet supplémentaire tiré au hasard parmi
     * ceux qui restent (conservé jusqu'à son terme). null quand tous sont terminés.
     */
    currentProject() {
        if (!this.cabinDone) {
            return "CABIN";
        }
        if (!this.extraProject || this.projectDone(this.extraProject)) {
            const left = Object.keys(CAMP_PROJECTS).filter((id) => !this.projectDone(id));
            this.extraProject = left.length ? left[Math.floor(Math.random() * left.length)] : null;
        }
        return this.extraProject;
    }
    /** Une étape de plus sur un projet. @returns {boolean} true si le projet vient d'être terminé */
    advanceProject(id) {
        if (id == "CABIN") {
            this.equipements.cabin++;
        } else {
            this.projects[id] = (this.projects[id] || 0) + 1;
        }
        return this.projectDone(id);
    }
    /** Somme des bonus des projets terminés pour une action et une clé (food, wood, water, energy, threshold). */
    bonus(action, key) {
        return Object.keys(CAMP_PROJECTS)
            .filter((id) => this.projectDone(id) && CAMP_PROJECTS[id].bonus[action] && CAMP_PROJECTS[id].bonus[action][key])
            .reduce((sum, id) => sum + CAMP_PROJECTS[id].bonus[action][key], 0);
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

export { Team, Camp, TeamColor, TeamCssColor, CAMP_RESOURCE_MAX, CAMP_CABIN_STEPS, CAMP_PROJECTS, loadCampProjects }
