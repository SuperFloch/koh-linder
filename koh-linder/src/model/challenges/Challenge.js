import { RelationGauge, RollContext, CardMode } from "../Character";
import { mark } from "../Personalize";

/**
 * Étapes (cases) réutilisables par les épreuves de course. Chaque épreuve les assemble dans son parcours (`steps`) et peut
 * y ajouter ses propres étapes spécifiques (ex. FireCourse : COLOR et FIRE).
 */
const Step = {
    RUN: "RUN",                       // course : test individuel de STR
    HURDLE: "HURDLE",                 // haie : test individuel d'AGI
    JOINT_RUN: "JOINT_RUN",           // course en duo : jet joint de STR
    JOINT_OBSTACLE: "JOINT_OBSTACLE"  // obstacle en duo, la courte échelle : jet joint AGI (celui qui monte) + STR (celui qui porte)
};

/**
 * Manière d'aborder une étape : choisie par le joueur en swipant (gauche / droite), tirée au hasard pour les non-joueurs.
 */
const Mode = {
    NORMAL: "NORMAL",       // étape sans choix
    MODERATE: "MODERATE",   // course modérée (gauche) : +1 case
    SPRINT: "SPRINT",       // sprint (droite) : +2 cases, coûte de l'énergie
    STEP_OVER: "STEP_OVER", // enjamber la haie (gauche) : seuil très bas, coûte de l'énergie
    JUMP: "JUMP",           // sauter la haie (droite) : seuil plus haut, gratuit, impressionne
    CLIMB: "CLIMB",         // courte échelle, gauche : le joueur est au-dessus (jet d'AGI)
    CARRY: "CARRY"          // courte échelle, droite : le joueur est en dessous et porte (jet de STR)
};

const STEP_ICONS = {
    RUN: "\u{1F3C3}",
    HURDLE: "\u{1F6A7}",
    JOINT_RUN: "\u{1F91D}",
    JOINT_OBSTACLE: "\u{1F9D7}"
};

/** Paramètres des étapes génériques, fusionnés sous les paramètres propres à chaque épreuve (et surchargeables par eux). */
const STEP_PARAMS = {
    runThreshold: 8,              // course individuelle : STR (course modérée ou sprint)
    sprintExtraEnergy: 2,         // énergie en plus du jet de STR (1) : un sprint coûte 3 au total
    moderateFailRep: 1,           // REP perdue auprès du binôme quand une course modérée échoue
    stepOverThreshold: 4,         // haie enjambée : AGI, seuil très bas
    stepOverEnergy: 1,            // haie enjambée : coûte 1 énergie
    jumpThreshold: 12,            // haie sautée : AGI, seuil plus haut, 0 énergie
    jumpRep: 1,                   // REP gagnée auprès de tous les autres quand le saut réussit
    jointRunThreshold: 25,        // course en duo : jet joint de STR (somme des deux participants)
    jointObstacleThreshold: 27,   // courte échelle : jet joint (AGI du grimpeur + STR du porteur)
    ladderFailRep: 1,             // REP perdue entre les deux membres du duo quand la courte échelle échoue
    // REP gagnée / perdue auprès de tous les autres selon le classement final : seuls les 1er, 2e, avant-dernier et dernier
    // changent (victoire +5, 2e place +4, piètre performance -4, dernière place -5) ; les autres rangs ne changent rien
    rankRewards: { first: 5, second: 4, penultimate: -4, last: -5 }
};

/**
 * Classe de base d'une épreuve. Chaque épreuve (nage, équilibre sur l'eau...) hérite de cette classe, vit dans
 * `model/challenges/` et est enregistrée dans `challenges/index.js` sous son identifiant (`ID`).
 *
 * Le moteur (`Game`) ne connaît aucune épreuve en particulier : les effets `CHALLENGE_*` désignent l'épreuve
 * par son identifiant dans la propriété `target` de l'effet, et `Game` délègue à la méthode correspondante.
 * Les textes de carte propres à l'épreuve passent par `game.vars`.
 *
 * Une épreuve garde un score d'avancement par candidat ; `visible` indique s'il est affiché au-dessus de la zone
 * de carte (`display` choisit le composant d'affichage). Pour une épreuve par équipes, c'est le score d'équipe
 * qui doit être affiché.
 *
 * Outils partagés par les épreuves :
 * - **Jet joint** (`jointRoll`) : les résultats (d20 + stat) de tous les participants (duo, équipe...) sont additionnés
 *   et comparés à un seuil élevé : un partenaire catastrophique compromet presque toujours la réussite.
 * - **Étapes** (`Step` / `Mode`) : `resolveSolo` (RUN, HURDLE) et `resolveJoint` (JOINT_RUN, JOINT_OBSTACLE) appliquent les
 *   règles de ces cases. Elles s'appuient sur des points d'accroche à fournir par l'épreuve : `advance`, `segmentRemaining`,
 *   `partnerOf` (voir RaceChallenge pour `advance` et `segmentRemaining`).
 */
