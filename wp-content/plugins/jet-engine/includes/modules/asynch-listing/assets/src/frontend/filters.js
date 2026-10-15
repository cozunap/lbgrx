import { selector } from './constants'
import { buildErrorDetail, setState } from './ui'

export const providerId = 'jet-engine-asynch-listing'
const marker = 'data-jet-asynch-listing-provider'
let targets = new Map()
let roots = []
const consumed = new WeakSet()
const initialPagination = new WeakMap()
const acceptedPagination = new WeakMap()
const requests = new WeakMap()
const responseRequests = new WeakMap()
const adaptedGroups = new WeakSet()
const failedRequests = new WeakMap()

export function getAcceptedPagination( root ) {
	return acceptedPagination.get( root )
}

export function storeAcceptedPagination( root, config, meta, append = false, terminal = false ) {
	if ( ! append ) {
		acceptedPagination.delete( root )
	}
	if ( config.source !== 'jet_engine_query' || ! validPagination( meta ) ) {
		return
	}
	const previous = acceptedPagination.get( root )
	acceptedPagination.set( root, {
		meta: { total: meta.total, pages: meta.pages, page: meta.page },
		page: terminal ? previous?.page : meta.page,
		firstPage: append ? previous?.firstPage : meta.page,
		terminal,
	} )
}

export function validPagination( meta ) {
	return !! meta && ! Array.isArray( meta ) && Number.isSafeInteger( meta.page ) && meta.page > 0
		&& Number.isSafeInteger( meta.pages ) && meta.pages >= 0
		&& Number.isSafeInteger( meta.total ) && meta.total >= 0
}

function ownedGroupRoot( group ) {
	const queryId = String( group.queryId ?? 'default' )
	const root = resolveFilterRoot( queryId )
	const settings = getSettings( queryId )
	return group.provider === providerId && root && settings && ! settings.target_conflict
		&& settings.source === 'jet_engine_query' && settings.instance_id === root.id
		&& String( settings.query_id ) === queryId ? root : null
}

function isCurrentRequest( request ) {
	return requests.get( request.root ) === request && ownedGroupRoot( request.group ) === request.root
		&& request.root.__jetAsynchListingUpdateToken === request.token
}

function restorePagination( request ) {
	const { root, group } = request
	const accepted = acceptedPagination.get( root )
	if ( ! accepted || ! isCurrentRequest( request ) ) {
		return
	}
	const { meta, page, firstPage, terminal } = accepted
	const queryId = String( group.queryId ?? 'default' )
	const props = window.JetSmartFilterSettings.props || {}
	const providerProps = Object.prototype.hasOwnProperty.call( props, providerId ) ? props[ providerId ] : {}
	const current = Object.prototype.hasOwnProperty.call( providerProps, queryId ) ? providerProps[ queryId ] : {}
	const cursor = terminal ? Math.max( 1, meta.pages ) : page
	const history = []
	for ( let index = firstPage; index < cursor; index++ ) {
		history.push( index )
	}
	const next = { ...current, found_posts: meta.total, max_num_pages: meta.pages, page: cursor }
	if ( history.length ) {
		next.pages = [ ...history, cursor ]
	} else {
		delete next.pages
	}
	window.JetSmartFilterSettings.props = { ...props, [ providerId ]: { ...providerProps, [ queryId ]: next } }
	const pagers = typeof group.getFiltersByName === 'function' ? group.getFiltersByName( 'pagination' ) : []
	pagers.forEach( ( pager ) => {
		// JSF advances these before requesting. reinit() alone is a no-op when
		// pageIndex still equals the accepted page, leaving retry on the wrong page.
		pager.dataValue = cursor
		pager.moreActiveIndexes = history.slice()
		pager.reinit?.()
	} )
	// doAjax compares against currentQuery; restore it too so retry is not skipped.
	group.currentQuery = { ...group.query }
	group.updateUrl?.()
}

function failRequest( request ) {
	if ( ! isCurrentRequest( request ) || request.settled ) {
		return
	}
	request.settled = true
	if ( request.append ) {
		restorePagination( request )
	}
	const config = request.root.__jetAsynchListingConfig || {}
	setState( request.root, 'error', buildErrorDetail( config ) )
	request.root.dispatchEvent( new CustomEvent( 'jet-engine/asynch-listing/updated', {
		bubbles: true,
		detail: { instanceId: config.instance_id, queryId: config.instance_id, source: config.source, state: 'error', meta: {} },
	} ) )
}

