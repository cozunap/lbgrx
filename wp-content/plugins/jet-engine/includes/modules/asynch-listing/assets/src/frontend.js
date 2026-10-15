import '../scss/frontend.scss'

import { initAll, startObserver, updateInstance } from './frontend/instance'
import { adaptFilterGroup, prepareFiltersRequestData, refreshFilterTargets, scopeFilterGroups, syncInitialPagination, trackFiltersAjax, updateFromFiltersResponse as applyFiltersResponse } from './frontend/filters'

window.JetEngineAsynchListing = Object.assign( window.JetEngineAsynchListing || {}, {
	init: initAll,
	initInstance: ( root ) => initAll( root ),
	updateInstance: ( root, payload ) => { updateInstance( root, payload ) },
} )

function updateFromFiltersResponse( response, options, queryId ) {
	applyFiltersResponse( response, updateInstance, options, queryId )
}

function bindSmartFiltersBridge() {
	if ( ! window.JetSmartFilters || ! window.JetSmartFilters.events ) {
		return false
	}

	if ( window.JetEngineAsynchListing.__smartFiltersBridgeBound ) {
		return true
	}

	window.JetEngineAsynchListing.__smartFiltersBridgeBound = true

	window.JetSmartFilters.events.subscribe( 'filterGroup/init', ( group ) => {
		adaptFilterGroup( group )
		// JSF emits this during construction, before registering the first filter.
		Promise.resolve().then( () => syncInitialPagination( group ) )
	} )

	window.JetSmartFilters.events.subscribe( 'ajaxFilters/updated', ( provider, queryId, response, options ) => {
		if ( provider === 'jet-engine-asynch-listing' ) {
			updateFromFiltersResponse( response, options, queryId )
		}
	}, true )

	return true
}

function bindJetPluginsRequestBridge() {
	if ( ! window.JetPlugins || ! window.JetPlugins.hooks ) {
		return false
	}

	if ( window.JetEngineAsynchListing.__jetPluginsRequestBridgeBound ) {
		return true
	}

	window.JetEngineAsynchListing.__jetPluginsRequestBridgeBound = true
	window.JetPlugins.hooks.addFilter(
		'jet-smart-filters.request.data',
		'jet-engine-asynch-listing',
		prepareFiltersRequestData
	)

	return true
}

function initFiltersCompatibility() {
	refreshFilterTargets()
	bindSmartFiltersBridge()
	bindJetPluginsRequestBridge()

	document.addEventListener( 'jet-smart-filters/before-init', () => {
		refreshFilterTargets()
		bindSmartFiltersBridge()
		bindJetPluginsRequestBridge()
	} )

	document.addEventListener( 'jet-smart-filters/inited', () => {
		scopeFilterGroups()
		bindSmartFiltersBridge()
		bindJetPluginsRequestBridge()
	} )
}

if ( window.jQuery ) {
	window.jQuery( document ).on( 'ajaxSend.jetAsynchListing', trackFiltersAjax )
	window.jQuery( document ).on( 'jet-filter-custom-content-render', ( event, response ) => {
		// JSF emits this before the authoritative event carrying append options.
		Promise.resolve().then( () => updateFromFiltersResponse( response ) )
	} )
}

initFiltersCompatibility()

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', () => {
		initAll( document )
		startObserver()
	} )
} else {
	initAll( document )
	startObserver()
}