class Challenge {
    constructor(id, params) {
        this.id = id;
        this.params = { ...STEP_PARAMS, ...(params || {}) };
        this.visible = false;
        // true : épreuve de natation (la minimap affiche des cases bleues)
        this.swimming = false;
        // Clé du composant d'affichage du score (voir InGamePage), "" = aucun
        this.display = "";
        // Candidats engagés dans l'épreuve
        this.candidates = [];
        // Partie en cours (renseignée par Game au démarrage de l'épreuve)
        this.game = null;
    }
    /** Effet CHALLENGE_START : initialise l'épreuve avec les candidats de la partie. */
    start(game) { }
    /** Effet CHALLENGE_MOVE : modifie le score d'avancement du candidat `effect.about` de `effect.value`. */
    move(game, effect) { }
    /**
     * Carte de type CHALLENGE_TURN : joue un tour avec le sens de swipe choisi.
     * @returns {string} valeur de `next` pour la carte suivante
     */
    playTurn(game, leftOrRight, card) {
        return card.challenge ? card.challenge.onFinish : "END";
    }
    /** Effet CHALLENGE_UPDATE : fait avancer le déroulement automatique de l'épreuve (ex: choix des non-joueurs). */
    update(game, effect) { }
    /** Effet CHALLENGE_END : résultats et conséquences (classement, REP, énergie...). */
    end(game) { }
    /** Effet CHALLENGE_CLOSE : retire l'épreuve (et son affichage). */
    close(game) { }

    // --- Points d'accroche pour les étapes (à surcharger) ---

    /** Fait avancer `candidate` de `cells` cases. */
    advance(candidate, cells) { }
    /** Nombre de cases consécutives de même type devant `candidate` (limite l'avance d'un sprint). */
    segmentRemaining(candidate) {
        return 1;
    }
    /** Binôme de `candidate` (objet Candidate) ou null / undefined s'il n'en a pas. */
    partnerOf(candidate) {
        return null;
    }

    // --- Outils communs ---

