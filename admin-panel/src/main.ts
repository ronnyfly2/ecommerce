import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'
import { createPinia } from 'pinia'
import router from '@/router'
import { currenciesService } from '@/services/currencies.service'
import { setSystemCurrencyFromList } from '@/utils/system-currency'

async function bootstrap() {
	try {
		const currencies = await currenciesService.list()
		setSystemCurrencyFromList(currencies)
	} catch {
		// Keep persisted/default currency if service is unavailable during bootstrap.
	}

	const app = createApp(App)

	app.use(createPinia())
	app.use(router)

	app.mount('#app')
}

void bootstrap()