export function trackFiltersAjax( event, xhr, settings ) {
	const data = typeof settings.data === 'string' ? new URLSearchParams( settings.data ) : null
	const provider = data ? data.get( 'provider' ) : settings.data?.provider
	if ( typeof provider !== 'string' || ! provider.startsWith( providerId + '/' ) ) {
		return
	}
	const root = resolveFilterRoot( provider.slice( providerId.length + 1 ) )
	const request = root && requests.get( root )
	if ( ! request || ! isCurrentRequest( request ) ) {
		return
	}
	xhr.fail( ( response, status ) => {
		// Aborts do not call JSF endAjaxLoading. Associate other failures with
		// their originating request before JSF's promise rejection runs.
		if ( status !== 'abort' ) {
			const failures = failedRequests.get( request.group ) || []
			failures.push( request )
			failedRequests.set( request.group, failures )
		}
	} )
}

// JSF has no request ID in its completion event. Adapt only this provider's
// group instances, retaining its transport, abort logic and completion lifecycle.
export function adaptFilterGroup( group ) {
	if ( group.provider !== providerId || adaptedGroups.has( group )
		|| typeof group.doAjax !== 'function' || typeof group.ajaxRequest !== 'function'
		|| typeof group.endAjaxLoading !== 'function' ) {
		return
	}
	adaptedGroups.add( group )
	const doAjax = group.doAjax
	const ajaxRequest = group.ajaxRequest
	const endLoading = group.endAjaxLoading
	let options
	let completedRequest
	group.doAjax = function ( ...args ) {
		const previous = options
		options = args[ 0 ]
		try {
			return doAjax.apply( this, args )
		} finally {
			options = previous
		}
	}
	group.ajaxRequest = function ( callback, ...args ) {
		const root = ownedGroupRoot( this )
		if ( ! root ) {
			return ajaxRequest.call( this, callback, ...args )
		}
		const request = {
			root, group: this, token: Symbol( 'jsf-request' ),
			append: !! options && ! Array.isArray( options ) && options.append === true,
			page: ( args[ 0 ] || this.query )?.jet_paged || 1,
			settled: false,
		}
		requests.set( root, request )
		root.__jetAsynchListingUpdateToken = request.token
		clearInitialPagination( root )
		setState( root, 'loading' )
		return ajaxRequest.call( this, ( response ) => {
			completedRequest = request
			if ( ! isCurrentRequest( request ) ) {
				return
			}
			Object.values( response?.asynch_listing || {} ).forEach( ( payload ) => {
				if ( payload && typeof payload === 'object' ) {
					responseRequests.set( payload, request )
				}
			} )
			callback( response )
		}, ...args )
	}
	group.endAjaxLoading = function ( ...args ) {
		const root = ownedGroupRoot( this )
		const current = root && requests.get( root )
		const completed = completedRequest
		const request = completedRequest || failedRequests.get( this )?.shift() || current
		completedRequest = null
		if ( request && current && request !== current && ! current.settled ) {
			return
		}
		if ( request ) {
			if ( completed && ! request.settled ) {
				// Allow a legacy-only deferred content event to consume the response.
				Promise.resolve().then( () => failRequest( request ) )
			} else {
				failRequest( request )
			}
		}
		return endLoading.apply( this, args )
	}
}

export function clearInitialPagination( root ) {
	initialPagination.delete( root )
}

export function storeInitialPagination( root, config, meta ) {
	if ( config.source !== 'jet_engine_query' || ! meta || typeof meta !== 'object' || Array.isArray( meta ) ) {
		return
	}
	const props = {}
	Object.entries( { total: 'found_posts', pages: 'max_num_pages', page: 'page' } ).forEach( ( [ key, prop ] ) => {
		if ( Object.prototype.hasOwnProperty.call( meta, key ) && Number.isSafeInteger( meta[ key ] ) && meta[ key ] >= 0 ) {
			props[ prop ] = meta[ key ]
		}
	} )
	if ( ! Object.keys( props ).length ) {
		return
	}
	initialPagination.set( root, {
		props,
		token: root.__jetAsynchListingUpdateToken,
		groups: new WeakSet(),
		pagers: new WeakSet(),
	} )
	Object.values( window.JetSmartFilters?.filterGroups || {} ).forEach( syncInitialPagination )
}