    /**
     * Variation de REP selon un rang final (index 0 = premier) parmi `total` classés : seuls les 1er, 2e, avant-dernier et
     * dernier ont un changement (voir `rankRewards`). En cas de recouvrement (peu de classés), le haut du classement prime.
     */
    rankReward(index, total) {
        const r = this.params.rankRewards;
        if (index == 0) return r.first;
        if (index == 1) return r.second;
        if (index == total - 1) return r.last;
        if (index == total - 2) return r.penultimate;
        return 0;
    }
    /** "1er", "2e"... d'un rang (index 0 = premier), pour les descriptions du journal. */
    rankWord(index, total, candidate) {
        const feminine = (word) => (candidate && candidate.sex == "F" ? word.replace(/ier$/, "ière") : word);
        if (index == 0) return feminine("premier");
        if (index == 1) return "deuxième";
        if (index == total - 1) return feminine("dernier");
        if (index == total - 2) return feminine("avant-dernier");
        return (index + 1) + "e";
    }
    isPlayerName(name) {
        const c = this.candidates.find((o) => o.name == name);
        return !!c && c.isPlayer;
    }
    /**
     * Jet de d20 + stat dans un contexte (RollContext) : si le candidat a une carte de personnage associée à ce contexte et à
     * la valeur naturelle du d20, la carte est jouée (effets appliqués, carte montrée au joueur) et remplace la résolution
     * classique du jet.
     * @returns {{roll: Object, card: Object|null, text: string}} `card` non nul = le jet est remplacé ; `text` = texte de la carte
     */
    rollWithCards(c, stat, context) {
        const roll = c.rollStat(stat);
        const drawn = this.game ? this.game.drawCharacterCard(c, context, roll.d20) : null;
        const text = drawn ? this.game.playCharacterCard(c, drawn) : "";
        // Carte « intercalée » (mode INSERT) : elle se joue entre le jet et sa résolution, qui se déroule ensuite normalement
        const card = drawn && drawn.mode != CardMode.INSERT ? drawn : null;
        return { roll, card, text: card ? text : "", inserted: drawn && !card ? drawn : null };
    }
    /**
     * Jet combiné d'un candidat : d20 + statA et d20 + statB, dont la SOMME est comparée au seuil (`bonus` optionnel ajouté à la somme).
     * @returns {{ok: boolean, total: number, text: string}}
     */
    combinedRoll(candidate, statA, statB, threshold, bonus) {
        const a = candidate.rollStat(statA);
        const b = candidate.rollStat(statB);
        const total = a.total + b.total + (bonus || 0);
        return { ok: total >= threshold, total, text: "(" + statA + " + " + statB + " : " + total + " / " + threshold + ")" };
    }
    rollToString(stat, roll, threshold) {
        return stat + " " + roll.bonus + " + d20 " + roll.d20 + " = " + roll.total + " / " + threshold;
    }
    /**
     * Jet joint : chaque participant lance d20 + stat, les totaux sont additionnés et comparés au seuil.
     * @param {Candidate[]} members participants (duo, équipe...)
     * @param {string|string[]} stats une stat commune, ou une stat par participant (même ordre que `members`)
     * @param {number} threshold seuil sur la somme des totaux
     * @param {string} [context] RollContext optionnel : une carte de personnage d'un participant liée à ce contexte et à son d20
     *   se déclenche (effets appliqués, carte montrée au joueur) ; elle fait réussir le jet joint.
     * @returns {{ok: boolean, total: number, rolls: Object[], text: string, card: Object|null}}
     */
    jointRoll(members, stats, threshold, context) {
        const statOf = (i) => (Array.isArray(stats) ? stats[i] : stats);
        const same = !Array.isArray(stats) || stats.every((s) => s == stats[0]);
        const rolls = members.map((member, i) => ({ member, stat: statOf(i), roll: member.rollStat(statOf(i)) }));
        const total = rolls.reduce((sum, r) => sum + r.roll.total, 0);
        const parts = rolls.map((r) => (r.member.isPlayer ? "vous" : r.member.name) + (same ? "" : " (" + r.stat + ")") + " " + r.roll.total);
        var card = null;
        var cardText = "";
        if (context && this.game) {
            for (const r of rolls) {
                card = this.game.drawCharacterCard(r.member, context, r.roll.d20);
                if (card) {
                    cardText = " Carte « " + card.name + " » : " + this.game.playCharacterCard(r.member, card);
                    break;
                }
            }
        }
        // Une carte qui REMPLACE le jet le fait réussir ; une carte intercalée (INSERT) laisse la résolution normale
        const replaces = !!card && card.mode != CardMode.INSERT;
        return {
            ok: total >= threshold || replaces,
            total,
            rolls,
            card,
            text: "(jet joint" + (same ? " de " + statOf(0) : "") + " : " + parts.join(" + ") + " = " + total + " / " + threshold + ")" + cardText
        };
    }

    // --- Étapes ---

