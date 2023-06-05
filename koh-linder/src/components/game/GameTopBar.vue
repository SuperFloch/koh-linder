<template>
    <div>
        <div class="col">Day : {{ game.currentDay }}</div>
        <div class="col">Team : {{ computeTeam.color }}</div>
        <div class="col">Energy : {{ game.getEntityByName("{player}").energy }}</div>
    </div>
</template>
<script>
import { Game } from 'src/model/Game';
import { defineComponent } from 'vue';

export default defineComponent({
    props:{
        game: {
            type: Game
        }
    },
    computed:{
        computeTeam: function(){
            return this.game.teams.find(t => t.color == this.game.getEntityByName("{player}").team);
        }
    }
})
</script>
<style></style>