import { il, mark } from "../Personalize";
import { EffectType } from "../Effect";
import { RelationGauge, RollContext } from "../Character";
import { HistoryType } from "../GameHistory";
import { PitchKind } from "./Tractation";

/** Accord selon le sexe : forme masculine ou féminine. */
function fem(candidate, masculine, feminine) {
    return candidate.sex == "F" ? feminine : masculine;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Déroulé de la tractation du joueur (l'action « Discuter » de la vie de camp), jouée au swipe. Quelle que soit l'issue, la
 * discussion consomme UNE action de la période. Chaque carte offre une échappatoire (clore la conversation).
 *
 * 1. SUJET (TOPIC) — l'interlocuteur évoque un fait récent du journal qui ne concerne qu'un seul candidat.
 *    Haut : sonder (jet de SOC + affection) : en cas de réussite l'interlocuteur dit la vérité sur son opinion de ce candidat (indice sur
 *    son affection), sinon rien. Gauche : opinion négative ; droite : opinion positive (jet de SOC + INT + affection : l'interlocuteur
 *    partage-t-il l'avis ?). Bas : détourner la conversation sur quelqu'un d'autre (une seule fois : on clique un portrait et on
 *    valide en swipant à DROITE, gauche annule) ; une fois utilisé, bas devient « Clore la conversation ».
 * 2. ACTION (après gauche, droite ou haut) — gauche : proposer de voter contre le candidat ; droite : proposer d'éviter de voter
 *    contre lui ; haut : proposer un PACTE de vote contre lui (alliance, jet plus difficile) ; bas : clore la conversation.
 * 3. MANIÈRE (MANNER) — gauche : convaincre (INT) ; droite : séduire (SOC). Le jet décide de la proposition : simple appui
 *    ébranlé (force 1), convaincu (2) ou conquis (3) ; un pacte réussi est une alliance qui peut se briser avant le conseil.
 * Voir Tractation.js pour les règles du jet et de l'influence. Les comptes rendus désignent le joueur par `mark(prénom)` (surligné).
 */
class TalkFlow {
    constructor(game, camp, player, partner) {
        this.game = game;
        this.camp = camp;
        this.player = player;
        this.partner = partner;
        this.tr = game.tractations;
        this.step = "TOPIC";
        this.topic = this.tr.pickTopic(game, partner, player);
        this.subject = this.topic.target;
        this.lead = partner.name + " vous prend à part : ";
        this.detoured = false;  // « détourner » n'est possible qu'une fois par discussion
        this.opinion = 0;       // avis exprimé par le joueur : -1 négatif, +1 positif, 0 aucun
        this.rapport = 0;       // bonus ou malus au jet final (l'interlocuteur partage ou non l'avis)
        this.agreed = null;     // true / false si un avis a été exprimé
        this.context = "";      // résultat de la dernière étape, rappelé sur la carte suivante
        this.kind = null;
        this.pact = false;      // la proposition est un pacte de vote (haut de la carte 2)
        this.parts = [];        // morceaux du compte rendu final
        this.picker = null;     // { names, selection } pendant le choix d'un nom
    }
    get me() {
        return mark(this.player.name);
    }

    // --- Affichage ---

    /** Nœud de choix courant, au format de l'arbre des tâches de CampLife. */
    node() {
        const p = this.partner.name;
        const t = this.subject.name;
        switch (this.step) {
            case "PICK": {
                const sel = this.picker && this.picker.selection;
                return {
                    question: "De qui voulez-vous parler à la place de " + t + " ? Cliquez sur un portrait, puis swipez à droite pour valider.",
                    left: { label: "Annuler" },
                    right: { label: sel ? "Parler de " + sel : "Choisissez un portrait" }
                };
            }
            case "ACTION":
                return {
                    question: (this.context ? this.context + "\n" : "") + "Que proposez-vous à " + p + " à propos de " + t + " ?",
                    left: { label: "Proposer de voter contre " + t },
                    right: { label: "Proposer d'éviter de voter contre " + t },
                    up: { label: "Pacte : voter ensemble contre " + t },
                    down: { label: "Clore la conversation" }
                };
            case "MANNER":
                return {
                    question: "Comment présentez-vous votre proposition à " + p + " ?",
                    left: { label: "Convaincre (INT)" },
                    right: { label: "Séduire (SOC)" }
                };
            default:
                return {
                    question: this.lead + "« " + this.topic.text + " »",
                    left: { label: "Opinion négative sur " + t },
                    right: { label: "Opinion positive sur " + t },
                    up: { label: "Sonder " + p + " (SOC)" },
                    down: { label: this.detoured ? "Clore la conversation" : "Détourner sur quelqu'un d'autre" }
                };
        }
    }
    /** Candidats désignables par « détourner » : les coéquipiers, hors joueur, interlocuteur et sujet actuel. */
    openPicker() {
        const excluded = [this.player.name, this.partner.name, this.subject.name];
        this.picker = { names: this.game.teamMembers(this.player.team).filter((m) => !excluded.includes(m.name)).map((m) => m.name), selection: null };
        this.step = "PICK";
    }
    select(name) {
        if (this.picker && this.picker.names.includes(name)) {
            this.picker.selection = this.picker.selection == name ? null : name;
        }
    }

    // --- Déroulé ---

    /**
     * Un swipe du joueur. @returns {{done: boolean, log?: string}} `done` : la tractation est terminée (l'action est dépensée).
     */
    turn(dir) {
        if (!this.node()[dir]) {
            return { done: false };
        }
        switch (this.step) {
            case "PICK":
                return this.turnPick(dir);
            case "ACTION":
                if (dir == "down") {
                    return this.close();
                }
                this.kind = dir == "right" ? PitchKind.DEFEND : PitchKind.CHARGE;
                this.pact = dir == "up";
                this.step = "MANNER";
                return { done: false };
            case "MANNER":
                return this.pitch(dir == "left" ? "INT" : "SOC");
            default:
                if (dir == "up") {
                    return this.probe();
                }
                if (dir == "down") {
                    if (this.detoured) {
                        return this.close();
                    }
                    this.openPicker();
                    return { done: false };
                }
                return this.opine(dir == "left" ? -1 : 1);
        }
    }
    /** Choix d'un nom : droite valide (une sélection est nécessaire), gauche annule. */
    turnPick(dir) {
        if (dir == "left") {
            this.picker = null;
            this.step = "TOPIC";
            return { done: false };
        }
        if (!this.picker.selection) {
            return { done: false };
        }
        const previous = this.subject;
        this.subject = this.game.getEntityByName(this.picker.selection);
        this.topic = this.tr.topicFor(this.game, this.partner, this.subject);
        this.lead = "Vous orientez la conversation vers " + this.subject.name + ". " + this.partner.name + " : ";
        this.parts.push(this.me + " fait dévier la conversation de " + previous.name + " vers " + this.subject.name + ".");
        this.detoured = true;
        this.picker = null;
        this.step = "TOPIC";
        return { done: false };
    }
    /** Sonder : SOC + affection ; en cas de réussite, l'interlocuteur dit sincèrement ce qu'il pense du candidat (indice sur son affection). */
    probe() {
        const p = this.partner;
        const t = this.subject;
        const r = this.tr.probe(this.player, p);
        if (r.ok) {
            const aff = p.affection(t.name);
            const hint = aff <= -6 ? "ne supporte plus " + t.name
                : (aff <= -2 ? "n'apprécie pas beaucoup " + t.name
                    : (aff <= 1 ? "n'a pas d'avis tranché sur " + t.name
                        : (aff <= 5 ? "apprécie " + t.name : "adore " + t.name)));
            this.parts.push(this.me + " sonde " + p.name + " " + r.label + " : " + p.name + " confie qu'" + il(p) + " " + hint + ".");
            this.context = r.label + " " + p.name + " confie qu'" + il(p) + " " + hint + ".";
        } else {
            this.parts.push(this.me + " sonde " + p.name + " " + r.label + " : " + p.name + " reste " + fem(p, "évasif", "évasive") + ", impossible d'en savoir plus.");
            this.context = r.label + " " + p.name + " reste " + fem(p, "évasif", "évasive") + ".";
        }
        this.step = "ACTION";
        return { done: false };
    }
    /**
     * Exprimer un avis sur le candidat (jet de SOC + INT + affection) : l'interlocuteur le partage-t-il ? Plus l'avis va dans le sens du
     * journal et de l'estime qu'il porte au candidat, plus c'est facile. Le résultat pèse sur la proposition qui suit.
     */
    opine(sign) {
        const p = this.partner;
        const t = this.subject;
        const regard = this.tr.journalScore(this.game, t, p.team) + clamp(Math.round(p.relationScore(t.name) / 4), -2, 2);
        const r = this.tr.opinion(this.player, p, clamp(sign > 0 ? regard : -regard, -3, 3));
        const said = sign < 0 ? this.me + " critique " + t.name : this.me + " vante les qualités de " + t.name;
        this.game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: p.name, about: this.player.name, value: r.ok ? 1 : -1 });
        this.opinion = sign;
        this.agreed = r.ok;
        this.rapport = r.ok ? 3 : -2;
        this.parts.push(said + " " + r.label + " : " + (r.ok ? p.name + " acquiesce." : p.name + " ne partage pas cet avis."));
        this.context = r.label + " " + (r.ok ? p.name + " partage votre avis." : p.name + " ne partage pas votre avis.");
        this.step = "ACTION";
        return { done: false };
    }
    /** La proposition : jet de SOC (séduire) ou d'INT (convaincre). */
    pitch(tone) {
        const game = this.game;
        const p = this.partner;
        const t = this.subject;
        const rolled = tone == "SOC" ? this.camp.rollWithCards(this.player, "SOC", RollContext.TALK) : { roll: this.player.rollStat("INT"), card: null };
        if (rolled.card) {
            // Une carte de personnage REMPLACE totalement l'évènement
            return { done: true, log: this.parts.concat("Carte « " + rolled.card.name + " » : " + rolled.text).join(" ") };
        }
        // Un avis contraire à la proposition (critiquer puis demander de protéger, ou l'inverse) la rend moins crédible
        const incoherent = this.opinion != 0 && ((this.opinion < 0) != (this.kind == PitchKind.CHARGE));
        // Accuser quelqu'un dont le journal ne dit rien de mal est sans fondement : risque d'être démasqué
        const lie = this.kind == PitchKind.CHARGE && this.tr.journalScore(game, t, p.team) >= 0;
        const r = this.tr.pitch(game, { speaker: this.player, listener: p, kind: this.kind, target: t, tone, lie, bonus: this.rapport - (incoherent ? 3 : 0) - (this.pact ? 2 : 0), roll: rolled.roll });
        const head = this.me + (this.pact ? " propose à " + p.name + " un pacte : voter ensemble contre " + t.name : this.kind == PitchKind.CHARGE ? " propose à " + p.name + " de voter contre " + t.name : " propose à " + p.name + " d'éviter de voter contre " + t.name) + " " + r.label + " :";
        if (r.exposed) {
            game.applyEffect({
                type: EffectType.RELATION, gauge: RelationGauge.AFF, target: p.name, about: this.player.name, value: -2,
                historyType: HistoryType.DISPUTE, description: this.player.name + " est " + fem(this.player, "démasqué", "démasquée") + " en train de manipuler " + p.name
            });
            game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.REP, target: p.name, about: this.player.name, value: -2, history: false });
            return { done: true, log: this.parts.concat(head + " " + p.name + " démasque " + this.me + " : ces accusations n'ont aucun fondement !").join(" ") };
        }
        if (!r.ok) {
            game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: p.name, about: this.player.name, value: -1 });
            return { done: true, log: this.parts.concat(head + " " + p.name + " secoue la tête, " + fem(p, "peu convaincu", "peu convaincue") + ".").join(" ") };
        }
        game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: p.name, about: this.player.name, value: 1 });
        // Le pacte (option haut de la carte 2) est une alliance, qui peut se briser avant le conseil ; les autres propositions sont de simples appuis
        const pact = !!this.pact;
        this.tr.addInfluence(game, { speaker: this.player, listener: p, target: t, kind: this.kind, strength: r.strength, pact });
        let reaction;
        if (pact) {
            reaction = p.name + " accepte. Le pacte est scellé : voter contre " + t.name + ", c'est promis.";
        } else if (r.strength >= 3) {
            reaction = p.name + " est " + fem(p, "conquis", "conquise") + ".";
        } else if (r.strength == 2) {
            reaction = p.name + " est " + fem(p, "convaincu", "convaincue") + ".";
        } else {
            reaction = p.name + " hésite, mais promet d'y réfléchir.";
        }
        return { done: true, log: this.parts.concat(head + " " + reaction).join(" ") };
    }
    /** Clore la conversation : une discussion simple, sans proposition. Elle rapproche, sauf si l'interlocuteur n'a pas partagé l'avis du joueur. */
    close() {
        const p = this.partner;
        if (this.agreed !== false) {
            [[p, this.player], [this.player, p]].forEach(([a, b]) => this.game.applyEffect({ type: EffectType.RELATION, gauge: RelationGauge.AFF, target: a.name, about: b.name, value: 1 }));
        }
        const end = this.parts.length
            ? (this.agreed === false ? "La conversation s'achève sur un désaccord." : "La conversation s'arrête là, sans rien de décidé.")
            : this.me + " bavarde un moment avec " + p.name + ", de choses et d'autres.";
        return { done: true, log: this.parts.concat(end).join(" ") };
    }
}

export { TalkFlow }
