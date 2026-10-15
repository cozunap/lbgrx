// The CSV comes back in the response body instead of being written under
// uploads/, where it would stay publicly fetchable under a guessable name.
const downloadCsv = (csv, filename) => {
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
	const url = URL.createObjectURL(blob)

	const link = document.createElement('a')
	link.href = url
	link.download = filename

	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)

	URL.revokeObjectURL(url)
}

const exportUsers = async () => {
	const body = new FormData()
	body.append('action', 'blocksy_ext_waitlist_export_users')

	body.append(
		'nonce',
		(
			window.ctDashboardLocalizations ||
			window.ct_localizations ||
			window.ct_customizer_localizations
		).dashboard_actions_nonce
	)

	const searchParams = new URLSearchParams(window.location.search)

	if (searchParams.has('product_id')) {
		body.append('product_id', searchParams.get('product_id'))
	}

	// An empty variation_id lands in the URL for simple products -- overriding
	// with it would make the handler reject the request.
	if (searchParams.get('variation_id')) {
		body.set('product_id', searchParams.get('variation_id'))
	}

	try {
		const response = await fetch(ajaxurl, {
			method: 'POST',
			body,
		})

		if (response.status === 200) {
			const body = await response.json()

			if (body.success && body.data.csv) {
				downloadCsv(
					body.data.csv,
					body.data.filename || 'waitlist.csv'
				)
			}
		}
	} catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
	const exportButton = document.querySelector('.ct-waitlist-export')

	if (!exportButton) {
		return
	}

	exportButton.addEventListener('click', (e) => {
		e.preventDefault()

		exportUsers()
	})
})
