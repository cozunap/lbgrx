export function hasOwn( object, key ) {
	return !! object && Object.prototype.hasOwnProperty.call( object, key )
}

export function isScalar( value ) {
	return null !== value && [ 'string', 'number', 'boolean' ].indexOf( typeof value ) !== -1
}

export function uniqueMessages( messages ) {
	const seen = {}

	return ( messages || [] ).filter( ( message ) => {
		if ( ! message || seen[ message ] ) {
			return false
		}

		seen[ message ] = true
		return true
	} )
}