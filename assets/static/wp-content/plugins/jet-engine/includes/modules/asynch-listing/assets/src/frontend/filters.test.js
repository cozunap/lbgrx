import { providerId, refreshFilterTargets, resolveFilterRoot, prepareFiltersRequestData, prepareInitialFilterRequest, updateFromFiltersResponse, scopeFilterGroups } from './filters'
import { initInstance, updateInstance } from './instance'
import { fetchItems } from './fetch'
import { mountItems, initLayout } from './ui'

jest.mock( './fetch', () => ( { fetchItems: jest.fn() } ) )
jest.mock( './ui', () => ( { buildErrorDetail: jest.fn(), clearItems: jest.fn(), initLayout: jest.fn(), mountItems: jest.fn(), setState: jest.fn() } ) )
jest.mock( '../../scss/frontend.scss', () => ( {} ) )

function listing( id, target = '' ) {
	return `<div id="${ id }" class="jet-asynch-listing" data-jet-asynch-listing="true" data-jet-asynch-listing-target="${ target }"><script class="jet-asynch-listing__config" type="application/json">{"instance_id":"${ id }","source":"jet_engine_query"}</script></div>`
}

beforeEach( () => {
	document.body.innerHTML = ''
	window.JetSmartFilterSettings = { settings: { [ providerId ]: {} } }
	jest.clearAllMocks()
	initLayout.mockReset()
	delete window.jQuery
	delete window.JetSmartFilters
} )

it.each( [ 'elementor', 'bricks', 'blocks' ] )( '%s selector and settings lookup retain the target and saved query', ( builder ) => {
	document.body.innerHTML = builder === 'blocks' ? listing( 'products', 'products' ) : `<div id="products">${ listing( 'internal', 'products' ) }</div>`
	refreshFilterTargets()
	const root = resolveFilterRoot( 'products' )
	const settings = { instance_id: root.id, query_id: 'products', source_config: { query_id: 42 } }
	window.JetSmartFilterSettings.settings[ providerId ].products = settings
	// This is the selector construction used by JSF FilterGroup for non-depth providers.
	expect( document.querySelectorAll( '#products[data-jet-asynch-listing-provider]' ) ).toHaveLength( 1 )
	const request = { provider: providerId, queryId: 'products' }
	expect( prepareFiltersRequestData( request ) ).toBe( request )
	expect( resolveFilterRoot( root.id ) ).toBe( root )
	expect( settings.source_config.query_id ).toBe( 42 )
} )

it( 'rejects missing, duplicate, and ambiguous default targets without fallback', () => {
	document.body.innerHTML = listing( 'first' )
	refreshFilterTargets()
	expect( resolveFilterRoot( 'default' ).id ).toBe( 'first' )
	document.body.innerHTML += listing( 'second' )
	refreshFilterTargets()
	expect( resolveFilterRoot( 'default' ) ).toBeNull()
	expect( prepareFiltersRequestData( { provider: providerId, queryId: 'missing' } ).provider ).toBe( false )
	document.body.innerHTML += '<div id="first"></div>'
	refreshFilterTargets()
	expect( resolveFilterRoot( 'first' ) ).toBeNull()
	const config = { request: { filter_query_id: 'first', request: { filters: { _page: 2 }, signature: 'signed' } } }
	prepareInitialFilterRequest( document.querySelector( '[data-jet-asynch-listing]' ), config )
	expect( config.request.request ).toEqual( { signature: 'signed' } )
} )