export function syncInitialPagination( group ) {
	if ( group.provider !== providerId ) {
		return
	}
	const queryId = String( group.queryId ?? 'default' )
	const root = resolveFilterRoot( queryId )
	const snapshot = root && initialPagination.get( root )
	const settings = getSettings( queryId )
	if ( ! snapshot || snapshot.token !== root.__jetAsynchListingUpdateToken
		|| ! settings || settings.target_conflict || settings.source !== 'jet_engine_query'
		|| settings.instance_id !== root.id || String( settings.query_id ) !== queryId ) {
		return
	}
	if ( ! snapshot.groups.has( group ) ) {
		// Runtime props are separate from signed provider settings. Computed keys
		// create own properties even for targets such as "__proto__".
		const props = window.JetSmartFilterSettings.props || {}
		const providerProps = Object.prototype.hasOwnProperty.call( props, providerId ) ? props[ providerId ] : {}
		const targetProps = providerProps && Object.prototype.hasOwnProperty.call( providerProps, queryId ) ? providerProps[ queryId ] : {}
		window.JetSmartFilterSettings.props = {
			...props,
			[ providerId ]: { ...providerProps, [ queryId ]: { ...targetProps, ...snapshot.props } },
		}
		snapshot.groups.add( group )
	}
	// Reuse JSF's pager lifecycle without simulating an AJAX completion or fetch.
	const pagers = typeof group.getFiltersByName === 'function' ? group.getFiltersByName( 'pagination' ) : []
	pagers.forEach( ( pager ) => {
		if ( typeof pager.reinit === 'function' && ! snapshot.pagers.has( pager ) ) {
			snapshot.pagers.add( pager )
			pager.reinit()
		}
	} )
}

function addTarget( key, root ) {
	if ( ! targets.has( key ) ) {
		targets.set( key, new Set() )
	}
	targets.get( key ).add( root )
}

export function showTargetDiagnostic( root, message ) {
	let config
	try {
		config = JSON.parse( root.querySelector( '.jet-asynch-listing__config' )?.textContent || '{}' )
	} catch ( error ) {
		return
	}
	const container = root.querySelector( '.jet-asynch-listing__diagnostics' )
	if ( ! config.show_diagnostics || ! container ) {
		return
	}
	message = config.filter_target_notice || message
	let list = container.querySelector( 'ul' )
	if ( ! list ) {
		list = document.createElement( 'ul' )
		container.appendChild( list )
	}
	if ( ! Array.from( list.children ).some( ( item ) => item.textContent === message ) ) {
		const item = document.createElement( 'li' )
		item.textContent = message
		list.appendChild( item )
	}
	container.hidden = false
}

// Index once per document/root batch, never select the first matching listing.
export function refreshFilterTargets() {
	targets = new Map()
	roots = Array.from( document.querySelectorAll( selector ) )
	const ids = new Map()
	document.querySelectorAll( '[id]' ).forEach( ( node ) => {
		if ( ! ids.has( node.id ) ) {
			ids.set( node.id, [] )
		}
		ids.get( node.id ).push( node )
	} )
	document.querySelectorAll( `[${ marker }]` ).forEach( ( node ) => node.removeAttribute( marker ) )
	roots.forEach( ( root ) => {
		const target = root.getAttribute( 'data-jet-asynch-listing-target' ) || ''
		root.setAttribute( marker, '' )
		addTarget( root.id, root )
		if ( ! target ) {
			addTarget( 'default', root )
		} else {
			addTarget( target, root )
			const elements = ids.get( target ) || []
			const element = elements.length === 1 ? elements[ 0 ] : null
			// Only the root or its own wrapper can own a configured target.
			if ( element && ( element === root || ( element.contains( root ) && ! element.matches( selector )
				&& Array.from( element.querySelectorAll( selector ) ).filter( ( child ) => ! element.contains( child.parentElement.closest( selector ) ) ).length === 1 ) ) ) {
				element.setAttribute( marker, '' )
			}
		}
	} )
	targets.forEach( ( matches, target ) => {
		const elements = ids.get( target ) || []
		if ( matches.size !== 1 || ( target !== 'default' && ( elements.length !== 1 || ! elements[ 0 ].hasAttribute( marker ) ) ) ) {
			matches.forEach( ( root ) => showTargetDiagnostic( root, 'Async Listing filter target is missing or duplicated. Use a unique element ID.' ) )
			targets.set( target, new Set() )
		}
	} )
}

