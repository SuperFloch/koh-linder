import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { RelayRace } from "./RelayRace";

const DEFAULT_PARAMS = {
    targets: 8,          // cibles à abattre par équipe
    ammo: 30,            // projectiles par équipe
    targetBase: 24,      // seuil de la cible n (0 = la plus proche) : arrondi de base + n × pas (jet combiné : d20 + OBS et d20 + AGI)
    targetStep: 2.5,
    hardRep: 3,          // REP gagnée en abattant la cible la plus difficile encore présente
    easyRep: 1,          // REP gagnée en abattant une autre cible
    heroRep: 0           // pas de bonus de victoire pour le dernier tireur
};

/**
 * Épreuve « La fronde » (par équipe). Relais classique (voir RelayRace : chacun passe au moins une fois, jamais deux fois de suite).
 * Chaque équipe a 8 cibles à abattre à des distances croissantes ; une cible touchée ne compte plus. Un passage = un projectile.
 *
 * - Les munitions sont limitées : 30 projectiles par équipe. Quand elles sont épuisées, l'équipe qui a abattu le plus de cibles
 *   l'emporte. En cas d'égalité, les munitions deviennent illimitées et la première équipe qui abat une cible de plus l'emporte.
 * - Lancer un projectile = jet combiné d'OBS et d'AGI (d20 + OBS et d20 + AGI, somme comparée au seuil de la cible), dont la
 *   difficulté augmente à chaque cible.
 * - Comme à l'épreuve des poteries, le tireur choisit de viser la cible la plus proche (la plus facile) ou la plus difficile encore
 *   présente (joueur : gauche = la plus proche, droite = la plus difficile). REP : cible la plus difficile +3, une autre +1 ; un
 *   tir raté ne coûte rien.
 *
 * Minimap : cibles abattues (0 à 8), un marqueur par équipe.
 */
class SlingRelay extends RelayRace {
    static get ID() {
        return "SLING";
    }
    constructor(params) {
        const merged = { ...DEFAULT_PARAMS, ...(params || {}) };
        super(SlingRelay.ID, merged, merged.targets);
        // couleur -> { targets: seuils des cibles restantes (croissants), hits, ammo, last: dernier tireur victorieux }
        this.state = {};
        this.unlimited = false; // munitions illimitées (départage d'une égalité)
    }

    start(game) {
        this.initTeams(game);
        this.initRelay();
        const p = this.params;
        this.colors.forEach((color) => {
            const targets = [];
            for (var n = 0; n < p.targets; n++) {
                targets.push(Math.round(p.targetBase + n * p.targetStep));
            }
            this.state[color] = { targets, hits: 0, ammo: p.ammo, last: null };
        });
        game.vars.raceLog = "";
        this.refresh(game);
    }
    cellLabel(index) {
        return index == 0 ? "@target" : String(index);
    }
    wantsHardest(diver, st) {
        return 21 + diver.attributes.OBS + diver.attributes.AGI >= st.targets[st.targets.length - 1] - 2;
    }

    actTeam(game, color, side) {
        const p = this.params;
        const st = this.state[color];
        const mine = color == this.playerColor;
        const tag = mine ? "" : " (" + this.teamLabel(color) + ")";
        if (!this.unlimited && st.ammo <= 0) {
            return "";
        }
        // Premier passage : ordre du relais ; ensuite le joueur tire dès qu'il le peut (gauche / droite = cible visée), sinon
        // le meilleur tireur disponible
        var diver;
        if (this.nextInOrder(color)) {
            diver = this.chooseDiver(color, null);
        } else {
            const free = this.freeDivers(color);
            diver = (mine && free.find((m) => m.isPlayer)) || free.slice().sort((a, b) => (b.attributes.OBS + b.attributes.AGI) - (a.attributes.OBS + a.attributes.AGI))[0];
        }
        this.markDived(color, diver);
        const hardest = diver.isPlayer && mine ? side == "right" : this.wantsHardest(diver, st);
        const index = hardest ? st.targets.length - 1 : 0;
        const threshold = st.targets[index];
        const roll = this.combinedRoll(diver, "OBS", "AGI", threshold);
        if (!this.unlimited) {
            st.ammo--;
        }
        const name = diver.isPlayer ? "Vous" : diver.name;
        const kind = hardest ? "la cible la plus lointaine" : "la cible la plus proche";
        if (!roll.ok) {
            return name + " tire sur " + kind + " " + roll.text + " : manqué !" + tag;
        }
        st.targets.splice(index, 1);
        st.hits++;
        st.last = diver;
        this.positions[color] = st.hits;
        game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: diver.name, value: hardest ? p.hardRep : p.easyRep });
        return name + " tire sur " + kind + " " + roll.text + " : touché ! (" + st.hits + "/" + p.targets + ")" + tag;
    }

    /** Après chaque tour : huit cibles, ou munitions épuisées, ou départage de l'égalité. */
    playRound(game, side) {
        const sections = super.playRound(game, side);
        if (!this.winner) {
            const [a, b] = this.roundOrder();
            const ha = this.state[a].hits;
            const hb = this.state[b].hits;
            const full = this.roundOrder().find((c) => this.state[c].hits >= this.params.targets);
            if (full) {
                this.win(game, full);
            } else if (this.unlimited) {
                if (ha != hb) {
                    this.win(game, ha > hb ? a : b);
                }
            } else if (this.colors.every((c) => this.state[c].ammo <= 0)) {
                if (ha == hb) {
                    // Égalité : munitions illimitées, la première équipe à abattre une cible de plus gagne
                    this.unlimited = true;
                } else {
                    this.win(game, ha > hb ? a : b);
                }
            }
        }
        return sections;
    }
    win(game, color) {
        const hero = this.state[color].last || this.members[color][0];
        this.finishRace(game, color, hero, hero.name + " abat la cible décisive", "l'épreuve de la fronde");
    }

    refresh(game) {
        const color = this.playerColor;
        const st = this.state[color];
        const rival = this.colors.find((c) => c != color);
        const p = this.params;
        const next = this.nextInOrder(color);
        const easy = st.targets[0];
        const hard = st.targets[st.targets.length - 1];
        const ammo = this.unlimited ? "munitions illimitées (égalité : la première équipe à abattre une cible de plus gagne)" : st.ammo + " projectile" + (st.ammo > 1 ? "s" : "") + " restant" + (st.ammo > 1 ? "s" : "");
        var text = "Cibles abattues : " + st.hits + "/" + p.targets + ", " + ammo + ". Cible la plus proche : seuil " + easy + ", la plus lointaine : seuil " + hard + " (d20 + OBS et d20 + AGI). ";
        var left;
        var right;
        const free = this.freeDivers(color).some((m) => m.isPlayer);
        if (next) {
            text += "Prochain tireur : " + (next.isPlayer ? "vous" : next.name) + ".";
            left = next.isPlayer ? "Viser la plus proche" : "Encourager " + next.name;
            right = next.isPlayer ? "Viser la plus lointaine" : left;
        } else if (free) {
            text += "Tout le monde a tiré : c'est encore à vous (personne ne tire deux fois de suite).";
            left = "Tirer sur la plus proche";
            right = "Tirer sur la plus lointaine";
        } else {
            text += "Vous venez de tirer : un coéquipier prend la fronde.";
            left = right = "Encourager l'équipe";
        }
        game.vars.nextStep = text;
        game.vars.stepActionLeft = left;
        game.vars.stepActionRight = right;
        this.statusText = "Cibles : votre équipe " + st.hits + "/" + p.targets + (rival ? " · adversaires " + this.state[rival].hits : "");
    }
}

export { SlingRelay }
