import { registerDynamicChunk } from 'blocksy-frontend'
import cookie from 'js-cookie'

let paletteTransition = null

const syncPalette = (animate = false) => {
	const root = document.documentElement
	const theme =
		cookie.get('blocksy_current_theme') ||
		root.dataset.colorMode.split(':')[0]

	if (!animate || theme === 'os-default') {
		root.dataset.colorMode = theme
		return
	}

	if (
		document.startViewTransition &&
		!window.matchMedia('(prefers-reduced-motion: reduce)').matches
	) {
		paletteTransition?.skipTransition()

		if (!root.dataset.colorMode.endsWith(':updating')) {
			root.dataset.colorMode += ':updating'
		}

		const transition = document.startViewTransition(() => {
			root.dataset.colorMode = `${theme}:view-transition:updating`
		})

		paletteTransition = transition
		transition.ready.catch(() => {})
		transition.finished.finally(() => {
			if (paletteTransition !== transition) {
				return
			}

			root.dataset.colorMode = theme
			paletteTransition = null
		})

		return
	}

	root.dataset.colorMode = theme
}

let synced = false

registerDynamicChunk('blocksy_dark_mode', {
	mount: (el, payload = {}) => {
		const { event } = payload || {}

		if (!event) {
			if (!synced) {
				synced = true
				syncPalette()
			}

			return
		}

		const periods = {
			onehour: 36e5,
			oneday: 864e5,
			oneweek: 7 * 864e5,
			onemonth: 31 * 864e5,
			threemonths: 3 * 31 * 864e5,
			sixmonths: 6 * 31 * 864e5,
			oneyear: 365 * 864e5,
			forever: 10000 * 864e5,
		}

		let theme =
			cookie.get('blocksy_current_theme') ||
			(document.documentElement.dataset.colorMode.split(':')[0] === 'os-default'
				? 'os-default'
				: 'light')

		if (theme === 'os-default') {
			theme = window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light'
		}

		cookie.set(
			'blocksy_current_theme',
			theme === 'light' ? 'dark' : 'light',
			{
				expires: new Date(new Date() * 1 + periods.threemonths),
				sameSite: 'lax',
			}
		)

		setTimeout(() => {
			syncPalette(true)
		})
	},
})
