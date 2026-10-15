import { initInstance, startObserver } from './instance'
import { disposeInstance } from './ui'
import { fetchItems } from './fetch'

jest.mock( './fetch', () => ( { fetchItems: jest.fn() } ) )

const flush = async () => { await Promise.resolve(); await Promise.resolve() }

function fixture( id = 'listing' ) {
	const wrapper = document.createElement( 'div' )
	wrapper.innerHTML = `<div id="${ id }" class="jet-asynch-listing" data-jet-asynch-listing="true">
		<script class="jet-asynch-listing__config" type="application/json">${ JSON.stringify( {
			instance_id: id, source: 'test', layout: {},
			template: { template_hash: 'disposal', template_html: '<span>{{title}}</span>', bindings: [] },
		} ) }</script>
		<div class="jet-asynch-listing__body" data-jet-asynch-body>
			<div data-slider_options="{}"><div data-jet-asynch-items></div></div>
		</div></div>`
	document.body.appendChild( wrapper )
	return wrapper.firstElementChild
}

beforeAll( startObserver )
beforeEach( () => fetchItems.mockImplementation( () => new Promise( () => {} ) ) )
afterEach( async () => { document.body.innerHTML = ''; await flush() } )

it( 'disposes removed nested layouts and ignores a late initial response', async () => {
	let finish
	fetchItems.mockImplementationOnce( () => new Promise( ( resolve ) => { finish = resolve } ) )
	const root = fixture()
	initInstance( root )
	const nested = fixture( 'nested' )
	root.querySelector( '[data-jet-asynch-items]' ).appendChild( nested )
	initInstance( nested )
	const destroyed = []
	for ( const node of [ root, nested ] ) {
		node.querySelector( '[data-slider_options]' ).swiper = { destroy: () => destroyed.push( node.id ) }
	}
	root.parentElement.remove()
	await flush()
	expect( destroyed ).toEqual( [ 'nested', 'listing' ] )
	expect( root.__jetAsynchListingInitialized ).toBeUndefined()
	finish( { success: true, data: [ { title: 'stale' } ] } )
	await flush()
	expect( root.querySelector( '[data-jet-asynch-items]' ).children ).toHaveLength( 0 )
} )

it( 'retains the layout and pending request when a connected root moves', async () => {
	const root = fixture()
	initInstance( root )
	const token = root.__jetAsynchListingUpdateToken
	const destroy = jest.fn()
	root.querySelector( '[data-slider_options]' ).swiper = { destroy }
	document.body.appendChild( root )
	await flush()
	expect( root.__jetAsynchListingUpdateToken ).toBe( token )
	expect( destroy ).not.toHaveBeenCalled()
} )

it( 'preview reset removes old controls and permits a fresh request', async () => {
	const root = fixture()
	initInstance( root )
	const destroy = jest.fn()
	root.querySelector( '[data-slider_options]' ).swiper = { destroy }
	root.insertAdjacentHTML( 'beforeend', '<div class="swiper-button-next-svg"></div>' )
	disposeInstance( root )
	expect( destroy ).toHaveBeenCalledTimes( 1 )
	expect( root.querySelector( '.swiper-button-next-svg' ) ).toBeNull()
	expect( root.__jetAsynchListingUpdateToken ).toBeUndefined()
	initInstance( root )
	expect( root.__jetAsynchListingInitialized ).toBe( true )
} )
