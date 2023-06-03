<template>
    <div>
        <div>Koh-Linder</div>
        <div>
            <div @click="onNewGame">Nouvelle partie</div>
            <div @click="onLoadGame">Charger partie</div>
            <div @click="onAchievements">Succès</div>
            <div @click="onQuit">Quitter</div>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MainMenuPage',
  emits: ['newGame','loadGame', 'achievements', 'quit'],
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