export function resolveFilterRoot( queryId ) {
	const matches = targets.get( String( queryId || 'default' ) )
	const root = matches?.size === 1 ? matches.values().next().value : null
	return root?.isConnected ? root : null
}

function getSettings( queryId ) {
	const settings = window.JetSmartFilterSettings?.settings?.[ providerId ]
	return settings && Object.prototype.hasOwnProperty.call( settings, queryId ) ? settings[ queryId ] : null
}

export function prepareFiltersRequestData( data ) {
	if ( ! data || data.provider !== providerId ) {
		return data
	}
	const queryId = String( data.queryId || 'default' )
	const root = resolveFilterRoot( queryId )
	const settings = data.settings || getSettings( queryId )
	if ( ! root || ! settings || settings.instance_id !== root.id || String( settings.query_id ) !== queryId ) {
		roots.forEach( ( item ) => showTargetDiagnostic( item, 'Async Listing filter target or provider settings were not found. Check the filter Query ID.' ) )
		// JetSmartFilters rejects a request without a provider before issuing AJAX.
		return { ...data, provider: false }
	}
	return data
}

export function prepareInitialFilterRequest( root, config ) {
	const queryId = config.request?.filter_query_id
	if ( queryId && resolveFilterRoot( queryId ) !== root ) {
		// filters are unsigned; source settings and their signature remain untouched.
		delete config.request.request?.filters
	}
}

export function updateFromFiltersResponse( response, updateInstance, options, queryId ) {
	const payloads = response?.asynch_listing
	if ( ! payloads || typeof payloads !== 'object' ) {
		return
	}
	Object.entries( payloads ).forEach( ( [ instanceId, payload ] ) => {
		if ( ! payload || typeof payload !== 'object' || consumed.has( payload ) ) {
			return
		}
		const root = resolveFilterRoot( instanceId )
		if ( ! root || ( payload.instance_id && payload.instance_id !== instanceId )
			|| ( payload.query_id && resolveFilterRoot( payload.query_id ) !== root )
			|| ( queryId !== undefined && resolveFilterRoot( queryId ) !== root ) ) {
			return
		}
		const request = responseRequests.get( payload )
		if ( request && ( request.root !== root || request.settled || ! isCurrentRequest( request ) ) ) {
			return
		}
		consumed.add( payload )
		const append = !! options && typeof options === 'object' && ! Array.isArray( options ) && options.append === true
		if ( append && ( ! request || ! request.append || ownedGroupRoot( request.group ) !== root ) ) {
			return
		}
		const autoscroll = append && window.jQuery && ( options.autoscroll === true || Number.isFinite( options.autoscroll ) )
		const container = autoscroll && root.querySelector( '[data-jet-asynch-items]' )
		const scrollTop = container ? window.jQuery( container ).offset().top + window.jQuery( container ).outerHeight( true )
			- ( Number.isFinite( options.autoscroll ) ? options.autoscroll : 0 ) : null
		const success = updateInstance( root, payload, { append, token: request?.token, page: request?.page } )
		if ( request ) {
			request.settled = true
			if ( append ) {
				restorePagination( request )
			}
		}
		if ( success && payload.result?.data?.length && Number.isFinite( scrollTop ) ) {
			window.jQuery( 'html, body' ).stop().animate( { scrollTop }, 500 )
		}
	} )
}

export function scopeFilterGroups() {
	Object.values( window.JetSmartFilters?.filterGroups || {} ).forEach( ( group ) => {
		if ( group.provider !== providerId ) {
			return
		}
		adaptFilterGroup( group )
		const root = resolveFilterRoot( group.queryId )
		// Keep generic JSF loading/preloader behavior scoped to the owned runtime root.
		if ( window.jQuery ) {
			// doAjax() resolves this selector again before loading; an ambiguous group
			// must stay empty rather than rediscovering every provider on the page.
			group.providerSelector = root ? `[data-jet-asynch-listing="true"][id="${ root.id.replace( /[\\"]/g, '\\$&' ) }"]` : '[data-jet-asynch-listing="never"]'
			group.$provider = window.jQuery( root || [] )
		}
		if ( ! root ) {
			roots.forEach( ( item ) => showTargetDiagnostic( item, 'Async Listing filter target was not found or is duplicated. Check the filter Query ID.' ) )
		}
		syncInitialPagination( group )
	} )
}