it.each( [ '', 'products', 'outer', '0' ] )( 'native Bricks wrapper preserves nested ownership for target "%s"', ( target ) => {
	const wrapperId = target === 'outer' ? '' : `id="${ target || 'brxe-outer' }"`
	document.body.innerHTML = `<div ${ wrapperId } class="brxe-jet-engine-asynch-listing">${ listing( 'outer', target ) }</div>`
	document.getElementById( 'outer' ).insertAdjacentHTML( 'beforeend', `<div id="nested-target" class="brxe-jet-engine-asynch-listing">${ listing( 'inner', 'nested-target' ) }</div>` )
	refreshFilterTargets()
	expect( resolveFilterRoot( target || 'default' ).id ).toBe( 'outer' )
	expect( resolveFilterRoot( 'outer' ).id ).toBe( 'outer' )
	expect( resolveFilterRoot( 'nested-target' ).id ).toBe( 'inner' )
	const update = jest.fn()
	updateFromFiltersResponse( { asynch_listing: { outer: { instance_id: 'outer', query_id: target || 'default', result: { success: true, data: [] } } } }, update )
	expect( update ).toHaveBeenCalledTimes( 1 )
	expect( update.mock.calls[ 0 ][ 0 ].id ).toBe( 'outer' )
} )

it( 'resolves configured numeric target 0 without treating it as default', () => {
	document.body.innerHTML = `<div id="0">${ listing( 'internal-zero', '0' ) }</div>${ listing( 'default-root' ) }`
	refreshFilterTargets()
	window.JetSmartFilterSettings.settings[ providerId ]['0'] = {
		instance_id: 'internal-zero',
		query_id: '0',
		source_config: { query_id: 42 },
	}
	expect( resolveFilterRoot( '0' ).id ).toBe( 'internal-zero' )
	expect( resolveFilterRoot( 'default' ).id ).toBe( 'default-root' )
	expect( prepareFiltersRequestData( { provider: providerId, queryId: '0' } ).provider ).toBe( providerId )
} )

it( 'updates only the targeted instance once across both response events', () => {
	document.body.innerHTML = `<div id="products">${ listing( 'first', 'products' ) }</div><div id="other">${ listing( 'second', 'other' ) }</div>`
	refreshFilterTargets()
	const update = jest.fn()
	const response = { asynch_listing: { first: { instance_id: 'first', query_id: 'products', result: { success: true, data: [] } } } }
	updateFromFiltersResponse( response, update )
	updateFromFiltersResponse( { ...response }, update )
	expect( update ).toHaveBeenCalledTimes( 1 )
	expect( update.mock.calls[ 0 ][ 0 ].id ).toBe( 'first' )
	updateFromFiltersResponse( { asynch_listing: { second: { query_id: 'products' } } }, update )
	expect( update ).toHaveBeenCalledTimes( 1 )
} )

it( 'does not overwrite a filtered result with a late initial response', async () => {
	document.body.innerHTML = listing( 'first' )
	refreshFilterTargets()
	let finishInitial
	fetchItems.mockReturnValue( new Promise( ( resolve ) => { finishInitial = resolve } ) )
	const root = document.getElementById( 'first' )
	initInstance( root )
	updateInstance( root, { result: { success: true, data: [ { id: 'filtered' } ] } } )
	finishInitial( { success: true, data: [ { id: 'initial' } ] } )
	await Promise.resolve()
	expect( mountItems ).toHaveBeenCalledTimes( 1 )
	expect( mountItems.mock.calls[ 0 ][ 2 ] ).toEqual( [ { id: 'filtered' } ] )
} )

it( 'keeps JSF provider re-selection scoped and disables an ambiguous default', () => {
	document.body.innerHTML = listing( 'first' ) + `<div id="named">${ listing( 'second', 'named' ) }</div>`
	const group = { provider: providerId, queryId: 'default' }
	window.JetSmartFilters = { filterGroups: { default: group } }
	window.jQuery = jest.fn( ( value ) => value )
	refreshFilterTargets()
	scopeFilterGroups()
	expect( Array.from( document.querySelectorAll( group.providerSelector ) ).map( ( root ) => root.id ) ).toEqual( [ 'first' ] )
	document.body.innerHTML += listing( 'third' )
	refreshFilterTargets()
	scopeFilterGroups()
	expect( document.querySelectorAll( group.providerSelector ) ).toHaveLength( 0 )
} )

