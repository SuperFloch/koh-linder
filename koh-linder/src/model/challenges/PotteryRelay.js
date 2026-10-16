import { EffectType } from "../Effect";
import { RelationGauge } from "../Character";
import { RelayRace } from "./RelayRace";

const DEFAULT_PARAMS = {
    swimCells: 3,        // cases de nage entre le départ (0) et la plateforme (3)
    swimThreshold: 10,   // test de SWI pour nager (d20 + SWI) : réussite = 2 cases, échec = 1 case
    pots: 7,             // poteries (= colliers) à casser par équipe
    potBase: 24,         // seuil de la poterie n (0 = la plus facile) : base + n × pas (jet combiné : d20 + STR + d20 + AGI)
    potStep: 2,
    attempts: 2,         // un saut + un unique deuxième essai
    hardRep: 3,          // REP gagnée en cassant la poterie la plus difficile encore présente
    easyRep: 1,          // REP gagnée en cassant une autre poterie
    failRep: 1,          // REP perdue seulement en ratant le deuxième essai
    heroRep: 0           // pas de bonus de victoire pour celui qui ramène le dernier collier
};

/**
 * Épreuve « Les poteries » (par équipe). Relais (règles du relais : voir RelayRace). Chaque candidat doit nager jusqu'à une plateforme
 * en mer ; armé d'un maillet, il saute pour casser l'une des poteries suspendues, qui contient un collier, puis ramène le collier à
 * la case départ et passe le relais. La première équipe qui a tous ses colliers au départ gagne.
 *
 * - 3 cases de nage : test de SWI ; échec : 1 seule case parcourue, réussite : 2 cases. La plateforme est à la case 3.
 * - Chaque équipe a 7 poteries de seuil croissant. Avant de sauter, le candidat choisit : la PLUS DIFFICILE encore présente, ou la
 *   PLUS FACILE. Le joueur choisit au swipe (gauche : la plus facile, droite : la plus difficile) quand il est le sauteur.
 * - Le saut est un jet combiné de STR et AGI : d20 + STR plus d20 + AGI, à comparer au seuil de la poterie.
 * - Échec du saut : un unique deuxième essai (le choix de la poterie est reposé) ; échec du deuxième essai : retour sans collier
 *   pour passer le relais (seul cas de REP négative : -1 auprès des coéquipiers).
 * - Poterie cassée : +3 REP si c'était la plus difficile encore présente, sinon +1.
 *
 * Un swipe = une phase : l'aller jusqu'à la plateforme d'un coup, puis un saut à la fois ; après le saut (réussi ou définitivement
 * raté) le retour au départ se fait d'un coup.
 *
 * Minimap : 4 cases (0 départ, 1 et 2 nage, 3 plateforme), un marqueur par équipe.
 */
class PotteryRelay extends RelayRace {
    static get ID() {
        return "POTTERY";
    }
    constructor(params) {
        const merged = { ...DEFAULT_PARAMS, ...(params || {}) };
        super(PotteryRelay.ID, merged, merged.swimCells);
        // couleur -> { phase: "READY" | "PLATFORM", diver, pots: seuils restants (croissants), attempts, collars }
        this.state = {};
    }

    start(game) {
        this.initTeams(game);
        this.initRelay();
        const p = this.params;
        this.colors.forEach((color) => {
            const pots = [];
            for (var n = 0; n < p.pots; n++) {
                pots.push(p.potBase + n * p.potStep);
            }
            this.state[color] = { phase: "READY", diver: null, pots, attempts: 0, collars: 0 };
        });
        game.vars.raceLog = "";
        this.refresh(game);
    }
    cellLabel(index) {
        return index == 0 ? "\u{1F3C1}" : (index == this.length ? "\u{1F3FA}" : "\u{1F30A}");
    }
    /** Nage sur `swimCells` cases (test de SWI : 2 cases si réussi, 1 sinon). @returns {number} nombre de tests */
    swim(diver) {
        const p = this.params;
        var left = p.swimCells;
        var tests = 0;
        while (left > 0) {
            tests++;
            left -= diver.rollStat("SWI").total >= p.swimThreshold ? Math.min(2, left) : 1;
        }
        return tests;
    }
    /** Le sauteur non-joueur vise la plus difficile s'il a de bonnes chances, sinon la plus facile. */
    wantsHardest(diver, st) {
        return 21 + diver.attributes.STR + diver.attributes.AGI >= st.pots[st.pots.length - 1] - 2;
    }

