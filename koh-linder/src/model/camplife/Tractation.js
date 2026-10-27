import { pick, shuffle } from "../CandidateGenerator";
import { decide, DecisionContext, rollD6Modifier } from "../Decision";
import { HistoryType } from "../GameHistory";

/**
 * Tractations : influencer les votes du prochain conseil par la discussion (action « Discuter » de la vie de camp, et discussions
 * des non-joueurs entre eux).
 *
 * - Une tractation est un plaidoyer d'un `speaker` auprès d'un `listener` pour CHARGER ou DÉFENDRE une `target`. Jet de
 *   d20 + SOC (séduire) ou INT (argumenter) + AFF du listener envers le speaker + poids du JOURNAL (faits récents sur la cible) ...
 *   contre un seuil. Le SOC compte surtout avec l'AFF, l'INT surtout avec les faits du journal.
 * - Une réussite crée une INFLUENCE : un bonus (CHARGE) ou malus (DEFEND) de « désaveu » du listener envers la cible, valable pour
 *   le prochain conseil seulement. L'influence peut être un PACTE (alliance) : bonus plus fort, le listener votera comme promis.
 * - Un pacte du joueur peut se briser avant le conseil (mauvais comportement : sa relation avec le joueur s'est dégradée ; ou
 *   influence adverse : d'autres ont travaillé le même candidat).
 * - Le désaveu (`disfavor`) d'un votant envers une cible = -(AFF + REP) + humeur (un d6 tiré une fois par conseil) + influences.
 *   Le votant choisit la cible au plus haut désaveu (`voteOf`) ; c'est aussi ce qu'il confie quand on le sonde.
 *
 * Aucune de ces valeurs n'est jamais montrée au joueur.
 */
const PitchKind = { CHARGE: "CHARGE", DEFEND: "DEFEND" };

const PARAMS = {
    threshold: 14,        // seuil d'un plaidoyer (d20 + stat + bonus)
    probeThreshold: 13,   // seuil pour sonder l'avis d'un interlocuteur (d20 + SOC + AFF)
    opinionThreshold: 13, // seuil pour que l'interlocuteur partage un avis (d20 + (SOC + INT)/2 + AFF + accord avec le journal)
    lieMalus: 3,          // malus quand on charge quelqu'un sans fait réel au journal
    detectThreshold: 15,  // d20 + OBS du listener pour démasquer un mensonge
    simpleWeight: 2,      // désaveu ajouté par un appui simple, par point de force
    pactWeight: 3,        // idem pour un pacte (+ pactBase)
    pactBase: 2,
    journalDays: 5,       // fenêtre du journal (jours)
    npcPitchChance: 0.6   // part des discussions des non-joueurs qui sont des tractations
};

/** Texte d'un modèle : remplace {clé} par les valeurs. */
function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m));
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/** Signe d'une entrée du journal : +1 positive, -1 négative. */
function journalSign(entry) {
    const v = entry.data && typeof entry.data.value == "number" ? entry.data.value : 0;
    if (v !== 0) {
        return v > 0 ? 1 : -1;
    }
    return [HistoryType.CHALLENGE_FAILURE, HistoryType.CAMP_FAULT, HistoryType.DISPUTE].includes(entry.type) ? -1 : 1;
}
/** Poids d'une entrée (1 à 5). */
function journalMagnitude(entry) {
    const v = entry.data && typeof entry.data.value == "number" ? Math.abs(entry.data.value) : 2;
    return clamp(v || 2, 1, 5);
}
/** Une entrée du journal est connue d'une équipe sauf si tous ses participants sont dans l'autre équipe. */
function visibleTo(entry, color) {
    return !(entry.teams.length > 0 && entry.teams.every((t) => t != "NONE" && t != color));
}

class Tractations {
    constructor() {
        this.reset();
    }
    /** Efface tout (après chaque conseil : l'influence ne vaut que pour le prochain conseil). */
    reset() {
        this.influences = []; // { speaker, listener, target, kind, strength, pact, status, baseline, day }
        this.moods = {};      // votant -> cible -> humeur (d6), tirée une fois par conseil
        this.counts = {};     // listener -> nombre de plaidoyers reçus (lassitude)
    }

    // --- Journal ---

