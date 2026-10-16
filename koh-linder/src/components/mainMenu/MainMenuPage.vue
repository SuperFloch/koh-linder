<template>
    <div class="screen">
        <div class="screen-title">Koh-Linder</div>
        <div class="kohPoints" v-if="kohPoints !== null">Koh-points : {{ kohPoints }}</div>
        <div class="menu">
            <button class="tiki-btn" @click="onNewGame">Nouvelle partie</button>
            <button class="tiki-btn" @click="onLoadGame">Charger partie</button>
            <button class="tiki-btn" @click="$emit('adventurers')">Aventuriers</button>
            <button class="tiki-btn" @click="onAchievements">Succès</button>
            <button class="tiki-btn" @click="onQuit">Quitter</button>
            <router-link class="tiki-btn secondary" to="/editor">Éditeur de cartes</router-link>
            <button v-if="debug" class="tiki-btn secondary" @click="$emit('challenges')">&#128030; Épreuves (DEBUG)</button>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { DEBUG } from 'src/debug';

export default defineComponent({
  name: 'MainMenuPage',
  emits: ['newGame','loadGame', 'adventurers', 'achievements', 'quit', 'challenges'],
  data() {
    return { debug: DEBUG };
  },
  props: {
    kohPoints: {
        type: Number,
        default: null
    }
  },
  methods: {
    onNewGame(){
        this.$emit('newGame');
    },
    onLoadGame(){
        this.$emit('loadGame');
    },
    onAchievements(){
        this.$emit('achievements');
    },
    onQuit(){
        this.$emit('quit');
    }
  }
})
</script>
<style scoped>
.kohPoints {
    margin: -16px auto 22px;
    padding: 4px 16px;
    font-weight: 700;
    color: var(--wood-dark);
    background-color: var(--amber);
    border: 2px solid var(--wood-dark);
    border-radius: 999px;
}
.menu {
    width: 100%;
    max-width: 320px;
}
.menu .secondary {
    margin-top: 28px;
}
</style>
