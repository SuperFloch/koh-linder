<template>
    <div class="topbar">
        <div class="item">Jour {{ game.currentDay }}<span v-if="game.period"> · {{ periodLabel }}</span></div>
        <div class="item team" :class="teamClass">{{ teamLabel }}</div>
        <div class="item">Énergie {{ game.getEntityByName("{player}").energy }}</div>
        <button class="candidatesBtn" aria-label="Liste des candidats" @click="showCandidates = true">&#128101;</button>
        <CandidateListModal v-model="showCandidates" :game="game" />
    </div>
</template>
<script>
import { Game } from 'src/model/Game';
import { defineComponent } from 'vue';
import CandidateListModal from './CandidateListModal.vue';
import { PERIOD_LABELS } from 'src/model/Time';

const TEAM_LABELS = { YELLOW: 'Équipe jaune', RED: 'Équipe rouge' };

export default defineComponent({
    components: {
        CandidateListModal
    },
    props:{
        game: {
            type: Game
        }
    },
    data: function(){
        return {
            showCandidates: false
        }
    },
    computed:{
        periodLabel(){
            return PERIOD_LABELS[this.game.period];
        },
        computeTeam: function(){
            return this.game.teams.find(t => t.color == this.game.getEntityByName("{player}").team);
        },
        teamClass(){
            return this.computeTeam ? 'team-' + this.computeTeam.color.toLowerCase() : '';
        },
        teamLabel(){
            if(!this.computeTeam){
                return 'Sans équipe';
            }
            const base = TEAM_LABELS[this.computeTeam.color] || this.computeTeam.color;
            // Nom tribal une fois attribué
            return this.computeTeam.name ? base + ' · ' + this.computeTeam.name : base;
        }
    }
})
</script>
<style scoped>
.topbar {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 10px 8px;
    font-weight: 700;
    color: var(--sand);
    background-color: var(--wood);
    border-bottom: 3px solid var(--sand);
}
.team {
    padding: 2px 12px;
    border-radius: 12px;
}
.candidatesBtn {
    font-size: 1.2rem;
    line-height: 1;
    padding: 6px 10px;
    cursor: pointer;
    color: var(--wood);
    background-color: var(--sand);
    border: 2px solid var(--sand);
    border-radius: 8px;
}
</style>
