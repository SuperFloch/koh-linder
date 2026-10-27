<template>
    <!-- Planche de bois : titre de l'épreuve, puis piste / grilles en cases de sable -->
    <div class="trackWrap" ref="wrap">
        <div class="trackTitle display-font" v-if="title">{{ title }}</div>
        <!-- Puzzle : une grille par équipe, une case colorée par pièce bien placée -->
        <div class="grids" v-if="grids.length">
            <div v-for="g in grids" :key="g.key" class="gridBox" :class="{ mine: g.mine }" :style="{ borderColor: g.bg }">
                <div class="grid">
                    <span v-for="(on, i) in g.cells" :key="i" class="gridCell" :style="on ? { backgroundColor: g.bg } : {}"></span>
                </div>
                <div class="gridCount">{{ g.count }}/{{ g.cells.length }}</div>
            </div>
        </div>
        <div class="trackRow" v-else>
        <!-- Indicateur vertical (ex: hauteur des grimpeurs dans la tour) -->
        <div class="gauge" v-if="gauge" :title="gauge.label">
            <div class="gaugeLabel"><TrackIcon v-if="iconOf(gauge.label)" :name="iconOf(gauge.label).name" size="16px" /><template v-else>{{ gauge.label }}</template></div>
            <div class="gaugeBar">
                <div v-for="n in gauge.size" :key="n" class="gaugeTick" :style="{ bottom: (n / gauge.size * 100) + '%' }"></div>
                <span v-for="(it, i) in gauge.items" :key="it.key" class="gaugeMarker" :class="{ mine: it.mine }" :title="it.title"
                    :style="{ bottom: 'calc(' + (it.value / gauge.size * 100) + '% - 6px)', backgroundColor: it.bg, left: (i * 9 + 1) + 'px' }"></span>
            </div>
        </div>
        <div class="track" :class="{ swim: challenge.swimming }">
            <div v-for="cell in cells" :key="cell.index" class="cell" :class="{ shore: cell.index == challenge.length }">
                <!-- Libellé : « @nom » = icône SVG (TrackIcon), « @nom:texte » = icône + petit texte, sinon texte simple -->
                <div class="cellLabel"><template v-if="cell.icon"><TrackIcon :name="cell.icon.name" /><span v-if="cell.icon.text" class="iconText">{{ cell.icon.text }}</span></template><template v-else>{{ cell.label }}</template></div>
                <div class="avatars">
                    <div v-for="m in cell.markers" :key="m.key" :data-fly="'m:' + m.key" class="avatar" :class="{ player: m.large, teamMarker: !!m.bg, apnea: m.apnea }"
                        :style="markerStyle(m)" :title="m.title || m.key">{{ m.text }}</div>
                </div>
                <div class="balls" v-if="cell.balls.length">
                    <span v-for="b in cell.balls" :key="b.key" :data-fly="'b:' + b.key" class="ball" :class="{ mine: b.mine }" :style="{ backgroundColor: b.bg }"></span>
                </div>
                <div class="count" v-if="cell.markers.length > 1">{{ cell.markers.length }}</div>
            </div>
        </div>
        </div>
        <!-- Information propre au joueur (ex: "En duo avec Camille") -->
        <div class="status" v-if="challenge.statusText" :style="challenge.statusColor ? { borderColor: challenge.statusColor } : {}">{{ challenge.statusText }}</div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import TrackIcon from './TrackIcon.vue';

// Durée du déplacement animé d'un marqueur d'une case à l'autre (ms)
const FLY_MS = 480;

/** « @nom » ou « @nom:texte » -> { name, text } ; null pour un libellé texte. */
function parseIcon(label) {
    if (typeof label != 'string' || label.charAt(0) != '@') {
        return null;
    }
    const [name, text] = label.slice(1).split(':');
    return { name, text: text || '' };
}

/**
 * Minimap d'une épreuve de course : une colonne par case avec les marqueurs fournis par l'épreuve (`markersAt`) :
 * un avatar par candidat, ou un seul marqueur par équipe (couleur de l'équipe) pour les épreuves d'équipe.
 * Quand un marqueur (ou une boule) change de case, il glisse de son ancienne position vers la nouvelle (animation FLIP :
 * un double animé dans un calque au-dessus de la piste, le temps que le vrai marqueur, déjà à sa place, réapparaisse).
 */
