<template>
    <div class="campHeader">
        <div class="item">&#128167; Eau {{ camp.resources.water }}/{{ waterMax }}</div>
        <div class="item">&#129717; Bois {{ camp.resources.wood }}</div>
        <div class="item">&#127830; Nourriture {{ camp.resources.food }}</div>
        <div class="item equip" title="Aménagements du camp">
            &#128293; {{ camp.equipements.fire ? 'allumé' : 'éteint' }}
            &#128726; {{ camp.equipements.cabin }}/{{ cabinSteps }}
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { Game } from 'src/model/Game';
import { CAMP_RESOURCE_MAX, CAMP_CABIN_STEPS } from 'src/model/Team';

/**
 * Second header (sous le principal), hors épreuves : ressources du camp de l'équipe du joueur.
 */
export default defineComponent({
    props: {
        game: {
            type: Game
        }
    },
    computed: {
        camp() {
            return this.game.teamOf(this.game.getEntityByName('{player}')).camp;
        },
        waterMax() {
            return CAMP_RESOURCE_MAX.water;
        },
        cabinSteps() {
            return CAMP_CABIN_STEPS;
        }
    }
})
</script>
<style scoped>
.campHeader {
    display: flex;
    justify-content: space-around;
    align-items: center;
    flex-wrap: wrap;
    padding: 6px 8px;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--wood);
    background-color: var(--sand);
    border-bottom: 3px solid var(--wood);
}
</style>
