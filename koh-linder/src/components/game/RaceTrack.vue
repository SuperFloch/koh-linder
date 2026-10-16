<template>
    <div class="trackWrap">
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
            <div class="gaugeLabel">{{ gauge.label }}</div>
            <div class="gaugeBar">
                <div v-for="n in gauge.size" :key="n" class="gaugeTick" :style="{ bottom: (n / gauge.size * 100) + '%' }"></div>
                <span v-for="(it, i) in gauge.items" :key="it.key" class="gaugeMarker" :class="{ mine: it.mine }" :title="it.title"
                    :style="{ bottom: 'calc(' + (it.value / gauge.size * 100) + '% - 6px)', backgroundColor: it.bg, left: (i * 9 + 1) + 'px' }"></span>
            </div>
        </div>
        <div class="track">
            <div v-for="cell in cells" :key="cell.index" class="cell" :class="{ shore: cell.index == challenge.length }">
                <div class="cellLabel">{{ cell.label }}</div>
                <div class="avatars">
                    <div v-for="m in cell.markers" :key="m.key" class="avatar" :class="{ player: m.large, teamMarker: !!m.bg, apnea: m.apnea }"
                        :style="markerStyle(m)" :title="m.title || m.key">{{ m.text }}</div>
                </div>
                <div class="balls" v-if="cell.balls.length">
                    <span v-for="b in cell.balls" :key="b.key" class="ball" :class="{ mine: b.mine }" :style="{ backgroundColor: b.bg }"></span>
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

/**
 * Minimap d'une épreuve de course : une colonne par case avec les marqueurs fournis par l'épreuve (`markersAt`) :
 * un avatar par candidat, ou un seul marqueur par équipe (couleur de l'équipe) pour les épreuves d'équipe.
 */
export default defineComponent({
    props: {
        challenge: {
            type: Object
        },
        candidates: {
            type: Array
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
                cells.push({
                    index: i,
                    label: this.challenge.cellLabel(i),
                    markers: this.challenge.markersAt(i),
                    balls: this.challenge.ballsAt ? this.challenge.ballsAt(i) : []
                });
            }
            return cells;
        }
    },
    methods: {
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
    margin: 8px 8px 0;
}
.status {
    margin-top: 4px;
    padding: 2px 10px;
    text-align: center;
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--wood);
    background-color: var(--sand);
    border: 4px solid transparent;
    border-radius: 8px;
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
    font-size: 0.7rem;
    line-height: 1;
    color: var(--sand);
}
.gaugeBar {
    position: relative;
    flex: 1;
    width: 20px;
    margin: 4px 0 6px;
    border: 2px solid var(--sand);
    border-radius: 8px;
    background-color: var(--sea);
}
.gaugeTick {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background-color: rgba(250, 231, 157, 0.35);
}
.gaugeMarker {
    position: absolute;
    box-sizing: border-box;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--wood);
}
.gaugeMarker.mine {
    border-color: var(--sand);
}
/* Puzzle : une grille 5 x 5 par équipe */
.grids {
    display: flex;
    justify-content: center;
    gap: 12px;
}
.gridBox {
    padding: 3px;
    border: 3px solid var(--sand);
    border-radius: 8px;
    background-color: var(--sea);
    text-align: center;
}
.gridBox.mine {
    box-shadow: 0 0 0 2px var(--sand);
}
.grid {
    display: grid;
    grid-template-columns: repeat(5, 12px);
    gap: 1px;
}
.gridCell {
    width: 12px;
    height: 12px;
    background-color: rgba(250, 231, 157, 0.15);
}
.gridCount {
    font-size: 0.65rem;
    color: var(--sand);
}
.track {
    flex: 1;
    min-width: 0;
    display: flex;
    border: 3px solid var(--sand);
    border-radius: 10px;
    background-color: var(--sea);
    overflow: hidden;
}
.cell {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 64px;
    border-right: 1px solid rgba(250, 231, 157, 0.35);
    text-align: center;
    overflow: hidden;
}
.cell:last-child {
    border-right: none;
    flex: 1.4;
    background-color: var(--jungle);
}
.cellLabel {
    font-size: 0.65rem;
    line-height: 1.2;
    color: var(--sand);
    opacity: 0.8;
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
    color: var(--wood);
    background-color: var(--sky);
    border: 1px solid transparent;
}
.avatar.player {
    width: 20px;
    height: 20px;
    line-height: 17px;
    font-size: 11px;
    color: var(--wood);
    background-color: var(--sand);
    border: 2px solid var(--wood);
    box-shadow: 0 0 0 2px var(--sand);
}
/* Marqueur d'équipe : une pastille de la couleur de l'équipe (anneau sable pour l'équipe du joueur) */
.avatar.teamMarker {
    width: 16px;
    height: 16px;
    line-height: 12px;
    font-size: 9px;
    border: 2px solid var(--wood);
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
    border: 1px solid var(--wood);
}
.ball.mine {
    border-color: var(--sand);
}
.count {
    position: absolute;
    right: 1px;
    bottom: 0;
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--sand);
}
</style>
