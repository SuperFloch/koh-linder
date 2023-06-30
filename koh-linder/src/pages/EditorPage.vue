<template>
    <div class="p-relative">
        <h1>Editor</h1>
        <button @click="refresh">Refresh</button>
        <div class="cardGrid">
            <div v-for="theme, index in Object.keys(allCards)" :key="index">
                <div>{{ theme }}</div>
                <div class="cardRow">
                    <EditorCard  v-for="card, cIndex in allCards[theme]" :key="cIndex" :card="card" class="col cardCol" @click="onCardClick(card)"/>
                    <button @click="addCard(theme)">+</button>
                </div>
            </div>
        </div>
        <EditorModal class="modal absolute-center" :class="{'hidden': !isModalOpen}" ref="editorModal" @change="onChange" :all-cards="allCards" @validate="toggleModal(false)"/>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { Card } from "src/model/Card";
import EditorCard from "src/components/editor/EditorCard.vue"
import EditorModal from "src/components/editor/EditorModal.vue"
import EditorCardVue from 'src/components/editor/EditorCard.vue';

export default defineComponent({
    components: {
        EditorCard,
        EditorModal
    },
    data:function(){
        return {
            allCards: [],
            isModalOpen: true
        }
    },
    mounted: function(){
        this.refresh();
    },
    methods:{
        groupByTheme(cards){
            var ret = {};
            cards.forEach((c)=>{
                if(ret[c.theme] == undefined){
                    ret[c.theme] = [];
                }
                ret[c.theme].push(c);
            });
            return ret;
        },
        onCardClick(card){
            this.$refs.editorModal.load(card);
            this.toggleModal(true);
        },
        toggleModal(showIt){
            this.isModalOpen = showIt;
        },
        onChange(){
            window.ipcRenderer.send('cards:save', JSON.stringify(this.allCards));
        },
        addCard(theme){
            this.allCards[theme].push(new Card());
            this.onChange();
        },
        refresh(){
            window.ipcRenderer.invoke('cards:getAll').then((cards)=>{
                this.allCards = this.groupByTheme(cards);
            });
        }
    }
})
</script>
<style scoped>
.cardRow{
    display: grid;
    grid-template-columns: repeat(8, 1fr);
}
.modal{
    width: 80vw;
    top: 20vh;
    transform: none;
}
</style>
