<template>
    <div>
        <div>
            <div class="col" @click="previous">Prev</div>
            <div v-for="character, index in characters" :key="index" class="col">
                <div :class="{'hidden': selectedIndex != index}">{{ character.name }}</div>
            </div>
            <div class="col" @click="next">Next</div>
        </div>
        <div @click="onStart">Commencer</div>
        <div @click="onBack">Retour</div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import characters from 'src/assets/characters/index.js';

export default defineComponent({
  name: 'CharSelectionPage',
  emits: ['back','start'],
  data: ()=>{
    return {
        characters: characters,
        selectedIndex: 0
    }
  },
  methods: {
    onBack(){
        this.$emit('back');
    },
    onStart(){
        this.$emit('start');
    },
    next(){
        this.selectedIndex++;
        if(this.selectedIndex >= this.characters.length){
            this.selectedIndex = 0;
        }
    },
    previous(){
        this.selectedIndex--;
        if(this.selectedIndex <0){
            this.selectedIndex = this.characters.length -1;
        }
    }
  },
  mounted: function(){
    
  }
})
</script>