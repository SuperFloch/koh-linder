<template>
    <div class="choiceBody">
        <div>
            <q-input v-model="text" ref="text" @input="onChange" id="text" label="Text" :autogrow="true"></q-input>
        </div>
        <div>
            <input :value="modelValue.next" ref="next" @input="onChange" class="hidden" />
            <q-select v-model="type" id="type" ref="type" :options="['ID', 'THEME', 'TEST']" bg-color="white" label="Type"></q-select>
            <div :class="{ 'hidden': type !== 'ID' }">
                <label for="idInput">Id :</label>
                <select v-model="targetId" @input="onInputChange" ref="idInput" id="idInput">
                    <optgroup v-for="type, index in Object.keys(allCards)" :key="index" :label="type">
                        <option v-for="card, indexc in allCards[type]" :key="indexc" :value="card.id">{{ card.name }}</option>
                    </optgroup>
                </select>
            </div>
            <div :class="{ 'hidden': type !== 'THEME' }">
                <label id="themeInput">Theme : </label>
                <select v-model="targetTheme" @input="onInputChange" ref="themeInput" id="themeInput">
                    <option v-for="type, index in Object.keys(allCards)" :key="index" :value="type">{{ type }}</option>
                </select>
            </div>
            <div :class="{ 'hidden': type !== 'TEST' }">
                <label for="cibleInput">Cible : </label>
                <select id="cibleInput" ref="cibleInput">
                    <option value="{player}">Player</option>
                    <option value="{interlocutor}">Interlocutor</option>
                </select>
                <label for="attrInput">Attribut :</label>
                <select id="attrInput" ref="attrInput">
                    <option v-for="attr, index in Object.keys(attributes)" :key="index" :value="attr">{{ attr }}</option>
                </select>
                <label for="valueInput">Value :</label>
                <input type="number" id="valueInput" ref="valueInput" v-model="attrValue" />
                <div>
                    <!--
                    <EditorChoice v-model="choiceLeft" :allCards="allCards" @change="onInputChange"></EditorChoice>
                    <EditorChoice v-model="choiceRight" :allCards="allCards" @change="onInputChange"></EditorChoice>
                    -->
                </div>
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
    data: function () {
        return {
            text: '',
            next: '',
            type: '',
            targetId: '',
            targetTheme: '',
            attributes: Attribute,
            attrValue: 0,
            choiceLeft: { text: '', next: '' },
            choiceRight: { text: '', next: '' }
        }
    },
    methods: {
        load() {
            if (this.modelValue.next) {
                this.next = this.modelValue.next;
                var tokens = this.next.split(':');
                this.text = this.modelValue.text;
                this.type = tokens[0];
                switch (tokens[0]) {
                    case "ID":
                        this.targetId = tokens[1];
                        break;
                    case "THEME":
                        this.targetTheme = tokens[1];
                        break;
                    case "TEST":

                        break;
                }
                console.log(this.next)
            } else {
                this.reset()
            }
        },
        onChange() {
            this.$emit('update:modelValue', { next: this.$refs.next.value, text: this.$refs.text.value });
            this.$emit('change');
        },
        onInputChange() {
            this.next = this.getNextString();
            this.onChange();
        },
        getNextString() {
            var str = this.$refs.type.value + ":";
            switch (this.$refs.type.value) {
                case "ID":
                    return str + this.$refs.idInput.value;
                case "THEME":
                    return str + this.$refs.themeInput.value;
                case "TEST":
                    return str + this.$refs.cibleInput.value + ":" + this.$refs.attrInput.value + ":" + this.$refs.valueInput.value + ":" + this.choiceLeft.next.split(':').join('§') + ":" + this.choiceRight.next.split(':').join('§');
            }
        },
        reset() {
            this.text = '';
            this.next = '';
            this.type = '';
            this.targetId = '';
            this.targetTheme = '';
            this.attributes = Attribute;
            this.attrValue = 0;
        }
    },
    mounted: function () {
        // console.log(this.modelValue);
    }
})
</script>
<style scoped>
.choiceBody {
    padding: 1vw;
}
</style>
