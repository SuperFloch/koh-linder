<template>
    <div class="col">
        <label for="text">Text : </label>
        <input :value="modelValue.text" ref="text" @input="onChange" id="text"/>
    </div>
    <div class="col">
        <input :value="modelValue.next" ref="next" @input="onChange" class="hidden"/>
        <label for="type">Type : </label>
        <select v-model="type" id="type">
            <option value="ID">ID</option>
            <option value="THEME">THEME</option>
            <option value="TEST">TEST</option>
        </select>
        <div v-if="type === 'ID'">
            <label for="idInput">Id :</label>
            <select v-model="targetId" @input="onIdChange" ref="idInput" id="idInput">
                <optgroup v-for="type,index in Object.keys(allCards)" :key="index" :label="type">
                    <option v-for="card,indexc in allCards[type]" :key="indexc" :value="card.id">{{ card.name }}</option>
                </optgroup>
            </select>
        </div>
        <div v-if="type === 'THEME'">
            <label id="themeInput">Theme : </label>
            <select v-model="targetTheme" @input="onThemeChange" ref="themeInput" id="themeInput">
                <option v-for="type, index in Object.keys(allCards)" :key="index" :value="type">{{ type }}</option>
            </select>
        </div>
        <div v-if="type === 'TEST'">
            <label for="cibleInput">Cible : </label>
            <select id="cibleInput">
                <option value="{player}">Player</option>
                <option value="{interlocutor}">Interlocutor</option>
            </select>
            <label for="attrInput">Attribut :</label>
            <select id="attrInput">
                <option v-for="attr, index in Object.keys(attributes)" :key="index" :value="attr">{{ attr }}</option>
            </select>
            <label for="valueInput">Value :</label>
            <input type="number" id="valueInput"/>
            <div>
                <EditorChoice v-model="choiceLeft" :allCards="allCards" @change="onLeftTestResultChange"></EditorChoice>
                <EditorChoice v-model="choiceRight" :allCards="allCards" @change="onRightTestResultChange"></EditorChoice>
            </div>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { Attribute } from 'src/model/Character'
// "TEST:{player}:STR:12:ID§0:ID§1"
export default defineComponent({
    props: {
        modelValue: Object,
        allCards: Object
    },
    emits: ['change', 'update:modelValue'],
    data: function(){return {
        text: '',
        next: '',
        type: '',
        targetId: '',
        targetTheme: '',
        attributes: Attribute,
        choiceLeft: {text: '', next:''},
        choiceRight: {text: '', next:''}
    }},
    methods: {
        onChange(){
            this.$emit('update:modelValue', {next: this.$refs.next.value, text: this.$refs.text.value});
            this.$emit('change');
        },
        onIdChange(){
            this.$refs.next.value = 'ID:' + this.$refs.idInput.value;
            this.next = 'ID:' + this.$refs.idInput.value;
            this.onChange();
        },
        onThemeChange(){
            this.$refs.next.value = 'THEME:' + this.$refs.themeInput.value;
            this.next = 'THEME:' + this.$refs.themeInput.value;
            this.onChange();
        },
        onLeftTestResultChange(val){
            console.log(this.choiceLeft);
        },
        onRightTestResultChange(val){
            console.log(val);
        }
    },
    mounted: function(){
        // console.log(Attribute);
    }
})
</script>
