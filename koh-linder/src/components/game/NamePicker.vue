<template>
    <div v-if="source" class="picker">
        <div class="portraits">
            <button v-for="c in options" :key="c.name" class="portrait" :class="{ selected: source.picker.selection == c.name }"
                :title="c.name" @click="onSelect(c)">
                <span class="face" :style="borderStyle(c)">{{ c.name.charAt(0) }}</span>
                <span class="label">{{ c.name }}</span>
            </button>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { Game } from 'src/model/Game';
import { TeamCssColor } from 'src/model/Team';

/**
 * Portraits à choisir au clic (désigner un candidat pendant une tractation, voter au conseil) : le joueur clique sur un portrait,
 * puis swipe pour valider. La source est l'épreuve en cours qui expose un `picker` (voir Game.activePicker).
 */
export default defineComponent({
    props: {
        game: {
            type: Game
        }
    },
    computed: {
        source() {
            return this.game.activePicker;
        },
        options() {
            return this.source ? this.source.picker.names.map((n) => this.game.getEntityByName(n)).filter((c) => !!c) : [];
        }
    },
    methods: {
        onSelect(c) {
            this.source.challenge.selectName(this.game, c.name);
        },
        borderStyle(c) {
            const color = TeamCssColor[c.team];
            return color ? { boxShadow: '0 0 0 3px ' + color } : {};
        }
    }
})
</script>
<style scoped>
.picker {
    padding: 6px;
    margin-top: 6px;
    border: 2px solid var(--wood-dark);
    border-radius: 10px;
    background-color: var(--wood-light);
    box-shadow: 0 4px 0 var(--wood-dark);
}
.portraits {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
}
.portrait {
    width: 54px;
    padding: 2px 0;
    text-align: center;
    cursor: pointer;
    color: var(--sand-soft);
    background: transparent;
    border: 3px solid transparent;
    border-radius: 10px;
}
.portrait.selected {
    background-color: rgba(245, 185, 66, 0.3);
    box-shadow: 0 0 0 3px var(--amber);
}
.face {
    display: block;
    width: 28px;
    height: 28px;
    line-height: 28px;
    margin: 0 auto;
    border-radius: 50%;
    font-size: 0.95rem;
    font-weight: 900;
    color: var(--wood-dark);
    background-color: var(--sand-soft);
}
.label {
    display: block;
    font-size: 0.6rem;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
