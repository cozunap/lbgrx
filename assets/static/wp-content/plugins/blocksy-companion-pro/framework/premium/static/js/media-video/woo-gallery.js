import { createRoot, createElement, Fragment } from '@wordpress/element'
import { __ } from 'ct-i18n'
import $ from 'jquery'

import EditVideoButton from './components/EditVideoButton'

const variationRoots = new Map()

const VariationActions = ({ attachment_id, native, className }) => (
	<Fragment>
		<li>
			<EditVideoButton attachment_id={attachment_id} />
		</li>
		<li>
			<a
				href="#"
				className={className}
				onClick={(e) => {
					e.preventDefault()
					e.stopPropagation()
					native.click()
				}}
			/>
		</li>
	</Fragment>
)

const mountVariationActions = ({ host, attachment_id, native, className }) => {
	let actions = host.querySelector(':scope > ul.actions')

	if (!actions) {
		actions = document.createElement('ul')
		actions.className = 'actions'
		host.appendChild(actions)
		host.classList.add('ct-has-actions')
		variationRoots.set(actions, createRoot(actions))
	}

	if (actions.dataset.attachmentId === attachment_id) {
		return
	}

	actions.dataset.attachmentId = attachment_id

	variationRoots
		.get(actions)
		.render(
			<VariationActions
				key={attachment_id}
				attachment_id={attachment_id}
				native={native}
				className={className}
			/>
		)
}

const appendToVariationImages = () => {
	variationRoots.forEach((root, node) => {
		if (node.isConnected) {
			return
		}

		root.unmount()
		variationRoots.delete(node)
	})

	document
		.querySelectorAll('.wc-variation-gallery-field__hero')
		.forEach((hero) => {
			const image = hero.querySelector('.wc-variation-gallery-field__hero-img')
			const replace = hero.querySelector('.wc-variation-gallery-replace')
			const actions = hero.querySelector(':scope > ul.actions')

			if (!image || !image.dataset.id || !replace) {
				if (actions) {
					variationRoots.get(actions).unmount()
					variationRoots.delete(actions)
					actions.remove()
					hero.classList.remove('ct-has-actions')
				}

				return
			}

			mountVariationActions({
				host: hero,
				attachment_id: image.dataset.id,
				native: replace,
				className: 'edit-button',
			})
		})
}

function observeElement(element, property, callback, delay = 0) {
	let elementPrototype = Object.getPrototypeOf(element)
	if (elementPrototype.hasOwnProperty(property)) {
		let descriptor = Object.getOwnPropertyDescriptor(
			elementPrototype,
			property
		)
		Object.defineProperty(element, property, {
			get: function () {
				return descriptor.get.apply(this, arguments)
			},
			set: function () {
				let oldValue = this[property]
				descriptor.set.apply(this, arguments)
				let newValue = this[property]
				if (typeof callback == 'function') {
					setTimeout(callback.bind(this, oldValue, newValue), delay)
				}
				return newValue
			},
		})
	}
}

export const listenForGalleryUpdate = () => {
	appendToVariationImages()

	$(document).on(
		'woocommerce_variations_loaded woocommerce_variations_added',
		appendToVariationImages
	)

	$(document).on(
		'change',
		'.wc-variation-gallery-image-ids',
		appendToVariationImages
	)

	$(document).on(
		'click',
		'.wc-variation-gallery-thumb__button',
		appendToVariationImages
	)

	const galleryImages = document.querySelector('#product_image_gallery')

	if (galleryImages) {
		galleryImages.addEventListener('input', () => appendToGalleryItems())
		observeElement(galleryImages, 'value', () => appendToGalleryItems())
	}
}

export const appendToGalleryItems = () => {
	const images = document.querySelectorAll('.product_images .image')

	if (!images || !images.length) {
		return
	}

	images.forEach((image) => {
		if (image.hasAction) {
			return
		}

		image.hasAction = true

		const attachment_id = image.dataset.attachment_id
		const action = document.createElement('li')
		action.classList.add('options')
		image
			.querySelector('.actions')
			.insertBefore(action, image.querySelector('.actions').firstChild)

		const root = createRoot(action)
		root.render(<EditVideoButton attachment_id={attachment_id} />)
	})
}