it( 'shows targeting diagnostics only in privileged previews', () => {
	document.body.innerHTML = listing( 'first', 'missing' )
	const root = document.getElementById( 'first' )
	root.insertAdjacentHTML( 'beforeend', '<div class="jet-asynch-listing__diagnostics" hidden></div>' )
	refreshFilterTargets()
	expect( root.querySelector( '.jet-asynch-listing__diagnostics' ).hidden ).toBe( true )
	root.querySelector( 'script' ).textContent = JSON.stringify( { show_diagnostics: true, filter_target_notice: 'Check the target.' } )
	refreshFilterTargets()
	expect( root.querySelector( '.jet-asynch-listing__diagnostics' ).textContent ).toBe( 'Check the target.' )
} )

function paginationGroup( root, queryId = 'default' ) {
	const pager = { reinit: jest.fn() }
	const group = { provider: providerId, queryId, getFiltersByName: jest.fn( () => [ pager ] ) }
	window.JetSmartFilterSettings.settings[ providerId ][ queryId ] = {
		instance_id: root.id, query_id: queryId, source: 'jet_engine_query', jsf_signature: 'unchanged',
	}
	window.JetSmartFilters = { filterGroups: { [ providerId + '/' + queryId ]: group } }
	return { group, pager }
}

it.each( [ 'before', 'after' ] )( 'initial metadata initializes pagination %s filter initialization without another fetch', async ( timing ) => {
	document.body.innerHTML = listing( 'first' )
	refreshFilterTargets()
	const root = document.getElementById( 'first' )
	let filters
	if ( timing === 'after' ) {
		filters = paginationGroup( root )
	}
	fetchItems.mockResolvedValue( { success: true, data: [ { id: 2 } ], meta: { total: 5, pages: 3, page: 2, query_id: 42 } } )
	initInstance( root )
	await Promise.resolve()
	if ( timing === 'before' ) {
		filters = paginationGroup( root )
	}
	scopeFilterGroups()
	scopeFilterGroups()
	expect( window.JetSmartFilterSettings.props[ providerId ].default ).toEqual( { found_posts: 5, max_num_pages: 3, page: 2 } )
	expect( filters.pager.reinit ).toHaveBeenCalledTimes( 1 )
	expect( filters.group.getFiltersByName ).toHaveBeenCalledWith( 'pagination' )
	expect( fetchItems ).toHaveBeenCalledTimes( 1 )
	expect( window.JetSmartFilterSettings.settings[ providerId ].default.jsf_signature ).toBe( 'unchanged' )
} )

it.each( [ '0', 'first', 'default' ] )( 'seeds only the exactly owned %s target', async ( target ) => {
	document.body.innerHTML = `<div id="0">${ listing( 'first', target === '0' ? '0' : '' ) }</div>${ listing( 'second', 'second' ) }`
	refreshFilterTargets()
	const root = document.getElementById( 'first' )
	const { pager } = paginationGroup( root, target )
	const other = { reinit: jest.fn() }
	window.JetSmartFilters.filterGroups.other = { provider: providerId, queryId: 'second', getFiltersByName: () => [ other ] }
	window.JetSmartFilterSettings.props = { [ providerId ]: { second: { page: 9 }, [ target ]: { retained: true } } }
	fetchItems.mockResolvedValue( { success: true, data: [], meta: { total: 0, pages: 0, page: 1 } } )
	initInstance( root )
	await Promise.resolve()
	expect( window.JetSmartFilterSettings.props[ providerId ][ target ] ).toEqual( { retained: true, found_posts: 0, max_num_pages: 0, page: 1 } )
	expect( window.JetSmartFilterSettings.props[ providerId ].second ).toEqual( { page: 9 } )
	expect( pager.reinit ).toHaveBeenCalledTimes( 1 )
	expect( other.reinit ).not.toHaveBeenCalled()
} )