    /**
     * Entrées récentes du journal concernant un candidat, connues de l'équipe `color`. Une entrée négative ne compte que pour son
     * auteur (premier participant) ; une entrée positive pour tous ses participants.
     * @returns {{entry, sign, magnitude}[]}
     */
    journalEntries(game, target, color, days) {
        const since = game.currentDay - (days || PARAMS.journalDays);
        const list = [];
        game.history.entries.forEach((entry) => {
            if (entry.day < since || !visibleTo(entry, color) || !entry.participants.includes(target.id)) {
                return;
            }
            const sign = journalSign(entry);
            if (sign < 0 && entry.participants[0] != target.id && entry.participants.length <= 2) {
                return;
            }
            list.push({ entry, sign, magnitude: journalMagnitude(entry) });
        });
        return list;
    }
    /** Poids du journal sur un candidat, de -4 (très mal vu) à +4 (très bien vu), du point de vue de l'équipe `color`. */
    journalScore(game, target, color) {
        const sum = this.journalEntries(game, target, color).reduce((s, e) => s + e.sign * e.magnitude, 0);
        return clamp(Math.round(sum / 2), -4, 4);
    }
    /**
     * Sujet de conversation d'un interlocuteur : un fait récent du journal sur un coéquipier (de préférence marquant), sinon une
     * impression générale. @returns {{target: Candidate, sign: number, fact: string|null, text: string}}
     */
    pickTopic(game, interlocutor, player) {
        const mates = game.teamMembers(interlocutor.team).filter((m) => m.name != interlocutor.name && m.name != player.name);
        const found = [];
        mates.forEach((mate) => {
            this.singleEntries(game, mate, interlocutor.team).forEach((e) => found.push({ ...e, target: mate }));
        });
        if (found.length) {
            found.sort((a, b) => b.magnitude - a.magnitude);
            const chosen = pick(shuffle(found.slice(0, 4)));
            return this.topicText(game, interlocutor, chosen.target, chosen);
        }
        // Pas de fait marquant : impression générale sur un coéquipier (jamais le joueur)
        const negative = Math.random() < 0.7;
        const target = decide({ deciders: [interlocutor], options: mates, context: negative ? DecisionContext.NEGATIVE : DecisionContext.POSITIVE }) || mates[0];
        return this.topicText(game, interlocutor, target, null);
    }
    /** Sujet de conversation sur un candidat précis (« détourner ») : un fait du journal à son sujet s'il y en a, sinon une impression. */
    topicFor(game, interlocutor, target) {
        const facts = this.singleEntries(game, target, interlocutor.team);
        return this.topicText(game, interlocutor, target, facts.length ? pick(facts) : null);
    }
    /** Entrées récentes du journal qui ne concernent que ce candidat (pas de victoire d'équipe ni d'évènement à plusieurs). */
    singleEntries(game, target, color) {
        return this.journalEntries(game, target, color).filter((e) => e.entry.participants.length == 1);
    }
    /** Texte que prononce l'interlocuteur à propos de `target` (modèles de resources/council.json → topics). */
    topicText(game, interlocutor, target, fact) {
        const texts = (game.content.resources.council || {}).topics || {};
        const pickText = (key, fallback) => {
            const list = texts[key];
            return fill(list && list.length ? pick(list) : fallback, { target: target.name, fact: fact ? fact.entry.description : "", e: interlocutor.sex == "F" ? "e" : "" });
        };
        if (fact) {
            return {
                target, sign: fact.sign, fact: fact.entry.description,
                text: fact.sign < 0 ? pickText("negativeFact", "{fact}. Franchement, je me pose des questions sur {target}.")
                    : pickText("positiveFact", "{fact}. Il faut le reconnaître, {target} s'accroche.")
            };
        }
        // Sans fait : l'impression de l'interlocuteur, d'après l'estime qu'il porte au candidat
        const negative = interlocutor.relationScore(target.name) < 2 && Math.random() < 0.7;
        return {
            target, sign: negative ? -1 : 1, fact: null,
            text: negative ? pickText("negativeGeneric", "Franchement, {target} ne me dit rien qui vaille.")
                : pickText("positiveGeneric", "{target} est quelqu'un de bien, je trouve.")
        };
    }

    // --- Plaidoyer ---

