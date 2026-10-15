import { selector } from './constants'
import { fetchItems } from './fetch'
import { normalizeProxyResult, normalizeResultItems } from './results'
import { appendItems, buildErrorDetail, clearItems, disposeInstance, initLayout, mountItems, setState } from './ui'
import { prepareInitialFilterRequest, refreshFilterTargets, scopeFilterGroups, storeInitialPagination, clearInitialPagination, getAcceptedPagination, storeAcceptedPagination, validPagination } from './filters'

let observerStarted = false

function getConfig( root ) {
	const configNode = root.querySelector( '.jet-asynch-listing__config' )

	if ( root.__jetAsynchListingConfig ) {
		return root.__jetAsynchListingConfig
	}

	if ( ! configNode ) {
		return null
	}

	try {
		root.__jetAsynchListingConfig = JSON.parse( configNode.textContent || '{}' )
		return root.__jetAsynchListingConfig
	} catch ( error ) {
		return null
	}
}

function dispatchUpdated( root, config, result, state ) {
	root.dispatchEvent( new CustomEvent( 'jet-engine/asynch-listing/updated', {
		bubbles: true,
		detail: {
			instanceId: config.instance_id,
			queryId: config.instance_id,
			source: config.source,
			state,
			meta: result && result.meta ? result.meta : {},
		},
	} ) )
}

function handleResult( root, config, result, initial = false, context = {} ) {
	let detail
	let layoutError

	result = normalizeResultItems( context.append ? normalizeProxyResult( null, result ) : result, config )
	const accepted = getAcceptedPagination( root )
	const append = context.append === true
	if ( append && result?.success && ( config.source !== 'jet_engine_query' || ! accepted || accepted.terminal
		|| ! validPagination( result?.meta ) || context.page !== accepted.page + 1
		|| result.meta.page !== context.page
		|| ( result.data?.length && result.meta.page > result.meta.pages )
		|| ( ! result.data?.length && result.meta.pages > result.meta.page ) ) ) {
		result = { success: false, error: { code: 'invalid_append_page', message: 'Load More returned an unexpected page.' } }
	}

	if ( ! result || ! result.success ) {
		detail = buildErrorDetail( config, result )
		setState( root, 'error', detail )
		dispatchUpdated( root, config, result, 'error' )
		return false
	}

	if ( ! result.data || ! result.data.length ) {
		if ( append ) {
			storeAcceptedPagination( root, config, result.meta, true, true )
			setState( root, 'success' )
			dispatchUpdated( root, config, result, 'success' )
			return true
		}
		clearItems( root )
		setState( root, 'empty', {
			diagnostics: config.show_diagnostics ? config.diagnostics : [],
		} )
		if ( initial ) {
			storeInitialPagination( root, config, result.meta )
		}
		storeAcceptedPagination( root, config, result.meta )
		dispatchUpdated( root, config, result, 'empty' )
		return true
	}

	if ( append ) {
		layoutError = appendItems( root, config, result.data )
	} else {
		mountItems( root, config, result.data )
		layoutError = initLayout( root, config, result.data.length )
	}

	if ( layoutError ) {
		if ( ! append ) {
			clearItems( root )
		}
		detail = buildErrorDetail( config, {
			error: {
				message: layoutError,
			},
		} )
		setState( root, 'error', detail )
		dispatchUpdated( root, config, result, 'error' )
		return false
	}

	setState( root, 'success', {
		diagnostics: config.show_diagnostics ? config.diagnostics : [],
	} )
	if ( initial ) {
		storeInitialPagination( root, config, result.meta )
	}
	storeAcceptedPagination( root, config, result.meta, append )
	dispatchUpdated( root, config, result, 'success' )
	return true
}

