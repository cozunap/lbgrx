import { registerDynamicChunk } from 'blocksy-frontend'

const COOKIE_NAME = 'blc_products_waitlist'
// Must match ProductWaitlistDb::$cookie_version -- the server drops any
// envelope that does not carry this exact version.
const COOKIE_VERSION = 2
const COOKIE_LIFETIME = 365 * 24 * 60 * 60 * 1000

const changeCounter = (el, value, messsage) => {
	const maybeCounters = el.querySelectorAll('.ct-waitlist-users')

	if (maybeCounters.length) {
		maybeCounters.forEach((maybeCounter) => {
			maybeCounter.dataset.count = value

			maybeCounter.innerHTML = messsage
		})
	}
}

const toggleFormVisibility = (el, data) => {
	if (
		!data ||
		data.blocksy_stock_quantity > 0 ||
		(data.is_in_stock && !data.backorders_allowed) ||
		(data.backorders_allowed &&
			ct_localizations.blc_ext_waitlist.waitlist_allow_backorders ===
				'no')
	) {
		el.dataset.state = 'hidden'
	} else {
		if (
			data.blocksy_waitlist.unsubscribe_token ||
			(ct_localizations.blc_ext_waitlist.list.items || []).includes(
				data.blocksy_waitlist.unsubscribe_token
			)
		) {
			el.dataset.state = 'subscribed'
			const maybeUnsubscribeButton = el.querySelector('.unsubscribe')

			if (maybeUnsubscribeButton) {
				maybeUnsubscribeButton.dataset.token =
					data.blocksy_waitlist.unsubscribe_token
			}

			changeCounter(
				el,
				data.blocksy_waitlist.waitlist_users,
				data.blocksy_waitlist.waitlist_users_message
			)

			return
		}

		changeCounter(
			el,
			data.blocksy_waitlist.waitlist_users,
			data.blocksy_waitlist.waitlist_users_message
		)

		el.dataset.state = 'visible'
	}
}

const updateUnsubscribeButton = (el, data) => {
	const unsubscribeButton = el
		.closest('.ct-product-waitlist')
		.querySelector('.unsubscribe')

	if (unsubscribeButton) {
		unsubscribeButton.dataset.token = data.token
	}
}

const updateTable = (el) => {
	const row = el.closest('.ct-woocommerce-waitlist-table-row')

	if (!row) return

	const numberOfRows = document.querySelectorAll(
		'.ct-woocommerce-waitlist-table-row'
	).length

	if (numberOfRows === 1) {
		window.location.reload()
	} else {
		row.remove()
	}
}

// The selected variation wins over the parent product, so the id always
// describes the row the visitor is acting on. The hidden input is empty until
// a variation is picked, which is why the parent is the fallback and not the
// other way round.
const getCurrentProductId = (el) => {
	const productEl = el.closest('.product')

	if (!productEl) return ''

	const maybeVariationEl = productEl.querySelector('[name="variation_id"]')

	if (maybeVariationEl && maybeVariationEl.value) {
		return maybeVariationEl.value
	}

	return productEl.className.match(/post-(\d+)/)?.[1] || ''
}

// The cookie holds unsubscribe tokens, never subscription ids -- it is read
// back server side as a bearer credential, so its values have to be the random
// tokens the visitor already owns.
const updateCookie = (token, remove = false) => {
	const {
		blc_ext_waitlist: { user_logged_in, list },
	} = ct_localizations

	if (user_logged_in !== 'no') return
	if (!token) return

	// list can still be the pre-v2 bare array when this script runs against a
	// page that was cached before the upgrade, so read items defensively and
	// always write the version rather than carrying it over from what we read.
	const items = list.items || []

	let newItems = [...items, token]

	if (remove) {
		newItems = items.filter((existing) => existing !== token)
	}

	const newList = { v: COOKIE_VERSION, items: newItems }

	ct_localizations.blc_ext_waitlist.list = newList

	const expires = new Date(Date.now() + COOKIE_LIFETIME).toGMTString()
	document.cookie = `${COOKIE_NAME}=${JSON.stringify(
		newList
	)}; expires=${expires}; path=/`
}

const handleFormSubmit = (el) => {
	const body = new FormData(el)
	body.append('action', 'blc_subcribe_to_waitlist')

	const waitlist = el.closest('.ct-product-waitlist')
	waitlist.dataset.loading = ''

	body.append('product_id', getCurrentProductId(el))

	fetch(ct_localizations.ajax_url, {
		method: 'POST',
		body,
	})
		.then((r) => r.json())
		.then(({ success, data }) => {
			if (!success) {
				alert(data.message)
				return
			}

			waitlist.dataset.state = 'subscribed'

			changeCounter(
				waitlist,
				data.waitlist_users,
				data.waitlist_users_message
			)
			updateCookie(data.unsubscribe_token)

			updateUnsubscribeButton(el, {
				token: data.unsubscribe_token,
			})
		})
		.finally(() => {
			waitlist.removeAttribute('data-loading')
		})
}

const handleUnsubscribe = (el) => {
	const body = new FormData()
	body.append('action', 'blc_waitlist_unsubscribe')
	body.append('token', el.dataset.token)

	const isAccountAction = el.closest('.waitlist-product-actions, .waitlist-product-mobile-actions')
	const waitlist = isAccountAction || el.closest('.ct-product-waitlist')
	waitlist.dataset.loading = ''

	body.append('product_id', getCurrentProductId(el))

	fetch(ct_localizations.ajax_url, {
		method: 'POST',
		body,
	})
		.then((r) => r.json())
		.then(({ success, data }) => {
			if (!success) {
				alert(data.message)
				return
			}

			waitlist.dataset.state = ''

			changeCounter(
				waitlist,
				data.waitlist_users,
				data.waitlist_users_message
			)
			updateCookie(el.dataset.token, true)
			updateTable(el)
		})
		.finally(() => {
			waitlist.removeAttribute('data-loading')
		})
}

const handleSync = (el) => {
	const body = new FormData()
	body.append('action', 'blc_waitlist_sync')
	body.append('product_id', getCurrentProductId(el))

	fetch(ct_localizations.ajax_url, {
		method: 'POST',
		body,
	})
		.then((r) => r.json())
		.then(({ success, data }) => {
			if (!data.unsubscribe_token || !success) {
				return
			}

			toggleFormVisibility(el.closest('.ct-product-waitlist'), {
				blocksy_waitlist: {
					...data,
				},
			})
		})
}

registerDynamicChunk('blocksy_ext_woo_extra_waitlist', {
	mount: (el, rest) => {
		if (!rest) {
			handleSync(el)
			return
		}

		const { event, eventData } = rest

		if (event.type === 'submit') {
			handleFormSubmit(el)

			return
		}

		if (event.type === 'click' && el.classList.contains('unsubscribe')) {
			handleUnsubscribe(el)

			return
		}

		if (event.type === 'reset_data' || event.type === 'found_variation') {
			toggleFormVisibility(el, eventData)
		}
	},
})
