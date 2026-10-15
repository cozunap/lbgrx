import { adaptFilterGroup, providerId, refreshFilterTargets, trackFiltersAjax, updateFromFiltersResponse } from './filters'
import { updateInstance } from './instance'

function result( page, data = [ { title: `Page ${ page }` } ], pages = 3 ) {
	return { success: true, data, meta: { page, pages, total: 3 } }
}

function fixture() {
	document.body.innerHTML = `<div id="products" data-jet-asynch-listing="true" data-jet-asynch-listing-target="products">
		<script class="jet-asynch-listing__config" type="application/json"></script>
		<div data-jet-asynch-body><div data-jet-asynch-items></div></div>
		<div class="jet-asynch-listing__state--error" hidden><span class="jet-asynch-listing__error-text"></span></div>
	</div>`
	const root = document.getElementById( 'products' )
	root.querySelector( 'script' ).textContent = JSON.stringify( {
		instance_id: 'products', source: 'jet_engine_query', ui: { error_message: 'Please retry.' },
		template: { template_hash: 'load-more-fixture', template_html: '<span>{{title}}</span>', bindings: [] },
		layout: { item_tag: 'div' },
	} )
	window.JetSmartFilterSettings = {
		settings: { [ providerId ]: { products: { instance_id: 'products', query_id: 'products', source: 'jet_engine_query' } } },
		props: { [ providerId ]: { products: { page: 1, max_num_pages: 3, found_posts: 3 } } },
	}
	refreshFilterTargets()
	updateInstance( root, { result: result( 1 ) } )
	const pending = []
	const pager = {
		dataValue: 1, pageIndex: 1, moreActiveIndexes: [],
		reinit() {
			const props = window.JetSmartFilterSettings.props[ providerId ].products
			// Match JSF's short circuit: restoring props alone cannot repair dataValue.
			if ( this.pageIndex !== props.page || this.pagesCount !== props.max_num_pages ) {
				this.pageIndex = this.dataValue = props.page
				this.pagesCount = props.max_num_pages
			}
		},
	}
	// Exercise the JSF contract at its transport boundary: query equality, cursor
	// advancement, props-before-events, duplicate delivery and end-loading order.
	const group = {
		provider: providerId, queryId: 'products', currentQuery: {},
		get query() { return pager.dataValue > 1 ? { jet_paged: pager.dataValue } : {} },
		getFiltersByName: () => [ pager ], updateUrl: jest.fn(),
		doAjax( options = {} ) {
			const query = this.query
			if ( JSON.stringify( query ) === JSON.stringify( this.currentQuery ) ) return
			this.currentQuery = query
			this.ajaxRequest( ( response ) => {
				if ( response.pagination ) window.JetSmartFilterSettings.props[ providerId ].products = { ...response.pagination }
				Promise.resolve().then( () => updateFromFiltersResponse( response, updateInstance ) )
				updateFromFiltersResponse( response, updateInstance, options, 'products' )
			} )
		},
		ajaxRequest( callback ) { this.isAjaxLoading = true; pending.push( callback ) },
		endAjaxLoading() { this.isAjaxLoading = false; pager.reinit() },
	}
	adaptFilterGroup( group )
	const more = ( options = { append: true } ) => {
		pager.moreActiveIndexes.push( pager.dataValue )
		pager.dataValue++
		group.doAjax( options )
	}
	const finish = ( value, callback = pending.shift() ) => {
		const response = { asynch_listing: { products: { instance_id: 'products', query_id: 'products', result: value } } }
		if ( value.meta ) response.pagination = { page: value.meta.page, max_num_pages: value.meta.pages, found_posts: value.meta.total }
		callback( response )
		group.endAjaxLoading()
		return response
	}
	return { root, group, pager, pending, more, finish, text: () => root.querySelector( '[data-jet-asynch-items]' ).textContent }
}

afterEach( () => {
	delete window.JetSmartFilterSettings
	delete window.JetSmartFilters
	delete window.jQuery
} )

it( 'appends three pages once, preserves nodes, then replaces through a filter and direct update', async () => {
	const f = fixture()
	const first = f.root.querySelector( '.jet-listing-grid__item' )
	f.more()
	const response = f.finish( result( 2 ) )
	await Promise.resolve()
	updateFromFiltersResponse( response, updateInstance, { append: true }, 'products' )
	f.more()
	f.finish( result( 3 ) )
	expect( f.text() ).toBe( 'Page 1Page 2Page 3' )
	expect( f.root.querySelector( '.jet-listing-grid__item' ) ).toBe( first )
	f.pager.dataValue = 1
	f.group.doAjax()
	f.finish( result( 1, [ { title: 'Filtered' } ] ) )
	expect( f.text() ).toBe( 'Filtered' )
	updateInstance( f.root, { result: result( 1 ) } )
	expect( f.text() ).toBe( 'Page 1' )
} )

