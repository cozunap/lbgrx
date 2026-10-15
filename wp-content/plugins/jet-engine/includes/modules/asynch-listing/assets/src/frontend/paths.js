import { reservedSegments } from './constants'
import { hasOwn, isScalar } from './utils'

const pathSegmentsCache = {}

function isReservedSegment( segment ) {
	return !! reservedSegments[ String( segment || '' ).toLowerCase() ]
}

export function getPathSegments( path ) {
	let cacheKey
	let parts
	let i

	if ( ! path && 0 !== path ) {
		return null
	}

	cacheKey = String( path )

	if ( hasOwn( pathSegmentsCache, cacheKey ) ) {
		return pathSegmentsCache[ cacheKey ]
	}

	parts = cacheKey.split( '.' )

	if ( ! parts.length ) {
		pathSegmentsCache[ cacheKey ] = null
		return null
	}

	for ( i = 0; i < parts.length; i++ ) {
		if ( ! parts[ i ] || isReservedSegment( parts[ i ] ) ) {
			pathSegmentsCache[ cacheKey ] = null
			return null
		}
	}

	pathSegmentsCache[ cacheKey ] = parts

	return parts
}

export function resolvePath( source, path, allowCollections ) {
	let current = source
	let parts
	let i
	let key

	if ( ! path ) {
		return allowCollections ? null : ''
	}

	parts = getPathSegments( path )

	if ( ! parts ) {
		return allowCollections ? null : ''
	}

	for ( i = 0; i < parts.length; i++ ) {
		key = parts[ i ]

		if ( null == current || 'object' !== typeof current ) {
			return allowCollections ? null : ''
		}

		if ( Array.isArray( current ) ) {
			if ( ! /^\d+$/.test( key ) ) {
				return allowCollections ? null : ''
			}

			key = parseInt( key, 10 )

			if ( key < 0 || key >= current.length ) {
				return allowCollections ? null : ''
			}
		} else if ( ! hasOwn( current, key ) ) {
			return allowCollections ? null : ''
		}

		current = current[ key ]
	}

	if ( allowCollections ) {
		return current
	}

	if ( ! isScalar( current ) ) {
		return ''
	}

	return String( current )
}

export function sanitizeUrl( value ) {
	let urlValue
	let url

	if ( ! value ) {
		return ''
	}

	urlValue = String( value ).trim()

	if ( ! urlValue ) {
		return ''
	}

	if ( 0 === urlValue.indexOf( '#' ) ) {
		return urlValue
	}

	if ( 0 === urlValue.indexOf( '//' ) ) {
		return ''
	}

	if ( /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test( urlValue ) ) {
		try {
			url = new URL( urlValue, window.location.origin )

			if ( [ 'http:', 'https:', 'mailto:', 'tel:' ].indexOf( url.protocol ) === -1 ) {
				return ''
			}

			return url.toString()
		} catch ( error ) {
			return ''
		}
	}

	try {
		url = new URL( urlValue, window.location.origin )

		if ( url.origin !== window.location.origin ) {
			return ''
		}

		return urlValue
	} catch ( error ) {
		return ''
	}
}