    /**
     * Jet d'un plaidoyer. `tone` : SOC (séduire) ou INT (argumenter). `lie` : charger sans fait réel au journal (malus, risque d'être
     * démasqué). @returns {{ok, strength, d20, total, threshold, exposed, label}} `label` = détail du jet pour l'affichage (converti en label)
     */
    pitch(game, { speaker, listener, kind, target, tone, lie, bonus, roll: given }) {
        const roll = given || speaker.rollStat(tone);
        const aff = clamp(listener.affection(speaker.name), -8, 12);
        const affBonus = clamp(Math.round(aff * (tone == "SOC" ? 0.5 : 0.25)), -6, 6);
        // Le journal sur la cible : les faits négatifs aident à charger, les positifs à défendre
        const journal = this.journalScore(game, target, listener.team) * (kind == PitchKind.CHARGE ? -1 : 1);
        const journalBonus = Math.round(journal * (tone == "INT" ? 1 : 0.5));
        // Crédibilité de l'orateur : un mauvais bilan récent pèse
        const credibility = Math.round(Math.min(0, this.journalScore(game, speaker, speaker.team)) / 2);
        // Avis préalable du listener sur la cible
        const opinionRaw = Math.round(listener.relationScore(target.name) / 3);
        const opinion = clamp(kind == PitchKind.CHARGE ? -opinionRaw : opinionRaw, -3, 3);
        const prior = this.counts[listener.name] || 0;
        const threshold = PARAMS.threshold;
        let total = roll.total + affBonus + journalBonus + credibility + opinion + (bonus || 0) - (lie ? PARAMS.lieMalus : 0) - prior;
        let exposed = false;
        if (lie && listener.rollStat("OBS").total >= PARAMS.detectThreshold) {
            exposed = true;
        }
        const ok = !exposed && total >= threshold;
        const margin = total - threshold;
        let strength = margin >= 10 || roll.d20 == 20 ? 3 : (margin >= 5 ? 2 : 1);
        strength = Math.max(1, strength - Math.floor(prior / 2));
        this.counts[listener.name] = prior + 1;
        return {
            ok, strength, d20: roll.d20, total, threshold, exposed,
            label: "(" + tone + " " + (total - roll.d20) + " + d20 " + roll.d20 + " = " + total + " / " + threshold + ")"
        };
    }
    /** Enregistre l'influence d'un plaidoyer réussi (ou d'un pacte). */
    addInfluence(game, { speaker, listener, target, kind, strength, pact }) {
        this.influences.push({
            speaker: speaker.name, listener: listener.name, target: target.name, kind, strength, pact: !!pact,
            status: pact ? "ACTIVE" : null, baseline: listener.relationScore(speaker.name), day: game.currentDay
        });
    }
    /** Sondage (SOC + affection) : le listener confie-t-il ce qu'il pense d'un candidat ? @returns {{ok, label}} */
    probe(speaker, listener) {
        const roll = speaker.rollStat("SOC");
        const total = roll.total + clamp(Math.round(listener.affection(speaker.name) / 2), -3, 4);
        return { ok: total >= PARAMS.probeThreshold, label: "(SOC " + (total - roll.d20) + " + d20 " + roll.d20 + " = " + total + " / " + PARAMS.probeThreshold + ")" };
    }
    /**
     * Échange d'opinions (SOC + INT + affection) : le listener partage-t-il l'avis du joueur sur un candidat ? `aligned` : l'avis
     * va dans le sens du journal et de l'estime du listener. @returns {{ok, label}}
     */
    opinion(speaker, listener, aligned) {
        const roll = speaker.rollStat("SOC");
        const stat = Math.round((speaker.attributes.SOC + speaker.attributes.INT) / 2);
        const total = roll.d20 + stat + clamp(Math.round(listener.affection(speaker.name) / 2), -5, 5) + aligned;
        return { ok: total >= PARAMS.opinionThreshold, label: "(SOC + INT : " + total + " / " + PARAMS.opinionThreshold + ")" };
    }

    // --- Vote ---

    mood(voter, target) {
        if (!this.moods[voter.name]) {
            this.moods[voter.name] = {};
        }
        if (this.moods[voter.name][target.name] === undefined) {
            this.moods[voter.name][target.name] = rollD6Modifier();
        }
        return this.moods[voter.name][target.name];
    }
    /** Influences actives qui pèsent sur un votant à propos d'une cible (somme signée : + = contre la cible). */
    influenceMod(voter, target) {
        return this.influences.reduce((sum, inf) => {
            if (inf.listener != voter.name || inf.target != target.name || inf.status == "BROKEN") {
                return sum;
            }
            const weight = inf.pact ? PARAMS.pactWeight * inf.strength + PARAMS.pactBase : PARAMS.simpleWeight * inf.strength;
            return sum + (inf.kind == PitchKind.CHARGE ? weight : -weight);
        }, 0);
    }
    /** Désaveu d'un votant envers une cible : plus il est haut, plus il veut l'éliminer. */
    disfavor(voter, target) {
        return -voter.relationScore(target.name) + this.mood(voter, target) + this.influenceMod(voter, target);
    }
    /**
     * Vote d'un non-joueur parmi `options` (candidats). Un pacte « CHARGE » actif lui fait voter la cible promise ; un pacte
     * « DEFEND » protège la cible. Sinon : le plus haut désaveu ; égalités : le moins aimé (AFF), puis le hasard.
     */
    voteOf(voter, options) {
        const eligible = options.filter((o) => o.name != voter.name);
        if (!eligible.length) {
            return null;
        }
        const active = this.influences.filter((i) => i.pact && i.listener == voter.name && i.status == "ACTIVE");
        const forced = active.find((i) => i.kind == PitchKind.CHARGE && eligible.some((o) => o.name == i.target));
        if (forced) {
            return eligible.find((o) => o.name == forced.target);
        }
        const protectedNames = active.filter((i) => i.kind == PitchKind.DEFEND).map((i) => i.target);
        const open = eligible.filter((o) => !protectedNames.includes(o.name));
        const pool = open.length ? open : eligible;
        const scored = shuffle(pool).map((o) => ({ option: o, score: this.disfavor(voter, o), aff: -voter.affection(o.name) }));
        scored.sort((a, b) => (b.score - a.score) || (b.aff - a.aff));
        return scored[0].option;
    }

