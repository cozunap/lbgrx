import { applyTarget, buildTemplateEntry } from './template'
import { uniqueMessages } from './utils'

export function buildErrorDetail( config, result ) {
	const detail = {
		message: config && config.ui && config.ui.error_message ? config.ui.error_message : 'Unable to load data.',
		diagnostics: [],
	}

	if ( Array.isArray( config && config.diagnostics ) ) {
		detail.diagnostics = detail.diagnostics.concat( config.diagnostics )
	}

	if ( config && config.show_diagnostics && result && result.error ) {
		const message = result.error.message || 'Unable to load data.'
		const code = result.error.code ? ` (${ result.error.code })` : ''

		detail.diagnostics.push( `${ message }${ code }` )
	}

	detail.diagnostics = uniqueMessages( detail.diagnostics )

	return detail
}

function setDiagnostics( root, messages ) {
	const diagnosticsNode = root.querySelector( '.jet-asynch-listing__diagnostics' )
	let list
	let fragment
	let i
	let item

	if ( ! diagnosticsNode ) {
		return
	}

	messages = uniqueMessages( messages )

	if ( ! messages.length ) {
		diagnosticsNode.hidden = true
		return
	}

	list = diagnosticsNode.querySelector( '.jet-asynch-listing__diagnostics-list' )

	if ( ! list ) {
		list = document.createElement( 'ul' )
		list.className = 'jet-asynch-listing__diagnostics-list'
		diagnosticsNode.appendChild( list )
	}

	list.innerHTML = ''
	fragment = document.createDocumentFragment()

	for ( i = 0; i < messages.length; i++ ) {
		item = document.createElement( 'li' )
		item.textContent = messages[ i ]
		fragment.appendChild( item )
	}

	list.appendChild( fragment )
	diagnosticsNode.hidden = false
}

export function setState( root, state, detail ) {
	const loading = root.querySelector( '.jet-asynch-listing__state--loading' )
	const empty = root.querySelector( '.jet-asynch-listing__state--empty' )
	const error = root.querySelector( '.jet-asynch-listing__state--error' )
	const errorText = root.querySelector( '.jet-asynch-listing__error-text' )
	const body = root.querySelector( '[data-jet-asynch-body]' )

	;[ loading, empty, error ].forEach( ( node ) => {
		if ( node ) {
			node.hidden = true
		}
	} )

	root.setAttribute( 'aria-busy', 'loading' === state ? 'true' : 'false' )

	if ( body ) {
		body.setAttribute( 'aria-busy', 'loading' === state ? 'true' : 'false' )
	}

	if ( error ) {
		error.removeAttribute( 'role' )
	}

	if ( 'loading' === state && loading ) {
		loading.hidden = false
	}

	if ( 'empty' === state && empty ) {
		empty.hidden = false
	}

	if ( 'error' === state && error ) {
		error.hidden = false
		error.setAttribute( 'role', 'alert' )

		if ( errorText && detail && detail.message ) {
			errorText.textContent = detail.message
		}
	}

	setDiagnostics( root, detail && detail.diagnostics ? detail.diagnostics : [] )
}

function getOwnedSlider( root ) {
	// A Grid/Masonry parent can contain a nested Slider. Inspect only its shell.
	const body = Array.from( root.children ).find( ( child ) => child.classList.contains( 'jet-asynch-listing__body' ) )
	return body && Array.from( body.children ).find( ( child ) => child.hasAttribute( 'data-slider_options' ) )
}

function destroyLayout( root, container ) {
	const slider = getOwnedSlider( root )
	const $container = window.jQuery ? window.jQuery( container ) : null
	const swiperControls = Array.from( root.children ).filter( ( child ) => child.matches( '.swiper-button-next-svg, .swiper-button-prev-svg, .jet-engine-swiper-pagination-wrapper' ) )

	if (
		$container
		&& container.classList.contains( 'jet-listing-grid__masonry' )
		&& window.JetEngine
		&& typeof window.JetEngine.destroyMasonry === 'function'
	) {
		window.JetEngine.destroyMasonry( $container )
	}

	if ( slider && slider.swiper && typeof slider.swiper.destroy === 'function' ) {
		slider.swiper.destroy( true, true )
	}

	if ( $container && $container.hasClass( 'slick-initialized' ) && typeof $container.slick === 'function' ) {
		$container.slick( 'unslick' )
	}

	swiperControls.forEach( ( control ) => control.remove() )
}

export function mountItems( root, config, items, append = false ) {
	const container = root.querySelector( '[data-jet-asynch-items]' )
	const fragment = document.createDocumentFragment()
	const entry = buildTemplateEntry( config )
	const equalHeight = !! ( config.layout && config.layout.equal_height )
	const swiper = !! ( config.layout?.slider_enabled && container?.classList.contains( 'swiper-wrapper' ) )
	let itemFragment
	let item
	let i
	let j

	if ( ! container ) {
		return
	}

	for ( i = 0; i < items.length; i++ ) {
		itemFragment = document.importNode( entry.template.content, true )
		item = itemFragment.querySelector( '.jet-listing-grid__item' )

		// Keep cached templates independent when instances use different layout settings.
		if ( equalHeight && item ) {
			item.classList.add( 'jet-equal-columns' )
		}
		// Swiper discovers slides by class; the shared template also serves Grid
		// and Slick, so add the library contract only to this mounted clone.
		if ( swiper && item ) {
			item.classList.add( 'swiper-slide' )
		}

		for ( j = 0; j < entry.targets.length; j++ ) {
			applyTarget( entry.targets[ j ], itemFragment, items[ i ] )
		}

		fragment.appendChild( itemFragment )
	}

	// Finish binding before touching the live layout or its existing item nodes.
	destroyLayout( root, container )
	if ( ! append ) {
		container.innerHTML = ''
	}
	const nodes = Array.from( fragment.childNodes )
	container.appendChild( fragment )
	return { nodes, count: container.children.length }
}

