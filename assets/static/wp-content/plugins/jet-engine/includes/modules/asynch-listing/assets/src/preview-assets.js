let previewAssets = null
let commonRuntimeRequest = null
const layoutRuntimeRequests = new Map()

export function setPreviewAssets( assets ) {
	previewAssets = assets && typeof assets === 'object' ? assets : null
	commonRuntimeRequest = null
	layoutRuntimeRequests.clear()
}

export function getPreviewSettings() {
	return previewAssets && previewAssets.settings ? previewAssets.settings : {}
}

function loadStyle( asset ) {
	if ( ! asset || ! asset.id || ! asset.href ) {
		return Promise.reject( new Error( 'Invalid Async Listing preview style.' ) )
	}

	if ( document.getElementById( asset.id ) ) {
		return Promise.resolve()
	}

	return new Promise( ( resolve, reject ) => {
		const link = document.createElement( 'link' )

		link.id = asset.id
		link.rel = 'stylesheet'
		link.href = asset.href
		link.onload = resolve
		link.onerror = () => reject( new Error( 'Unable to load Async Listing preview style.' ) )
		document.head.appendChild( link )
	} )
}

function loadScript( asset ) {
	if ( ! asset || ! asset.id || ! asset.src ) {
		return Promise.reject( new Error( 'Invalid Async Listing preview script.' ) )
	}

	if ( document.getElementById( asset.id ) ) {
		return Promise.resolve()
	}

	return new Promise( ( resolve, reject ) => {
		const script = document.createElement( 'script' )

		script.id = asset.id
		script.src = asset.src
		script.async = false
		script.onload = resolve
		script.onerror = () => reject( new Error( 'Unable to load Async Listing preview script.' ) )
		document.head.appendChild( script )
	} )
}

function ensureCommonPreviewAssets() {
	if ( commonRuntimeRequest ) {
		return commonRuntimeRequest
	}

	if ( ! previewAssets || ! Array.isArray( previewAssets.scripts ) || ! Array.isArray( previewAssets.styles ) ) {
		return Promise.reject( new Error( 'Async Listing preview assets are unavailable.' ) )
	}

	window.JetEngineSettings = Object.assign( window.JetEngineSettings || {}, previewAssets.settings || {} )

	commonRuntimeRequest = Promise.all( previewAssets.styles.map( loadStyle ) )
		.then( () => previewAssets.scripts.reduce( ( chain, asset ) => chain.then( () => loadScript( asset ) ), Promise.resolve() ) )
		.catch( ( error ) => {
			commonRuntimeRequest = null
			throw error
		} )

	return commonRuntimeRequest
}

/**
 * Loads the shared Listing Grid runtime only when a selected layout needs it.
 *
 * The block-renderer preview returns markup only, so the URLs are a fixed
 * server-provided manifest rather than a response-controlled asset request.
 */
export function ensureLayoutPreviewAssets( preset ) {
	if ( 'slider' !== preset && 'masonry' !== preset ) {
		return Promise.resolve()
	}

	if ( layoutRuntimeRequests.has( preset ) ) {
		return layoutRuntimeRequests.get( preset )
	}

	const layoutAssets = previewAssets && previewAssets.layouts ? previewAssets.layouts[ preset ] : null

	if (
		! layoutAssets
		|| ! Array.isArray( layoutAssets.scripts )
		|| ! Array.isArray( layoutAssets.styles )
	) {
		return Promise.reject( new Error( 'Async Listing preview assets are unavailable.' ) )
	}

	const request = ensureCommonPreviewAssets()
		.then( () => Promise.all( layoutAssets.styles.map( loadStyle ) ) )
		.then( () => layoutAssets.scripts.reduce( ( chain, asset ) => chain.then( () => loadScript( asset ) ), Promise.resolve() ) )
		.then( () => {
			if ( ! window.JetEngine ) {
				throw new Error( 'Async Listing preview runtime is unavailable.' )
			}

			if ( 'slider' === preset && typeof window.JetEngine.initSlider !== 'function' ) {
				throw new Error( 'Async Listing slider preview runtime is unavailable.' )
			}

			if (
				'masonry' === preset
				&& (
					typeof window.JetEngine.initMasonry !== 'function'
					|| typeof window.imagesLoaded !== 'function'
					|| typeof window.Macy !== 'function'
				)
			) {
				throw new Error( 'Async Listing Masonry preview runtime is unavailable.' )
			}
		} )
		.catch( ( error ) => {
			layoutRuntimeRequests.delete( preset )
			throw error
		} )

	layoutRuntimeRequests.set( preset, request )

	return request
}
