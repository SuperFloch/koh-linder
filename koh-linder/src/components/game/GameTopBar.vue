<template>
    <div>
        <div class="col">Day : {{ game.currentDay }}</div>
        <div class="col">Energy : </div>
    </div>
</template>
<script>
import { Game } from 'src/model/Game';
import { defineComponent } from 'vue'

export default defineComponent({
    props:{
        game: {
            type: Game
        }
    },
})
</script>
<style></style>