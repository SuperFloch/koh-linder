<template>
    <!-- Header en planche de bois : jour à gauche, avatar du joueur au centre (déborde sous le header), énergie à droite -->
    <div class="topbar">
        <div class="side left">
            <div class="day display-font">Jour {{ game.currentDay }}</div>
            <div class="sub">{{ periodLabel || 'Aventure' }}</div>
        </div>
        <button class="avatar display-font" :style="avatarStyle" :aria-label="'Votre fiche et la liste des candidats'"
            @click="showCandidates = true"><Face :id="player.id" :name="player.name" /></button>
        <div class="side right">
            <div class="energyRow"><span>Énergie</span><span>{{ player.energy }}</span></div>
            <div class="gauge" role="img" :aria-label="'Énergie ' + player.energy + ' sur 100'">
                <div class="gaugeFill" :style="{ width: player.energy + '%' }"></div>
            </div>
            <div class="team" :class="teamClass">{{ teamLabel }}</div>
        </div>
        <CandidateListModal v-model="showCandidates" :game="game" />
    </div>
</template>
<script>
import { Game } from 'src/model/Game';
import { defineComponent } from 'vue';
import Face from 'src/components/game/Face.vue';
import CandidateListModal from './CandidateListModal.vue';
import { PERIOD_LABELS } from 'src/model/Time';
import { TeamCssColor } from 'src/model/Team';

const TEAM_LABELS = { YELLOW: 'Jaunes', RED: 'Rouges' };

export default defineComponent({
    components: {
        CandidateListModal,
        Face
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
        player(){
            return this.game.getEntityByName("{player}");
        },
        periodLabel(){
            return PERIOD_LABELS[this.game.period];
        },
        computeTeam: function(){
            return this.game.teams.find(t => t.color == this.player.team);
        },
        teamClass(){
            return this.computeTeam ? 'team-' + this.computeTeam.color.toLowerCase() : 'noTeam';
        },
        teamLabel(){
            if(!this.computeTeam){
                return 'Sans équipe';
            }
            const base = TEAM_LABELS[this.computeTeam.color] || this.computeTeam.color;
            // Nom tribal une fois attribué
            return this.computeTeam.name ? base + ' · ' + this.computeTeam.name : base;
        },
        // Anneau de l'avatar : couleur de l'équipe du joueur
        avatarStyle(){
            const color = TeamCssColor[this.player.team];
            return color ? { boxShadow: '0 0 0 3px ' + color + ', 0 0 0 5px var(--wood-dark), 0 6px 14px rgba(11, 26, 40, 0.6)' } : {};
        }
    }
})
</script>
<style scoped>
.topbar {
    position: relative;
    z-index: 5;
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 76px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    color: var(--sand-soft);
    background-color: var(--wood-light);
    border-bottom: 3px solid var(--wood-dark);
    box-shadow: inset 0 -2px 0 var(--wood-mid);
}
.side {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}
.day {
    font-size: 1.4rem;
    line-height: 1;
}
.sub {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--amber);
}
/* Médaillon du joueur : déborde sous le header ; l'image d'avatar viendra le remplacer */
.avatar {
    justify-self: center;
    width: 72px;
    height: 72px;
    margin-bottom: -40px;
    padding: 0;
    border-radius: 50%;
    border: 4px solid var(--sand-soft);
    background-color: var(--wood-dark);
    color: var(--sand-soft);
    font-size: 1.8rem;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 0 0 3px var(--wood-dark), 0 6px 14px rgba(11, 26, 40, 0.6);
}
.energyRow {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    font-weight: 700;
}
.gauge {
    height: 12px;
    border-radius: 6px;
    background-color: var(--wood-dark);
    border: 2px solid var(--wood-mid);
    overflow: hidden;
}
.gaugeFill {
    height: 100%;
    background-color: var(--amber);
    transition: width 0.4s;
}
.team {
    align-self: flex-end;
    max-width: 100%;
    padding: 0 8px;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1.5px solid var(--wood-dark);
}
.team.noTeam {
    color: var(--sand-soft);
    border-color: var(--wood-mid);
}
</style>
