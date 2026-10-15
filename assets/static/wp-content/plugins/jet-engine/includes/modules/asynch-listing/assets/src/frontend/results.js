import { resolvePath } from './paths'
import { isScalar, uniqueMessages } from './utils'

function getErrorMessage( errorValue ) {
	const messages = []

	if ( Array.isArray( errorValue ) ) {
		errorValue.forEach( ( item ) => {
			const message = getErrorMessage( item )

			if ( message ) {
				messages.push( message )
			}
		} )

		return uniqueMessages( messages ).join( ' ' )
	}

	if ( errorValue && 'object' === typeof errorValue ) {
		if ( isScalar( errorValue.message ) ) {
			return String( errorValue.message )
		}

		if ( isScalar( errorValue.code ) ) {
			return String( errorValue.code )
		}

		return ''
	}

	return isScalar( errorValue ) ? String( errorValue ) : ''
}

function extractResponseError( response, errorPath, errorCode ) {
	let value
	let message

	if ( ! errorPath ) {
		return null
	}

	value = resolvePath( response, errorPath, true )

	if ( null === value || '' === value ) {
		return null
	}

	if ( Array.isArray( value ) && ! value.length ) {
		return null
	}

	message = getErrorMessage( value )

	return {
		code: errorCode || 'source_error',
		message: message || 'Source response contains errors.',
	}
}

function extractMetaHeaders( response, metaHeaders ) {
	const meta = {}

	if ( ! response || ! response.headers || ! metaHeaders ) {
		return meta
	}

	Object.keys( metaHeaders ).forEach( ( metaKey ) => {
		const headerName = metaHeaders[ metaKey ]
		let headerValue

		if ( ! headerName ) {
			return
		}

		headerValue = response.headers.get( headerName )

		if ( null !== headerValue && '' !== headerValue ) {
			meta[ metaKey ] = headerValue
		}
	} )

	return meta
}

export function createErrorResult( code, message, meta ) {
	const result = {
		success: false,
		data: [],
		error: {
			code: code,
			message: message,
		},
	}

	if ( meta && Object.keys( meta ).length ) {
		result.meta = meta
	}

	return result
}

function areItemsObjects( items ) {
	return Array.isArray( items ) && items.every( ( item ) => item && 'object' === typeof item && ! Array.isArray( item ) )
}

function createItemsNotObjectsError( meta ) {
	return createErrorResult( 'items_not_objects', 'Source response items must be objects.', meta )
}

export function normalizeProxyResult( response, result ) {
	const meta = result && result.meta && 'object' === typeof result.meta ? result.meta : {}

	if ( response && false === response.ok ) {
		return createErrorResult(
			result && result.error && result.error.code ? result.error.code : 'proxy_request_failed',
			result && result.error && result.error.message ? result.error.message : 'Proxy request failed.',
			meta
		)
	}

	if ( result && result.success && Array.isArray( result.data ) ) {
		if ( ! areItemsObjects( result.data ) ) {
			return createItemsNotObjectsError( meta )
		}

		return {
			success: true,
			data: result.data,
			meta: meta,
		}
	}

	return createErrorResult(
		result && result.error && result.error.code ? result.error.code : 'proxy_request_failed',
		result && result.error && result.error.message ? result.error.message : 'Proxy request failed.',
		meta
	)
}

export function normalizeDirectResult( response, payload, requestConfig ) {
	const meta = extractMetaHeaders( response, requestConfig && requestConfig.meta_headers )
	const allowPartialResponse = !! ( requestConfig && requestConfig.allow_partial_response )
	let sourceError
	let items

	if ( response && false === response.ok ) {
		return createErrorResult(
			payload && payload.code ? payload.code : 'direct_request_failed',
			payload && payload.message ? payload.message : 'Direct request failed.',
			meta
		)
	}

	sourceError = extractResponseError( payload, requestConfig && requestConfig.error_path, requestConfig && requestConfig.error_code )

	if ( sourceError && ! allowPartialResponse ) {
		return createErrorResult( sourceError.code, sourceError.message, meta )
	}

	items = payload

	if ( requestConfig && requestConfig.items_path ) {
		items = resolvePath( payload, requestConfig.items_path, true )

		if ( null === items ) {
			if ( sourceError ) {
				return createErrorResult( sourceError.code, sourceError.message, meta )
			}

			return createErrorResult( 'items_path_not_found', 'Configured items path was not found in the response.', meta )
		}
	}

	if ( ! Array.isArray( items ) ) {
		if ( sourceError ) {
			return createErrorResult( sourceError.code, sourceError.message, meta )
		}

		return createErrorResult( 'items_path_not_array', 'Configured items path did not resolve to an array.', meta )
	}

	if ( ! areItemsObjects( items ) ) {
		return createItemsNotObjectsError( meta )
	}

	return {
		success: true,
		data: items,
		meta: meta,
	}
}

export function parseJsonResponse( response ) {
	return response.text().then( ( text ) => {
		let payload = {}

		if ( text ) {
			try {
				payload = JSON.parse( text )
			} catch ( error ) {
				throw {
					code: 'invalid_json',
					message: 'Response did not contain valid JSON.',
				}
			}
		}

		return {
			response: response,
			payload: payload,
		}
	} )
}

export function normalizeResultItems( result, config ) {
	const limit = config && config.is_editor ? parseInt( config.preview_limit || 0, 10 ) : 0

	if ( ! result || ! result.success || ! limit || ! Array.isArray( result.data ) ) {
		return result
	}

	result.data = result.data.slice( 0, limit )

	return result
}
