import { TeamCssColor } from "../Team";
import { Challenge } from "./Challenge";

/**
 * Base des épreuves de course : chaque candidat a une position (nombre de cases franchies, 0 = départ, `length` = arrivée),
 * affichée au-dessus de la zone de carte par la minimap `RaceTrack` (une colonne par case).
 * Les sous-classes décrivent les règles de chaque case.
 */
class RaceChallenge extends Challenge {
    /**
     * @param {string[]} steps parcours : une étape (Step ou étape propre à l'épreuve) par case ; optionnel
     */
    constructor(id, params, length, steps) {
        super(id, params);
        this.visible = true;
        this.display = "RACE_TRACK";
        this.length = length;
        this.steps = steps || [];
        this.positions = {};
        // Noms dans l'ordre d'arrivée
        this.arrived = [];
        // Ligne affichée sous la minimap pour le joueur (ex: "En duo avec Camille"), "" = rien
        this.statusText = "";
        // Couleur CSS de la bordure du statut (ex: couleur piochée par le joueur), "" = aucune
        this.statusColor = "";
    }
    /** Couleur CSS imposée à la bordure de l'avatar d'un candidat sur la minimap (null = couleur d'équipe éventuelle). */
    avatarBorder(candidate) {
        return null;
    }
    /** Inscrit les candidats encore en jeu sur la ligne de départ. */
    initRace(game) {
        this.candidates = game.candidates.filter((c) => !c.eliminated);
        this.candidates.forEach((c) => { this.positions[c.name] = 0; });
    }
    move(game, effect) {
        this.positions[game.getEntityByName(effect.about || "{player}").name] += Number(effect.value);
    }
    /** Case affichée (plafonnée à l'arrivée) */
    displayPosition(name) {
        return Math.min(this.positions[name], this.length);
    }
    hasArrived(name) {
        return this.arrived.includes(name);
    }
    /**
     * Marqueurs affichés dans la colonne `index` de la minimap. Par défaut un avatar par candidat (le joueur en premier) ;
     * les épreuves d'équipe surchargent pour n'afficher qu'un marqueur par équipe.
     * @returns {{key: string, text: string, isPlayer: boolean, border: string|null, bg: string|null, large: boolean}[]}
     */
    markersAt(index) {
        return this.candidates
            .filter((c) => this.positions[c.name] !== undefined && this.displayPosition(c.name) == index)
            .sort((a, b) => (b.isPlayer ? 1 : 0) - (a.isPlayer ? 1 : 0))
            .map((c) => ({
                key: c.name,
                text: c.name.charAt(0),
                isPlayer: c.isPlayer,
                border: this.avatarBorder(c) || TeamCssColor[c.team] || null,
                bg: null,
                large: c.isPlayer
            }));
    }
    /** Libellé de la colonne `index` de la minimap. */
    cellLabel(index) {
        return String(index);
    }
    // Points d'accroche des étapes (voir Challenge) : la position est le nombre de cases franchies
    advance(candidate, cells) {
        this.positions[candidate.name] += cells;
    }
    /** Étape que `candidate` doit aborder (celle de sa case suivante), undefined s'il a fini. */
    stepOf(candidate) {
        return this.steps[this.positions[candidate.name]];
    }
    segmentRemaining(candidate) {
        const pos = this.positions[candidate.name];
        var n = 0;
        while (this.steps[pos + n] == this.steps[pos]) {
            n++;
        }
        return n;
    }
}

export { RaceChallenge }