    actTeam(game, color, side) {
        const p = this.params;
        const st = this.state[color];
        const who = this.teamLabel(color);
        const mine = color == this.playerColor;
        const tag = mine ? "" : " (" + who + ")";

        if (st.phase == "READY") {
            const diver = this.chooseDiver(color, mine ? side : null);
            this.markDived(color, diver);
            const tests = this.swim(diver);
            st.diver = diver;
            st.attempts = 0;
            st.phase = "PLATFORM";
            this.positions[color] = this.length;
            return (diver.isPlayer ? "Vous nagez" : diver.name + " nage") + " jusqu'à la plateforme (" + tests + " test" + (tests > 1 ? "s" : "") + " de SWI), le maillet à la main." + tag;
        }

        // Sur la plateforme : choix de la poterie, puis saut (jet combiné STR + AGI)
        const diver = st.diver;
        const name = diver.isPlayer ? "Vous" : diver.name;
        const hardest = diver.isPlayer && mine ? side == "right" : this.wantsHardest(diver, st);
        const index = hardest ? st.pots.length - 1 : 0;
        const threshold = st.pots[index];
        const strRoll = diver.rollStat("STR");
        const agiRoll = diver.rollStat("AGI");
        const total = strRoll.total + agiRoll.total;
        const detail = "(STR + AGI : " + total + " / " + threshold + ")";
        const kind = hardest ? "la plus difficile" : "la plus facile";
        st.attempts++;

        if (total >= threshold) {
            // Poterie cassée : le collier est ramené au départ
            st.pots.splice(index, 1);
            st.collars++;
            const rep = hardest ? p.hardRep : p.easyRep;
            game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: diver.name, value: rep });
            const tests = this.swim(diver);
            st.phase = "READY";
            st.diver = null;
            this.positions[color] = 0;
            if (st.collars >= p.pots) {
                this.finishRace(game, color, diver, diver.name + " ramène le dernier collier", "l'épreuve des poteries");
                return name + " saute et brise " + kind + " " + detail + " : le dernier collier est ramené au départ !";
            }
            return name + " saute et brise " + kind + " " + detail + " ! Il ramène le collier à la nage (" + tests + " test" + (tests > 1 ? "s" : "") + ") et passe le relais (" + st.collars + "/" + p.pots + ")." + tag;
        }
        if (st.attempts < p.attempts) {
            return name + " saute sur " + kind + " poterie " + detail + " : elle résiste ! Un deuxième essai est permis." + tag;
        }
        // Deuxième échec : retour sans collier, seul cas de REP négative
        const tests = this.swim(diver);
        st.phase = "READY";
        st.diver = null;
        this.positions[color] = 0;
        game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: "TEAM", about: diver.name, value: -p.failRep });
        return name + " rate encore " + detail + " : il rentre à la nage sans collier (" + tests + " test" + (tests > 1 ? "s" : "") + ") et passe le relais." + tag;
    }

    refresh(game) {
        const color = this.playerColor;
        const st = this.state[color];
        const rival = this.colors.find((c) => c != color);
        const p = this.params;
        var text;
        var left;
        var right;
        if (st.phase == "PLATFORM") {
            const mine = st.diver.isPlayer;
            const easy = st.pots[0];
            const hard = st.pots[st.pots.length - 1];
            text = (mine ? "Vous êtes" : st.diver.name + " est") + " sur la plateforme (essai " + (st.attempts + 1) + "/" + p.attempts + "). "
                + "Poterie la plus facile : seuil " + easy + ", la plus difficile : seuil " + hard + " (d20 + STR et d20 + AGI).";
            left = mine ? "Viser la plus facile" : "Encourager " + st.diver.name;
            right = mine ? "Viser la plus difficile" : left;
        } else {
            const next = this.nextInOrder(color);
            text = "Colliers ramenés : " + st.collars + "/" + p.pots + ". ";
            if (next) {
                text += "Prochain nageur : " + (next.isPlayer ? "vous" : next.name) + ".";
                left = right = next.isPlayer ? "Nager jusqu'à la plateforme" : "Encourager " + next.name;
            } else if (this.freeDivers(color).some((m) => m.isPlayer)) {
                text += "Tout le monde est passé : qui y va ? Pas deux fois de suite.";
                left = "Y aller moi-même";
                right = "Envoyer le meilleur nageur";
            } else {
                text += "Vous venez de nager : un coéquipier y va.";
                left = right = "Encourager l'équipe";
            }
        }
        game.vars.nextStep = text;
        game.vars.stepActionLeft = left;
        game.vars.stepActionRight = right;
        this.statusText = "Colliers : votre équipe " + st.collars + "/" + p.pots + (rival ? " · adversaires " + this.state[rival].collars + "/" + p.pots : "");
    }
}

export { PotteryRelay }
