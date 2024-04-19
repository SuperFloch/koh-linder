<template>
    <div v-if="cardModel != {}" class="modalBody">
        <div>
            <q-input v-model="cardModel.id" type="text" filled bg-color="white" @change="onChange" label="Id" id="idInput" />
        </div>

        <div>
            <q-checkbox filled bg-color="white" v-model="cardModel.single_use" type="checkbox" label="Single use" @change="onChange" id="singleUseInput" />
        </div>

        <div>
            <q-input filled bg-color="white" v-model="cardModel.name" type="text" label="Name" @change="onChange" id="nameInput" />
        </div>

        <div>
            <q-input filled bg-color="white" v-model="cardModel.text" type="text" label="Text" @change="onChange" id="textInput" />
        </div>

        <div>
            <label for="themeInput">Theme : </label>
            <q-select v-model="cardModel.theme" @change="onChange" :options="computeThemes"></q-select>
        </div>

        <div>
            <label for="typeInput">Type : </label>
            <q-select v-model="cardModel.type" id="typeInput" @change="onChange" :options="Object.keys(cardType)">
            </q-select>
        </div>
        <hr>
        <div>
            <div>Choix :</div>
            <div class="row">
                <div class="col-6 bg-warning">
                    <EditorChoice v-model="cardModel.choices.left" @change="onChange" :all-cards="allCards" ref="choiceLeft" />
                </div>
                <div class="col-6 bg-info">
                    <EditorChoice v-model="cardModel.choices.right" @change="onChange" :all-cards="allCards" ref="choiceRight" />
                </div>
            </div>
        </div>
        <!--<q-btn @click="validate" glossy color="orange">Sauvegarder</q-btn>-->
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { Card, CardTheme, CardType } from "src/model/Card"
import EditorChoice from './EditorChoice.vue'

export default defineComponent({
    emits: ['change', 'validate'],
    components: {
        EditorChoice
    },
    props: {
        allCards: {
            type: Object
        }
    },
    data: function () {
        return {
            cardModel: { choices: { left: {}, right: {} } },
            cardTheme: CardTheme,
            cardType: CardType
        }
    },
    computed:{
        computeThemes(){
            return Object.keys(this.allCards)
        }
    },
    methods: {
        onChange() {
            this.$emit('change');
        },
        load(theCard) {
            this.cardModel = theCard;
            setTimeout(() => {
                this.$refs.choiceLeft.load();
                this.$refs.choiceRight.load();
            }, 200);
        },
        validate() {
            this.$emit('validate');
        }
    },
    mounted: function () {
        // this.cardModel = this.card;
        console.log(this.allCards)
    }
})
</script>
<style scoped>
.modalBody {
    color: white;
    background-color: rgb(223, 223, 136);
}
</style>