it.each( [ 'duplicate', 'disconnected', 'settings', 'conflict', 'unsupported', 'error', 'layout', 'metadata' ] )( 'does not seed pagination for %s results or targets', async ( failure ) => {
	document.body.innerHTML = listing( 'first' )
	const root = document.getElementById( 'first' )
	const { pager } = paginationGroup( root )
	if ( failure === 'duplicate' ) document.body.insertAdjacentHTML( 'beforeend', listing( 'second' ) )
	if ( failure === 'settings' ) window.JetSmartFilterSettings.settings[ providerId ].default.instance_id = 'other'
	if ( failure === 'conflict' ) window.JetSmartFilterSettings.settings[ providerId ].default.target_conflict = true
	if ( failure === 'unsupported' ) root.querySelector( 'script' ).textContent = JSON.stringify( { instance_id: 'first', source: 'wp_rest_api' } )
	if ( failure === 'layout' ) initLayout.mockReturnValue( 'Layout unavailable' )
	refreshFilterTargets()
	fetchItems.mockResolvedValue( {
		success: failure !== 'error', data: [ { id: 1 } ],
		meta: failure === 'metadata' ? { total: null, pages: Infinity, page: '2' } : { total: 5, pages: 3, page: 1 },
	} )
	initInstance( root )
	if ( failure === 'disconnected' ) root.remove()
	await Promise.resolve()
	expect( window.JetSmartFilterSettings.props ).toBeUndefined()
	expect( pager.reinit ).not.toHaveBeenCalled()
} )

it( 'replays through deferred group/init and document inited without rewriting props', async () => {
	document.body.innerHTML = listing( 'first' )
	refreshFilterTargets()
	const root = document.getElementById( 'first' )
	fetchItems.mockResolvedValue( { success: true, data: [], meta: { pages: 0 } } )
	initInstance( root )
	await Promise.resolve()
	const { group, pager } = paginationGroup( root )
	const subscriptions = {}
	const listeners = {}
	window.JetSmartFilters.events = { subscribe: ( name, callback ) => { subscriptions[ name ] = callback } }
	const addListener = jest.spyOn( document, 'addEventListener' ).mockImplementation( ( name, callback ) => { listeners[ name ] = callback } )
	const readyState = jest.spyOn( document, 'readyState', 'get' ).mockReturnValue( 'loading' )
	try {
		require( '../frontend' )
	} finally {
		addListener.mockRestore()
		readyState.mockRestore()
	}
	group.getFiltersByName.mockReturnValue( [] )
	subscriptions[ 'filterGroup/init' ]( group )
	expect( window.JetSmartFilterSettings.props ).toBeUndefined()
	group.getFiltersByName.mockReturnValue( [ pager ] )
	await Promise.resolve()
	const props = window.JetSmartFilterSettings.props
	listeners[ 'jet-smart-filters/inited' ]()
	listeners[ 'jet-smart-filters/inited' ]()
	expect( props ).toBe( window.JetSmartFilterSettings.props )
	expect( props[ providerId ].default ).toEqual( { max_num_pages: 0 } )
	expect( pager.reinit ).toHaveBeenCalledTimes( 1 )
} )

it.each( [ true, false ] )( 'a newer update (success=%s) discards queued initial pagination', async ( success ) => {
	document.body.innerHTML = listing( 'first' )
	refreshFilterTargets()
	const root = document.getElementById( 'first' )
	fetchItems.mockResolvedValue( { success: true, data: [], meta: { total: 10, pages: 5, page: 1 } } )
	initInstance( root )
	await Promise.resolve()
	updateInstance( root, { result: { success, data: [] } } )
	const { pager } = paginationGroup( root )
	window.JetSmartFilterSettings.props = { [ providerId ]: { default: { max_num_pages: 2, page: 2 } } }
	scopeFilterGroups()
	expect( window.JetSmartFilterSettings.props[ providerId ].default ).toEqual( { max_num_pages: 2, page: 2 } )
	expect( pager.reinit ).not.toHaveBeenCalled()
	expect( fetchItems ).toHaveBeenCalledTimes( 1 )
} )