export function appendItems( root, config, items ) {
	const container = root.querySelector( '[data-jet-asynch-items]' )
	const dependencyError = config.layout?.slider_enabled ? getSliderRuntimeError()
		: config.layout?.preset === 'masonry' ? getMasonryRuntimeError() : ''
	if ( ! container || dependencyError ) {
		return dependencyError || 'Listing items container is unavailable.'
	}
	let mounted
	try {
		mounted = mountItems( root, config, items, true )
		const error = initLayout( root, config, mounted.count )
		if ( error ) {
			throw new Error( error )
		}
		return ''
	} catch ( error ) {
		if ( mounted ) {
			// Roll back this page only; never erase a successfully displayed page.
			try {
				destroyLayout( root, container )
			} catch ( cleanupError ) {
				// Still remove the new nodes when a third-party teardown throws.
			} finally {
				mounted.nodes.forEach( ( node ) => node.remove() )
			}
			try {
				initLayout( root, config, container.children.length )
			} catch ( restoreError ) {
				// The existing items remain visible if the shared runtime cannot recover.
			}
		}
		return error.message || 'Unable to initialize listing layout.'
	}
}

export function clearItems( root ) {
	const container = root.querySelector( '[data-jet-asynch-items]' )

	if ( container ) {
		destroyLayout( root, container )
		container.innerHTML = ''
	}
}

// Shared by removal and preview reset without exposing another public API.
export function disposeInstance( root ) {
	delete root.__jetAsynchListingUpdateToken
	clearItems( root )
	delete root.__jetAsynchListingInitialized
	delete root.__jetAsynchListingConfig
}

function setSliderItemsCount( slider, itemsCount ) {
	let options = {}

	try {
		options = JSON.parse( slider.getAttribute( 'data-slider_options' ) || '{}' )
	} catch ( error ) {
		// Let the shared slider initializer apply its defaults when markup is malformed.
	}

	if ( ! options || 'object' !== typeof options || Array.isArray( options ) ) {
		options = {}
	}

	options.itemsCount = Math.max( 0, parseInt( itemsCount, 10 ) || 0 )
	slider.setAttribute( 'data-slider_options', JSON.stringify( options ) )

	return options
}

function getSliderRuntimeError() {
	const library = window.JetEngineSettings && 'slick' === window.JetEngineSettings.sliderLibrary ? 'slick' : 'swiper'

	if ( ! window.JetEngine || typeof window.JetEngine.initSlider !== 'function' ) {
		return 'The shared Listing Grid slider runtime is unavailable.'
	}

	if ( 'slick' === library && ( ! window.jQuery || ! window.jQuery.fn || typeof window.jQuery.fn.slick !== 'function' ) ) {
		return 'The configured Slick slider library is unavailable.'
	}

	if ( 'swiper' === library && typeof window.Swiper !== 'function' ) {
		return 'The configured Swiper slider library is unavailable.'
	}

	return ''
}

function getMasonryRuntimeError() {
	if ( ! window.jQuery ) {
		return 'The shared jQuery runtime is unavailable.'
	}

	if ( ! window.JetEngine || typeof window.JetEngine.initMasonry !== 'function' ) {
		return 'The shared Listing Grid Masonry runtime is unavailable.'
	}

	if ( typeof window.imagesLoaded !== 'function' ) {
		return 'The imagesLoaded Masonry dependency is unavailable.'
	}

	if ( typeof window.Macy !== 'function' ) {
		return 'The Macy Masonry dependency is unavailable.'
	}

	return ''
}

export function initLayout( root, config, itemsCount ) {
	let slider
	let items
	let options
	let $slider
	let sliderRuntimeError
	let masonryRuntimeError

	if ( config.layout && config.layout.slider_enabled ) {
		slider = getOwnedSlider( root )

		if ( slider ) {
			sliderRuntimeError = getSliderRuntimeError()

			if ( sliderRuntimeError ) {
				return sliderRuntimeError
			}

			// A previous small result can opt out by removing this class.
			slider.classList.add( 'jet-listing-grid__slider' )
			options = setSliderItemsCount( slider, itemsCount )
			$slider = window.jQuery ? window.jQuery( slider ) : slider

			if ( window.jQuery ) {
				$slider.data( 'slider_options', options )
			}

			window.JetEngine.initSlider( $slider, {
				itemsCount: options.itemsCount,
				useElementorSettings: false,
			} )
		}
	}

	if ( config.layout && 'masonry' === config.layout.preset ) {
		items = root.querySelector( '.jet-listing-grid__items' )

		if ( items ) {
			masonryRuntimeError = getMasonryRuntimeError()

			if ( masonryRuntimeError ) {
				return masonryRuntimeError
			}

			window.JetEngine.initMasonry( window.jQuery( items ), {
				useElementorSettings: false,
			} )
		}
	}

	return ''
}