    // --- Pactes du joueur ---

    /** Pactes (ACTIVE) conclus par un orateur. */
    pactsOf(speakerName) {
        return this.influences.filter((i) => i.pact && i.speaker == speakerName && i.status == "ACTIVE");
    }
    /**
     * Veille du conseil : les pactes du joueur tiennent-ils ? Brisé si la relation de l'allié avec le joueur s'est dégradée d'au moins
     * 4 (mauvais comportement) ou si la pression adverse (influences d'autres orateurs, pactes comptant davantage) dépasse sa fidélité.
     * @returns {{pact, ally: string, broken: boolean, reason: string}[]}
     */
    checkPacts(game, player, attendeeNames) {
        return this.pactsOf(player.name).filter((p) => attendeeNames.includes(p.listener)).map((pact) => {
            const ally = game.getEntityByName(pact.listener);
            const current = ally.relationScore(pact.speaker);
            const worse = pact.baseline - current;
            const pressure = this.influences.reduce((sum, inf) => {
                if (inf === pact || inf.listener != pact.listener || inf.speaker == pact.speaker || inf.status == "BROKEN") {
                    return sum;
                }
                const opposes = pact.kind == PitchKind.CHARGE
                    ? (inf.kind == PitchKind.CHARGE ? inf.target != pact.target : inf.target == pact.target)
                    : (inf.kind == PitchKind.CHARGE && inf.target == pact.target);
                return opposes ? sum + (inf.pact ? PARAMS.pactWeight * inf.strength + PARAMS.pactBase : PARAMS.simpleWeight * inf.strength) : sum;
            }, 0);
            const hold = 2 * pact.strength + Math.floor(current / 2) + rollD6Modifier();
            let reason = "";
            if (worse >= 4) {
                reason = "conduct";
            } else if (hold < pressure) {
                reason = "rival";
            }
            if (reason) {
                pact.status = "BROKEN";
            }
            return { pact, ally: pact.listener, broken: !!reason, reason };
        });
    }

    // --- Non-joueurs ---

    /**
     * Tractation d'un non-joueur auprès d'un coéquipier. Si le listener est le joueur, il s'agit d'une confidence (pas d'influence,
     * le joueur décide seul). @returns {{toPlayer: boolean, kind, target: Candidate, ok: boolean}|null}
     */
    npcPitch(game, speaker, listener) {
        const mates = game.teamMembers(speaker.team).filter((m) => m.name != speaker.name && m.name != listener.name);
        if (!mates.length) {
            return null;
        }
        const kind = Math.random() < 0.75 ? PitchKind.CHARGE : PitchKind.DEFEND;
        const target = decide({ deciders: [speaker], options: mates, context: kind == PitchKind.CHARGE ? DecisionContext.NEGATIVE : DecisionContext.POSITIVE });
        if (listener.isPlayer) {
            return { toPlayer: true, kind, target, ok: true };
        }
        const tone = speaker.attributes.SOC >= speaker.attributes.INT ? "SOC" : "INT";
        const result = this.pitch(game, { speaker, listener, kind, target, tone, lie: false });
        if (result.ok) {
            this.addInfluence(game, { speaker, listener, target, kind, strength: result.strength, pact: result.strength >= 2 && Math.random() < 0.3 });
        }
        return { toPlayer: false, kind, target, ok: result.ok };
    }
}

export { Tractations, PitchKind, PARAMS as TRACTATION_PARAMS, fill, journalSign, visibleTo }
