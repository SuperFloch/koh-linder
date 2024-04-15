<template>
    <q-page class="pageBody">
        <div class="title">Editor</div>
        <q-btn @click="refresh" glossy color="red">Refresh</q-btn>
        <div class="row">
            <div class="cardGrid col-9">
                <div v-for="theme, index in Object.keys(allCards)" :key="index">
                    <div class="themeTitle">{{ theme }}</div>
                    <div class="cardRow">
                        <EditorCard  v-for="card, cIndex in allCards[theme]" :key="cIndex" :card="card" class="col cardCol" @click="onCardClick(card)"/>
                        <q-btn color="blue" glossy @click="addCard(theme)">
                            <div class="flex justify-center items-center full-height"><span>Add +</span></div>
                        </q-btn>
                    </div>
                </div>
            </div>
            <div class="col-3">
                <EditorPanel class="panel" :class="{'hidden': !isModalOpen}" ref="editorModal" @change="onChange" :all-cards="allCards" @validate="toggleModal(false)"/>
            </div>
        </div>

    </q-page>
</template>
<script>
import { defineComponent } from 'vue'
import { Card } from "src/model/Card";
import EditorCard from "src/components/editor/EditorCard.vue"
import EditorPanel from "src/components/editor/EditorPanel.vue"

export default defineComponent({
    components: {
        EditorCard,
        EditorPanel
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
.pageBody{
    background-image: url('img/editor/bg.jpg');
    background-size: cover;
    padding: 2vh 5vw;
}
.title{
    font-size: 5em;
    text-align: center;
}
.cardGrid{
    border: white solid 3px;
    border-radius: 3vh;
    background-color: rgba(0,0,0,0.3);
    padding: 2vh 2vw;
}
.themeTitle{
    font-size: 2em;
    width: 100%;
    border-bottom: solid 1px white;
    color: white;
    margin-bottom: 1vh;
}
.cardRow{
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-column-gap: 1vw;
    grid-row-gap: 1vh;
}
.panel{
    border: white solid 3px;
    border-radius: 3vh;
    background-color: rgba(0,0,0,0.3);
    padding: 2vh 2vw;
}
</style>