    /** Manière d'aborder l'étape selon le sens de swipe du joueur. */
    modeFor(step, side) {
        switch (step) {
            case Step.RUN:
            case Step.JOINT_RUN:
                return side == "right" ? Mode.SPRINT : Mode.MODERATE;
            case Step.HURDLE:
                return side == "right" ? Mode.JUMP : Mode.STEP_OVER;
            case Step.JOINT_OBSTACLE:
                return side == "right" ? Mode.CARRY : Mode.CLIMB;
            default:
                return Mode.NORMAL;
        }
    }
    /** Choix d'un non-joueur (ou d'un duo sans joueur) : les costauds sprintent, les agiles sautent, si l'énergie le permet. */
    aiMode(step, members) {
        const avg = (stat) => members.reduce((s, m) => s + m.attributes[stat], 0) / members.length;
        const minEnergy = Math.min(...members.map((m) => m.energy));
        switch (step) {
            case Step.RUN:
            case Step.JOINT_RUN:
                return minEnergy > 10 && Math.random() < 0.15 + 0.04 * avg("STR") ? Mode.SPRINT : Mode.MODERATE;
            case Step.HURDLE:
                return Math.random() < 0.25 + 0.06 * avg("AGI") ? Mode.JUMP : Mode.STEP_OVER;
            default:
                return Mode.NORMAL;
        }
    }
    /** Mode d'une étape : le swipe du joueur s'il fait partie des participants, sinon le choix de l'IA. */
    chooseMode(step, members, side) {
        return members.some((m) => m.isPlayer) ? this.modeFor(step, side) : this.aiMode(step, members);
    }
    /**
     * Résout une étape individuelle (RUN ou HURDLE) pour `c`.
     * @param {string} side sens de swipe du joueur (utilisé seulement si `c` est le joueur)
     * @param {Function} logIf (noms, texte) : enregistre le compte rendu si le joueur est concerné
     */
    resolveSolo(step, c, side, logIf) {
        const p = this.params;
        const mode = this.chooseMode(step, [c], side);
        if (step == Step.RUN) {
            const { roll, card, text } = this.rollWithCards(c, "STR", RollContext.RUN);
            if (card) {
                // Carte de personnage : remplace la résolution classique de la course
                logIf([c.name], "« " + card.name + " » : " + text);
                return;
            }
            const ok = roll.total >= p.runThreshold;
            const detail = "(" + this.rollToString("STR", roll, p.runThreshold) + ")";
            if (mode == Mode.SPRINT) {
                c.changeEnergy(-p.sprintExtraEnergy);
                const gain = ok ? Math.min(2, this.segmentRemaining(c)) : 1;
                this.advance(c, gain);
                logIf([c.name], "Sprint " + detail + " : " + (ok ? "vous bondissez de " + gain + (gain > 1 ? " cases !" : " case.") : "le sprint tourne court, vous n'avancez que d'une case."));
            } else if (ok) {
                this.advance(c, 1);
                logIf([c.name], "Course modérée " + detail + " : vous avancez d'une case.");
            } else {
                const partner = this.partnerOf(c);
                if (partner) {
                    partner.changeRelation(c.name, RelationGauge.REP, -p.moderateFailRep);
                }
                logIf([c.name], "Course modérée " + detail + " : vous trébuchez, vous n'avancez pas." + (partner ? " " + partner.name + " soupire." : ""));
            }
        } else if (step == Step.HURDLE) {
            const jump = mode == Mode.JUMP;
            const threshold = jump ? p.jumpThreshold : p.stepOverThreshold;
            if (!jump) {
                c.changeEnergy(-p.stepOverEnergy);
            }
            const { roll, card, text } = this.rollWithCards(c, "AGI", RollContext.HURDLE);
            if (card) {
                logIf([c.name], "« " + card.name + " » : " + text);
                return;
            }
            const ok = roll.total >= threshold;
            if (ok) {
                this.advance(c, 1);
                if (jump) {
                    // Un saut réussi impressionne tout le monde
                    this.candidates.filter((o) => o.name != c.name).forEach((o) => o.changeRelation(c.name, RelationGauge.REP, p.jumpRep));
                }
            }
            const detail = "(" + this.rollToString("AGI", roll, threshold) + ")";
            logIf([c.name], jump
                ? "Saut " + detail + " : " + (ok ? "impeccable ! La haie est franchie sous les regards admiratifs." : "raté, vous restez devant la haie.")
                : "Haie enjambée " + detail + " : " + (ok ? "passée prudemment." : "vous accrochez la haie, vous restez devant."));
        }
    }
    /**
     * Résout une étape en jet joint (JOINT_RUN ou JOINT_OBSTACLE) pour un duo (ou tout groupe) déjà réuni sur la même case.
     * - JOINT_RUN : jet joint de STR. Gauche : course modérée (+1 case ; échec : pas d'avance et -1 REP entre les membres).
     *   Droite : sprint (+2 cases, énergie ; échec : +1 case).
     * - JOINT_OBSTACLE (courte échelle) : celui qui monte fait un jet d'AGI, celui qui porte un jet de STR. Swipe gauche : le
     *   joueur monte ; droite : il porte. Réussite : tout le monde avance d'une case ; échec : pas d'avance et -1 REP entre
     *   les deux membres.
     * @param {Candidate[]} members les participants (deux pour la courte échelle)
     */
    resolveJoint(step, members, side, logIf) {
        const p = this.params;
        const mode = this.chooseMode(step, members, side);
        const names = members.map((m) => m.name);
        // Le duo, pour les comptes rendus au pluriel : « Laurent et Camille » (prénom du joueur surligné)
        const duo = members.map((m) => (m.isPlayer ? mark(m.name) : m.name)).join(" et ");
        const loseRepBetween = (value) => {
            members.forEach((a) => members.filter((b) => b.name != a.name).forEach((b) => a.changeRelation(b.name, RelationGauge.REP, -value)));
        };

        if (step == Step.JOINT_OBSTACLE) {
            // Rôles : le joueur choisit par son swipe ; sans joueur, celui qui a le meilleur rapport AGI / STR monte
            const player = members.find((m) => m.isPlayer);
            var climber;
            if (player) {
                climber = mode == Mode.CLIMB ? player : members.find((m) => m.name != player.name);
            } else {
                climber = (members[0].attributes.AGI - members[0].attributes.STR) >= (members[1].attributes.AGI - members[1].attributes.STR) ? members[0] : members[1];
            }
            const carrier = members.find((m) => m.name != climber.name);
            const outcome = this.jointRoll([climber, carrier], ["AGI", "STR"], p.jointObstacleThreshold);
            const role = climber.isPlayer ? "Vous montez sur les épaules de " + carrier.name
                : (carrier.isPlayer ? "Vous portez " + climber.name : climber.name + " monte sur les épaules de " + carrier.name);
            if (outcome.ok) {
                members.forEach((m) => this.advance(m, 1));
            } else {
                loseRepBetween(p.ladderFailRep);
            }
            logIf(names, "Courte échelle " + outcome.text + " : " + role + (outcome.ok ? ", et " + duo + " franchissent l'obstacle ensemble !" : ", mais ça vacille : " + duo + " retombent et se reprochent le raté."));
            return;
        }

        // JOINT_RUN
        const outcome = this.jointRoll(members, "STR", p.jointRunThreshold);
        if (mode == Mode.SPRINT) {
            members.forEach((m) => m.changeEnergy(-p.sprintExtraEnergy));
            const gain = outcome.ok ? Math.min(2, this.segmentRemaining(members[0])) : 1;
            members.forEach((m) => this.advance(m, gain));
            logIf(names, "Sprint en duo " + outcome.text + " : " + (outcome.ok ? duo + " bondissent ensemble de " + gain + (gain > 1 ? " cases !" : " case.") : "le sprint tourne court, une case seulement."));
        } else if (outcome.ok) {
            members.forEach((m) => this.advance(m, 1));
            logIf(names, "Course en duo modérée " + outcome.text + " : " + duo + " avancent ensemble d'une case.");
        } else {
            // Un échec en course modérée froisse les binômes
            loseRepBetween(p.moderateFailRep);
            logIf(names, "Course en duo modérée " + outcome.text + " : raté, " + duo + " ne progressent pas et se reprochent le faux pas.");
        }
    }
    /**
     * Texte des boutons de swipe et consigne affichée pour une étape générique (null pour les étapes propres à une épreuve).
     * @returns {{left: string, right: string, text: string}|null}
     */
    describeStep(step, partnerName) {
        const p = this.params;
        switch (step) {
            case Step.RUN:
                return {
                    left: "Courir modérément (+1 case)",
                    right: "Sprinter (+2 cases, " + (p.sprintExtraEnergy + 1) + " énergie)",
                    text: "course. Modérément : une case, mais un échec fait perdre l'estime de votre binôme. Sprint : jusqu'à deux cases, mais très fatigant."
                };
            case Step.HURDLE:
                return {
                    left: "Enjamber (facile, " + p.stepOverEnergy + " énergie)",
                    right: "Sauter (difficile, impressionne)",
                    text: "une haie. L'enjamber est facile mais fatigant ; la sauter est plus risqué mais gratuit, et impressionne."
                };
            case Step.JOINT_RUN:
                return {
                    left: "Courir en duo (modéré, +1 case)",
                    right: "Sprinter en duo (+2 cases, " + (p.sprintExtraEnergy + 1) + " énergie chacun)",
                    text: "course en duo avec " + partnerName + " (jet joint : vos scores s'additionnent)."
                };
            case Step.JOINT_OBSTACLE:
                return {
                    left: "Monter sur ses épaules (jet d'AGI)",
                    right: "Porter (jet de STR)",
                    text: "la courte échelle avec " + partnerName + " : jet joint, celui qui monte lance l'AGI et celui qui porte la STR. Un échec fait perdre l'estime aux deux binômes."
                };
            default:
                return null;
        }
    }
}

export { Challenge, Step, Mode, STEP_ICONS, STEP_PARAMS }
