<template>
    <div class="picker">
        <div class="portraits">
            <button v-for="c in sorted" :key="c.name" class="portrait" :class="stateClass(c)" :style="borderStyle(c)"
                :disabled="!isSelectable(c)" :title="c.name" @click="onSelect(c)">
                <span class="face">{{ c.name.charAt(0) }}</span>
                <span class="label">{{ c.name }}</span>
                <span class="chief" v-if="isChief(c)">&#128081;</span>
            </button>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { Game } from 'src/model/Game';
import { TeamCssColor } from 'src/model/Team';

/**
 * Portraits de tous les candidats pendant la formation des équipes. Le joueur chef clique sur un portrait pour désigner son
 * choix avant de swiper pour valider. Les candidats déjà choisis sont bordés de la couleur de leur équipe et non sélectionnables.
 */
export default defineComponent({
    props: {
        game: {
            type: Game
        },
        challenge: {
            type: Object
        }
    },
    computed: {
        sorted() {
            return this.game.candidates.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        }
    },
    methods: {
        isChief(c) {
            return this.challenge.chiefs.some((chief) => chief.name == c.name);
        },
        isSelectable(c) {
            return this.challenge.isSelectable(this.game, c.name);
        },
        onSelect(c) {
            this.challenge.select(this.game, c.name);
        },
        stateClass(c) {
            return {
                selected: this.challenge.selection == c.name,
                taken: c.team != 'NONE',
                // En attente du tour du joueur : les candidats libres du bon sexe sont mis en avant
                available: this.isSelectable(c)
            };
        },
        borderStyle(c) {
            const color = TeamCssColor[c.team];
            return color ? { borderColor: color } : {};
        }
    }
})
</script>
<style scoped>
.picker {
    padding: 6px;
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
    position: relative;
    width: 54px;
    padding: 2px 0;
    text-align: center;
    cursor: default;
    color: var(--sand-soft);
    background: transparent;
    border: 3px solid transparent;
    border-radius: 10px;
    opacity: 0.55;
}
.portrait.available {
    cursor: pointer;
    opacity: 1;
}
.portrait.taken {
    opacity: 1;
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
.chief {
    position: absolute;
    top: -6px;
    right: -2px;
    font-size: 0.8rem;
}
</style>
