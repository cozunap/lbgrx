import { appendItems, buildErrorDetail, clearItems, initLayout, mountItems } from './ui'

it( 'adds Swiper slide classes to clones without contaminating a shared Grid template', () => {
	document.body.innerHTML = '<div id="swiper"><div data-jet-asynch-items class="swiper-wrapper"></div></div><div id="grid"><div data-jet-asynch-items></div></div>'
	const config = { template: { template_hash: 'shared-slider-grid', template_html: '<span>{{title}}</span>', bindings: [] }, layout: { slider_enabled: true } }
	const root = document.getElementById( 'swiper' )
	mountItems( root, config, [ { title: 'One' } ] )
	mountItems( root, config, [ { title: 'Two' } ], true )
	expect( root.querySelectorAll( '.jet-listing-grid__item.swiper-slide' ) ).toHaveLength( 2 )
	mountItems( document.getElementById( 'grid' ), { ...config, layout: {} }, [ { title: 'Grid' } ] )
	expect( document.querySelector( '#grid .swiper-slide' ) ).toBeNull()
} )

describe( 'Async Listing append lifecycle', () => {
	afterEach( () => {
		delete window.jQuery
		delete window.JetEngine
		delete window.JetEngineSettings
		delete window.Swiper
		delete window.Macy
		delete window.imagesLoaded
	} )

	it.each( [ 'grid', 'scroll', 'masonry', 'swiper', 'slick' ] )( 'preserves original nodes and refreshes the owned %s layout', ( preset ) => {
		const slider = [ 'swiper', 'slick' ].includes( preset )
		document.body.innerHTML = `<div class="jet-asynch-listing"><div class="jet-asynch-listing__body">
			<div data-slider_options="{}"><div class="jet-listing-grid__items ${ preset === 'masonry' ? 'jet-listing-grid__masonry' : '' }" data-jet-asynch-items></div></div>
		</div></div>`
		const root = document.querySelector( '.jet-asynch-listing' )
		const container = root.querySelector( '[data-jet-asynch-items]' )
		const config = {
			template: { template_hash: 'append-layout', template_html: '<span>{{title}}</span>', bindings: [] },
			layout: { item_tag: 'div', preset, slider_enabled: slider, equal_height: true },
		}
		const destroy = jest.fn()
		const data = jest.fn()
		window.jQuery = jest.fn( ( node ) => ( {
			node, data, hasClass: ( name ) => node.classList.contains( name ),
			slick: () => { destroy(); container.classList.remove( 'slick-initialized' ) },
		} ) )
		window.jQuery.fn = { slick: jest.fn() }
		window.Swiper = jest.fn()
		window.Macy = jest.fn()
		window.imagesLoaded = jest.fn()
		window.JetEngineSettings = { sliderLibrary: preset === 'slick' ? 'slick' : 'swiper' }
		const initialize = jest.fn( () => {
			if ( preset === 'swiper' ) {
				root.querySelector( '[data-slider_options]' ).swiper = { destroy }
				root.insertAdjacentHTML( 'beforeend', '<div class="swiper-button-next-svg"></div>' )
			}
			if ( preset === 'slick' ) container.classList.add( 'slick-initialized' )
		} )
		window.JetEngine = { initSlider: initialize, initMasonry: initialize, destroyMasonry: destroy }
		mountItems( root, config, [ { title: 'One' } ] )
		initLayout( root, config, 1 )
		const first = container.firstElementChild
		initialize.mockClear()
		destroy.mockClear()
		expect( appendItems( root, config, [ { title: 'Two' } ] ) ).toBe( '' )
		expect( container.firstElementChild ).toBe( first )
		expect( container.textContent ).toBe( 'OneTwo' )
		expect( container.querySelectorAll( '.jet-equal-columns' ) ).toHaveLength( 2 )
		if ( slider || preset === 'masonry' ) {
			expect( destroy ).toHaveBeenCalledTimes( 1 )
			expect( initialize ).toHaveBeenCalledTimes( 1 )
		} else {
			expect( initialize ).not.toHaveBeenCalled()
		}
		if ( slider ) {
			expect( JSON.parse( root.querySelector( '[data-slider_options]' ).getAttribute( 'data-slider_options' ) ).itemsCount ).toBe( 2 )
			expect( data ).toHaveBeenLastCalledWith( 'slider_options', { itemsCount: 2 } )
		}
		if ( preset === 'swiper' ) expect( root.querySelectorAll( ':scope > .swiper-button-next-svg' ) ).toHaveLength( 1 )
	} )

	it( 'rolls back only the new fragment when layout initialization throws', () => {
		document.body.innerHTML = '<div><div class="jet-listing-grid__items jet-listing-grid__masonry" data-jet-asynch-items></div></div>'
		const root = document.body.firstElementChild
		const config = { template: { template_hash: 'rollback', template_html: '{{title}}', bindings: [] }, layout: { preset: 'masonry' } }
		mountItems( root, config, [ { title: 'Old' } ] )
		const first = root.querySelector( '.jet-listing-grid__item' )
		window.jQuery = ( node ) => ( { node, hasClass: () => false } )
		window.Macy = jest.fn()
		window.imagesLoaded = jest.fn()
		window.JetEngine = { destroyMasonry: jest.fn(), initMasonry: jest.fn().mockImplementationOnce( () => { throw new Error( 'layout failed' ) } ) }
		expect( appendItems( root, config, [ { title: 'New' } ] ) ).toBe( 'layout failed' )
		expect( root.textContent ).toBe( 'Old' )
		expect( root.querySelector( '.jet-listing-grid__item' ) ).toBe( first )
		expect( window.JetEngine.initMasonry ).toHaveBeenCalledTimes( 2 )
	} )
} )

