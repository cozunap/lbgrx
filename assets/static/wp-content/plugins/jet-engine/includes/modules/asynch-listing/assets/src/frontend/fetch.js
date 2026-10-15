import {
	createErrorResult,
	normalizeDirectResult,
	normalizeProxyResult,
	parseJsonResponse,
} from './results'

export function fetchItems( config ) {
	const requestConfig = config && config.request && config.request.request ? config.request.request : null

	if ( config.request_error ) {
		return Promise.resolve( createErrorResult( 'request_error', config.request_error ) )
	}

	if ( ! requestConfig ) {
		return Promise.resolve( createErrorResult( 'invalid_request', 'Runtime request is not configured.' ) )
	}

	if ( 'proxy' === config.request.transport ) {
		return window.fetch( requestConfig.url, {
			method: requestConfig.method || 'POST',
			credentials: requestConfig.credentials || 'same-origin',
			headers: Object.assign( {
				'Content-Type': 'application/json',
			}, requestConfig.headers || {} ),
			body: JSON.stringify( {
				source: requestConfig.source,
				args: requestConfig.args || {},
				mutate_results: !! requestConfig.mutate_results,
				mutations: Array.isArray( requestConfig.mutations ) ? requestConfig.mutations : [],
				filters: requestConfig.filters || {},
				signature: requestConfig.signature || '',
			} ),
		} ).then( parseJsonResponse ).then( ( result ) => normalizeProxyResult( result.response, result.payload ) )
	}

	return window.fetch( requestConfig.url, {
		method: requestConfig.method || 'GET',
		credentials: requestConfig.credentials || 'same-origin',
		headers: requestConfig.headers || {},
	} ).then( parseJsonResponse ).then( ( result ) => normalizeDirectResult( result.response, result.payload, requestConfig ) )
}
