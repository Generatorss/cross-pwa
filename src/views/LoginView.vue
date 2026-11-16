<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { pb } from '@/api/pocketbase'

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)
const router = useRouter()

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await pb.collection('users').authWithPassword(email.value, password.value)
    router.push('/objects')
  } catch (e: any) {
    error.value = e?.message || 'Ошибка входа'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login">
    <h2>Вход</h2>
    <form @submit.prevent="submit">
      <label>
        Email
        <input v-model="email" type="email" required autocomplete="username" />
      </label>
      <label>
        Пароль
        <input v-model="password" type="password" required autocomplete="current-password" />
      </label>
      <button type="submit" :disabled="busy">{{ busy ? 'Вход…' : 'Войти' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </div>
</template>

<style scoped>
.login {
  max-width: 320px;
  margin: 2rem auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 6px;
}
button {
  padding: 0.6rem;
  background: #1e40af;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error {
  color: #b91c1c;
  font-size: 0.9rem;
}
</style>