export default defineComponent({
    components: {
        TrackIcon
    },
    props: {
        challenge: {
            type: Object
        },
        candidates: {
            type: Array
        },
        // Nom de l'épreuve (catalogue), affiché en tête de la planche
        title: {
            type: String,
            default: ''
        }
    },
    computed: {
        // Indicateur vertical optionnel fourni par l'épreuve (`gauge()`)
        gauge() {
            return this.challenge.gauge ? this.challenge.gauge() : null;
        },
        // Grilles optionnelles fournies par l'épreuve (`grids()`) : remplacent la piste
        grids() {
            return this.challenge.grids ? this.challenge.grids() : [];
        },
        cells() {
            if (this.grids.length) {
                return [];
            }
            const cells = [];
            for (var i = 0; i <= this.challenge.length; i++) {
                const label = this.challenge.cellLabel(i);
                cells.push({
                    index: i,
                    label,
                    icon: parseIcon(label),
                    markers: this.challenge.markersAt(i),
                    balls: this.challenge.ballsAt ? this.challenge.ballsAt(i) : []
                });
            }
            return cells;
        }
    },
    beforeUpdate() {
        // Positions des marqueurs avant le nouveau rendu
        this.flyRects = this.measure();
    },
    updated() {
        this.flyFrom(this.flyRects);
    },
    beforeUnmount() {
        this.clearFlights();
    },
    methods: {
        iconOf(label) {
            return parseIcon(label);
        },
        /** Positions (relatives à la planche) des éléments animables, par clé. */
        measure() {
            const wrap = this.$refs.wrap;
            const rects = {};
            if (!wrap) {
                return rects;
            }
            const origin = wrap.getBoundingClientRect();
            wrap.querySelectorAll('[data-fly]').forEach((el) => {
                if (el.dataset.flying) {
                    return;
                }
                const r = el.getBoundingClientRect();
                rects[el.dataset.fly] = { left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height };
            });
            return rects;
        },
        /** Fait glisser les éléments qui ont changé de place depuis `before`. */
        flyFrom(before) {
            const wrap = this.$refs.wrap;
            if (!wrap || !before || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
                return;
            }
            const after = this.measure();
            wrap.querySelectorAll('[data-fly]').forEach((el) => {
                const key = el.dataset.fly;
                const from = before[key];
                const to = after[key];
                if (!from || !to || (Math.abs(from.left - to.left) < 2 && Math.abs(from.top - to.top) < 2)) {
                    return;
                }
                // Double animé, posé à l'ancienne place, qui glisse (avec un petit saut) vers la nouvelle
                const ghost = el.cloneNode(true);
                ghost.removeAttribute('data-fly');
                ghost.classList.add('flyGhost');
                Object.assign(ghost.style, { left: from.left + 'px', top: from.top + 'px', width: to.width + 'px', height: to.height + 'px' });
                wrap.appendChild(ghost);
                el.dataset.flying = '1';
                el.style.visibility = 'hidden';
                const dx = to.left - from.left;
                const dy = to.top - from.top;
                const animation = ghost.animate([
                    { transform: 'translate(0, 0) scale(1)' },
                    { transform: 'translate(' + dx / 2 + 'px, ' + (dy / 2 - 10) + 'px) scale(1.25)', offset: 0.5 },
                    { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(1)' }
                ], { duration: FLY_MS, easing: 'cubic-bezier(.3, .7, .4, 1)' });
                const land = () => {
                    ghost.remove();
                    el.style.visibility = '';
                    delete el.dataset.flying;
                };
                animation.onfinish = land;
                animation.oncancel = land;
                (this.flights = this.flights || []).push(animation);
            });
        },
        clearFlights() {
            (this.flights || []).forEach((a) => a.cancel());
            this.flights = [];
        },
        markerStyle(m) {
            const style = {};
            if (m.bg) {
                style.backgroundColor = m.bg;
            }
            if (m.border) {
                style.borderColor = m.border;
                style.borderWidth = '2px';
            }
            return style;
        }
    }
})
</script>
<style scoped>
.trackWrap {
    position: relative;
    padding: 7px 9px 8px;
    border-radius: 10px;
    background-color: var(--wood-light);
    border: 2px solid var(--wood-dark);
    box-shadow: 0 4px 0 var(--wood-dark);
}
.trackTitle {
    margin-bottom: 5px;
    font-size: 0.95rem;
    line-height: 1;
    color: var(--sand-soft);
}
.status {
    margin-top: 6px;
    padding: 2px 10px;
    text-align: center;
    font-weight: 700;
    font-size: 0.8rem;
    color: var(--wood-dark);
    background-color: var(--sand-soft);
    border: 3px solid transparent;
    border-radius: 6px;
}
.trackRow {
    display: flex;
    align-items: stretch;
    gap: 4px;
}
/* Indicateur vertical : barre graduée avec un marqueur par équipe (de bas en haut) */
.gauge {
    flex: none;
    width: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.gaugeLabel {
    font-size: 0.6rem;
    line-height: 1;
    color: var(--sand-soft);
}
.gaugeBar {
    position: relative;
    flex: 1;
    width: 18px;
    margin: 4px 0 2px;
    border: 2px solid var(--wood-dark);
    border-radius: 8px;
    background-color: var(--sand-soft);
}
.gaugeTick {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background-color: var(--sand-deep);
}
.gaugeMarker {
    position: absolute;
    box-sizing: border-box;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--wood);
    transition: bottom 0.45s cubic-bezier(.3, .7, .4, 1);
}
.gaugeMarker.mine {
    box-shadow: 0 0 0 2px var(--amber);
}
/* Puzzle : une grille 5 x 5 par équipe, cases de sable */
.grids {
    display: flex;
    justify-content: center;
    gap: 14px;
}
.gridBox {
    padding: 3px;
    border: 3px solid var(--wood-dark);
    border-radius: 6px;
    background-color: var(--sky); /* puzzle aquatique : fond bleu */
    text-align: center;
}
.gridBox.mine {
    box-shadow: 0 0 0 2px var(--amber);
}
.grid {
    display: grid;
    grid-template-columns: repeat(5, 12px);
    gap: 1px;
}
.gridCell {
    width: 12px;
    height: 12px;
    background-color: #1c7f96; /* case vide : bleu plus profond */
    transition: background-color 0.4s;
}
.gridCount {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--sea);
}
/* Piste : cases de sable sur la planche, l'arrivée en ambre */
.track {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 2px;
}
.cell {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 48px;
    border-radius: 4px;
    background-color: var(--sand-soft);
    text-align: center;
    overflow: hidden;
}
/* Épreuve de natation : cases bleues (sauf l'arrivée) */
.track.swim .cell:not(:last-child) {
    background-color: var(--sky);
}
.track.swim .cellLabel {
    color: var(--sea);
}
.cell:last-child {
    flex: 1.4;
    background-color: var(--amber);
}
.cellLabel {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 15px;
    font-size: 0.55rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--wood-mid);
}
.iconText {
    margin-left: -1px;
    font-size: 0.5rem;
}
/* Double animé d'un marqueur qui change de case (voir flyFrom), au-dessus de la piste */
.flyGhost {
    position: absolute;
    z-index: 5;
    margin: 0;
    pointer-events: none;
}
.avatars {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1px;
    padding: 0 1px;
}
.avatar {
    box-sizing: border-box;
    width: 13px;
    height: 13px;
    line-height: 11px;
    font-size: 7px;
    font-weight: 900;
    border-radius: 50%;
    color: var(--sand-soft);
    background-color: var(--wood-mid);
    border: 1px solid transparent;
}
.avatar.player {
    width: 20px;
    height: 20px;
    line-height: 16px;
    font-size: 11px;
    color: var(--wood-dark);
    background-color: var(--amber);
    border: 2px solid var(--wood-dark);
}
/* Marqueur d'équipe : une pastille de la couleur de l'équipe */
.avatar.teamMarker {
    width: 16px;
    height: 16px;
    line-height: 12px;
    font-size: 9px;
    border: 2px solid var(--wood-dark);
}
/* Nageur en apnée : marqueur grisé avec un léger filtre bleu foncé */
.avatar.apnea {
    filter: grayscale(0.7) brightness(0.8);
    box-shadow: inset 0 0 0 10px rgba(10, 35, 90, 0.55);
}
.balls {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 2px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2px;
}
/* Poids immergés : une boule de la couleur de l'équipe (anneau sable pour l'équipe du joueur) */
.ball {
    box-sizing: border-box;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1px solid var(--wood-dark);
}
.ball.mine {
    box-shadow: 0 0 0 1px var(--amber);
}
.count {
    position: absolute;
    right: 1px;
    bottom: 0;
    font-size: 0.55rem;
    font-weight: 700;
    color: var(--wood-dark);
}
</style>