describe( 'Async Listing layout cleanup', () => {
	afterEach( () => {
		delete window.jQuery
		delete window.JetEngine
		delete window.imagesLoaded
		delete window.Macy
	} )

	it( 'does not destroy a nested Slider while appending to its Grid parent', () => {
		document.body.innerHTML = `<div class="jet-asynch-listing"><div class="jet-asynch-listing__body"><div data-jet-asynch-items>
			<div class="jet-listing-grid__item"><div class="jet-asynch-listing"><div class="jet-asynch-listing__body"><div data-slider_options="{}"></div></div><div class="swiper-button-next-svg"></div></div></div>
		</div></div></div>`
		const root = document.body.firstElementChild
		const nestedSlider = root.querySelector( '[data-slider_options]' )
		const destroy = jest.fn()
		nestedSlider.swiper = { destroy }
		const config = { layout: { preset: 'grid' }, template: { template_hash: 'nested-grid', template_html: '{{title}}', bindings: [] } }
		expect( appendItems( root, config, [ { title: 'New item' } ] ) ).toBe( '' )
		expect( destroy ).not.toHaveBeenCalled()
		expect( nestedSlider.isConnected ).toBe( true )
		expect( root.querySelector( '.swiper-button-next-svg' ) ).not.toBeNull()
	} )

	it( 'destroys Swiper and removes only controls owned by the current listing', () => {
		document.body.innerHTML = `
			<div class="jet-asynch-listing">
				<div class="jet-asynch-listing__body">
					<div data-slider_options="{}"><div data-jet-asynch-items></div></div>
				</div>
				<div class="swiper-button-prev-svg"></div>
				<div class="swiper-button-next-svg"></div>
				<div class="jet-engine-swiper-pagination-wrapper"></div>
				<div class="nested"><div class="swiper-button-next-svg"></div></div>
			</div>
		`

		const root = document.querySelector( '.jet-asynch-listing' )
		const slider = root.querySelector( '[data-slider_options]' )
		const destroy = jest.fn()

		slider.swiper = { destroy }
		clearItems( root )

		expect( destroy ).toHaveBeenCalledWith( true, true )
		expect( root.querySelector( ':scope > .swiper-button-prev-svg' ) ).toBeNull()
		expect( root.querySelector( ':scope > .swiper-button-next-svg' ) ).toBeNull()
		expect( root.querySelector( ':scope > .jet-engine-swiper-pagination-wrapper' ) ).toBeNull()
		expect( root.querySelector( '.nested .swiper-button-next-svg' ) ).not.toBeNull()
	} )

	it( 'initializes Masonry only when every shared dependency is available', () => {
		document.body.innerHTML = '<div class="jet-asynch-listing"><div class="jet-listing-grid__items jet-listing-grid__masonry" data-jet-asynch-items></div></div>'

		const root = document.querySelector( '.jet-asynch-listing' )
		const items = root.querySelector( '.jet-listing-grid__items' )
		const $items = { element: items, hasClass: jest.fn( () => false ) }
		const initMasonry = jest.fn()
		const destroyMasonry = jest.fn()

		window.jQuery = jest.fn( () => $items )
		window.JetEngine = { initMasonry, destroyMasonry }
		window.imagesLoaded = jest.fn()
		window.Macy = jest.fn()

		expect( initLayout( root, { layout: { preset: 'masonry' } }, 2 ) ).toBe( '' )
		expect( initMasonry ).toHaveBeenCalledWith( $items, { useElementorSettings: false } )

		delete window.Macy

		expect( initLayout( root, { layout: { preset: 'masonry' } }, 2 ) ).toBe( 'The Macy Masonry dependency is unavailable.' )
		expect( initMasonry ).toHaveBeenCalledTimes( 1 )

		clearItems( root )
		expect( destroyMasonry ).toHaveBeenCalledWith( $items )
	} )
} )

describe( 'Async Listing editor diagnostics', () => {
	it( 'adds the stable proxy error code only for privileged diagnostics', () => {
		const detail = buildErrorDetail(
			{ show_diagnostics: true, ui: { error_message: 'Unable to load data.' } },
			{ error: { code: 'endpoint_not_found', message: 'Unable to load data.' } }
		)

		expect( detail.diagnostics ).toContain( 'Unable to load data. (endpoint_not_found)' )
	} )
} )