export function initInstance( root ) {
	const configNode = root.querySelector( '.jet-asynch-listing__config' )
	const config = getConfig( root )

	if ( root.__jetAsynchListingInitialized || ! configNode ) {
		return
	}

	root.__jetAsynchListingInitialized = true

	if ( ! config ) {
		setState( root, 'error', {
			message: 'Unable to initialize listing.',
			diagnostics: [],
		} )
		return
	}

	setState( root, 'loading' )
	prepareInitialFilterRequest( root, config )
	const token = Date.now() + Math.random()
	root.__jetAsynchListingUpdateToken = token

	fetchItems( config ).then( ( result ) => {
		if ( root.__jetAsynchListingUpdateToken !== token ) {
			return
		}
		handleResult( root, config, result, true )
	} ).catch( ( error ) => {
		if ( root.__jetAsynchListingUpdateToken !== token ) {
			return
		}
		const result = {
			error: {
				message: error && error.message ? error.message : 'Request failed.',
			},
		}

		setState( root, 'error', buildErrorDetail( config, result ) )
		dispatchUpdated( root, config, result, 'error' )
	} )
}

export function updateInstance( root, payload, context = {} ) {
	const baseConfig = getConfig( root )
	const token = context.token || Symbol( 'instance-update' )
	let config

	if ( ! baseConfig || ! payload ) {
		return
	}

	root.__jetAsynchListingUpdateToken = token

	// A deferred initial pager refresh must never overwrite newer JSF state.
	clearInitialPagination( root )
	if ( ! context.append ) {
		storeAcceptedPagination( root, baseConfig, null )
	}

	config = Object.assign( {}, baseConfig, {
		source: payload.source || baseConfig.source,
		diagnostics: Array.isArray( payload.diagnostics ) ? payload.diagnostics : baseConfig.diagnostics,
		request: payload.request || baseConfig.request,
		request_error: '',
	} )

	root.__jetAsynchListingConfig = config

	setState( root, 'loading' )

	if ( payload.result ) {
		return handleResult( root, config, payload.result, false, context )
	}
	if ( context.append ) {
		return handleResult( root, config, { success: false }, false, context )
	}

	fetchItems( config ).then( ( result ) => {
		if ( root.__jetAsynchListingUpdateToken !== token ) {
			return
		}

		handleResult( root, config, result )
	} ).catch( ( error ) => {
		if ( root.__jetAsynchListingUpdateToken !== token ) {
			return
		}

		const result = {
			error: {
				message: error && error.message ? error.message : 'Request failed.',
			},
		}

		setState( root, 'error', buildErrorDetail( config, result ) )
		dispatchUpdated( root, config, result, 'error' )
	} )
}

function collectRoots( context ) {
	let roots = []

	if ( ! context ) {
		return roots
	}

	if ( context.matches && context.matches( selector ) ) {
		roots.push( context )
	}

	if ( context.querySelectorAll ) {
		roots = roots.concat( Array.prototype.slice.call( context.querySelectorAll( selector ) ) )
	}

	return roots
}

export function initAll( context ) {
	const roots = collectRoots( context || document )
	if ( roots.length ) {
		refreshFilterTargets()
		roots.forEach( initInstance )
		scopeFilterGroups()
	}
}

export function startObserver() {
	if ( observerStarted || typeof MutationObserver === 'undefined' ) {
		return
	}

	observerStarted = true

	new MutationObserver( ( mutations ) => {
		const removed = new Set()
		mutations.forEach( ( mutation ) => {
			Array.from( mutation.removedNodes ).forEach( ( node ) => {
				collectRoots( node ).forEach( ( root ) => removed.add( root ) )
			} )
		} )
		// Dispose children before their parent's content is cleared. DOM moves
		// within the same document must retain their initialized layout.
		const byDepth = Array.from( removed, ( root ) => {
			let depth = 0
			for ( let parent = root.parentNode; parent; parent = parent.parentNode ) depth++
			return { root, depth }
		} )
		byDepth.sort( ( a, b ) => b.depth - a.depth ).forEach( ( { root } ) => {
			if ( ! root.isConnected ) {
				clearInitialPagination( root )
				disposeInstance( root )
			}
		} )
		if ( removed.size ) {
			refreshFilterTargets()
			scopeFilterGroups()
		}
		mutations.forEach( ( mutation ) => {
			Array.prototype.slice.call( mutation.addedNodes || [] ).forEach( ( node ) => {
				if ( node && Node.ELEMENT_NODE === node.nodeType && node.isConnected ) {
					initAll( node )
				}
			} )
		} )
	} ).observe( document.body, {
		childList: true,
		subtree: true,
	} )
}
