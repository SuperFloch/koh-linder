<template>
    <input :value="modelValue.text" ref="text" @input="onChange"/>
    <input :value="modelValue.next" ref="next" @input="onChange"/>
</template>
<script>
import { defineComponent } from 'vue'

export default defineComponent({
    props: {
        modelValue: Object
    },
    emits: ['change', 'update:modelValue'],
    data: function(){return {
        text: '',
        next: ''
    }},
    methods: {
        onChange(){
            this.$emit('update:modelValue', {next: this.$refs.next.value, text: this.$refs.text.value});
            this.$emit('change');
        }
    }
})
</script>