it.each( [ null, false, [], { append: 'true' }, { append: 1 } ] )( 'replaces for malformed options %j', ( options ) => {
	const f = fixture()
	f.more( options )
	f.finish( result( 2 ) )
	expect( f.text() ).toBe( 'Page 2' )
} )

it.each( [ 'network', 'payload', 'empty', 'metadata', 'records', 'missing' ] )( 'preserves content and actually retries page two after %s failure', async ( failure ) => {
	const f = fixture()
	f.more()
	if ( failure === 'network' ) {
		f.pending.shift()
		f.group.endAjaxLoading()
	} else if ( failure === 'missing' ) {
		f.pending.shift()( {} )
		f.group.endAjaxLoading()
	} else {
		const value = failure === 'payload' ? { success: false, error: { message: 'private error' } }
			: failure === 'empty' ? result( 2, [] )
				: failure === 'metadata' ? { ...result( 2 ), meta: { page: '2' } }
					: result( 2, [ 'invalid' ] )
		f.finish( value )
	}
	await Promise.resolve()
	expect( f.text() ).toBe( 'Page 1' )
	expect( f.root.querySelector( '.jet-asynch-listing__error-text' ).textContent ).toBe( 'Please retry.' )
	expect( f.pager.dataValue ).toBe( 1 )
	f.more()
	expect( f.pending ).toHaveLength( 1 )
	expect( f.group.query.jet_paged ).toBe( 2 )
	f.finish( result( 2 ) )
	expect( f.text() ).toBe( 'Page 1Page 2' )
} )

it( 'treats a confirmed empty last page as terminal without clearing items', () => {
	const f = fixture()
	f.more()
	f.finish( result( 2, [], 1 ) )
	expect( f.text() ).toBe( 'Page 1' )
	expect( f.pager.pagesCount ).toBe( 1 )
	expect( f.root.querySelector( '.jet-asynch-listing__state--error' ).hidden ).toBe( true )
} )

it.each( [ 'replacement', 'direct' ] )( 'ignores an old append callback after %s update', ( mode ) => {
	const f = fixture()
	f.more()
	const old = f.pending.shift()
	if ( mode === 'replacement' ) {
		f.pager.dataValue = 1
		f.group.doAjax()
		f.finish( result( 2 ), old )
		expect( f.group.isAjaxLoading ).toBe( true )
		f.finish( result( 1, [ { title: 'New' } ] ) )
	} else {
		updateInstance( f.root, { result: result( 1, [ { title: 'New' } ] ) } )
		f.finish( result( 2 ), old )
	}
	expect( f.text() ).toBe( 'New' )
	expect( window.JetSmartFilterSettings.props[ providerId ].products.page ).toBe( 1 )
} )

it( 'rejects repeated pages and mismatched response targets', async () => {
	const f = fixture()
	f.more()
	f.finish( result( 2 ) )
	f.more()
	f.finish( result( 2 ) )
	expect( f.text() ).toBe( 'Page 1Page 2' )
	f.more()
	const callback = f.pending.shift()
	callback( { asynch_listing: { products: { query_id: 'other', result: result( 3 ) } } } )
	f.group.endAjaxLoading()
	await Promise.resolve()
	expect( f.text() ).toBe( 'Page 1Page 2' )
	expect( f.pager.dataValue ).toBe( 2 )
} )

it( 'does not recover a newer request when an older network failure completes late', () => {
	const f = fixture()
	f.more()
	let fail
	trackFiltersAjax( null, { fail: ( callback ) => { fail = callback } }, { data: 'provider=jet-engine-asynch-listing%2Fproducts' } )
	f.pending.shift()
	f.pager.dataValue = 1
	f.group.doAjax()
	fail( {}, 'error' )
	f.group.endAjaxLoading()
	expect( f.group.isAjaxLoading ).toBe( true )
	expect( f.root.getAttribute( 'aria-busy' ) ).toBe( 'true' )
	f.finish( result( 1, [ { title: 'New' } ] ) )
	expect( f.text() ).toBe( 'New' )
} )

it( 'retains replacement fallback for a legacy-only content response', async () => {
	const f = fixture()
	f.pager.dataValue = 2
	f.group.ajaxRequest( ( response ) => {
		Promise.resolve().then( () => updateFromFiltersResponse( response, updateInstance ) )
	} )
	f.finish( result( 2 ) )
	await Promise.resolve()
	expect( f.text() ).toBe( 'Page 2' )
	expect( f.root.querySelector( '.jet-asynch-listing__state--error' ).hidden ).toBe( true )
} )
