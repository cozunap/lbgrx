import { disposeInstance } from './frontend/ui'

const selector = '[data-jet-asynch-listing="true"]'

let observerStarted = false

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

function getConfigNode( root ) {
	return root ? root.querySelector( '.jet-asynch-listing__config' ) : null
}

function getConfigSnapshot( root ) {
	const configNode = getConfigNode( root )

	return configNode ? String( configNode.textContent || '' ) : ''
}

function resetRoot( root ) {
	if ( ! root ) {
		return
	}

	disposeInstance( root )
	root.__jetAsynchListingPreviewSnapshot = getConfigSnapshot( root )
}

function showRuntimeDiagnostic( root ) {
	const configNode = getConfigNode( root )
	let config = null

	if ( ! configNode ) {
		return
	}

	try {
		config = JSON.parse( configNode.textContent || '{}' )
	} catch ( error ) {
		return
	}

	if ( ! config.show_diagnostics ) {
		return
	}

	const diagnostics = root.querySelector( '.jet-asynch-listing__diagnostics' )

	if ( ! diagnostics ) {
		return
	}

	let list = diagnostics.querySelector( '.jet-asynch-listing__diagnostics-list' )
	const message = 'The Async Listing preview runtime is unavailable.'

	if ( ! list ) {
		list = document.createElement( 'ul' )
		list.className = 'jet-asynch-listing__diagnostics-list'
		diagnostics.appendChild( list )
	}

	if ( ! Array.prototype.some.call( list.children, ( item ) => item.textContent === message ) ) {
		const item = document.createElement( 'li' )

		item.textContent = message
		list.appendChild( item )
	}

	diagnostics.hidden = false
}

function refreshRoot( root ) {
	if ( ! root || ! root.isConnected ) {
		return
	}

	if ( ! window.JetEngineAsynchListing || typeof window.JetEngineAsynchListing.initInstance !== 'function' ) {
		showRuntimeDiagnostic( root )
		return
	}

	resetRoot( root )
	window.JetEngineAsynchListing.initInstance( root )
}

function refreshContext( context ) {
	collectRoots( context || document ).forEach( refreshRoot )
}

function maybeRefreshRoot( root ) {
	const snapshot = getConfigSnapshot( root )

	if ( ! snapshot ) {
		return
	}

	if ( ! root.__jetAsynchListingInitialized || root.__jetAsynchListingPreviewSnapshot !== snapshot ) {
		refreshRoot( root )
	}
}

function scanContext( context ) {
	collectRoots( context || document ).forEach( maybeRefreshRoot )
}

function startObserver() {
	if ( observerStarted || typeof MutationObserver === 'undefined' || ! document.body ) {
		return
	}

	observerStarted = true

	new MutationObserver( ( mutations ) => {
		mutations.forEach( ( mutation ) => {
			if ( mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE ) {
				scanContext( mutation.target )
			}

			Array.prototype.slice.call( mutation.addedNodes || [] ).forEach( ( node ) => {
				if ( node && Node.ELEMENT_NODE === node.nodeType ) {
					scanContext( node )
				}
			} )
		} )
	} ).observe( document.body, {
		attributes: false,
		characterData: true,
		childList: true,
		subtree: true,
	} )
}

function normalizeContext( context ) {
	if ( context && context.jquery ) {
		return context[ 0 ] || document
	}

	return context || document
}

function bindElementor() {
	if ( ! window.elementorFrontend || ! window.elementorFrontend.hooks ) {
		return
	}

	window.elementorFrontend.hooks.addAction( 'frontend/element_ready/jet-asynch-listing.default', ( scope ) => {
		refreshContext( normalizeContext( scope ) )
	} )
}

function init() {
	refreshContext( document )
	startObserver()
	bindElementor()
}

window.jetEngineAsynchListingBricks = function( context ) {
	refreshContext( normalizeContext( context ) )
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init )
} else {
	init()
}
