(function( $, win ) {

	'use strict';

	function isTruthy( value ) {
		return true === value || 1 === value || '1' === value || 'true' === value;
	}

	function requiredValue( value, $field ) {

		if ( ! $field.find( '.jet-engine-advanced-date-field' ).length ) {
			return value;
		}

		try {
			value = JSON.parse( value );

			const $input = $field.find( '.jet-engine-advanced-date-field > input[type="hidden"]' );
			const allowEndDate = !! $input.attr( 'data-allow-end-date' );
			const forceEndDate = !! $input.attr( 'data-force-end-date' );

			// Normalize different data formats to a common dates collection.
			let dates = [];

			// Manual format.
			if ( 'manual' === value.data_format ) {

				if ( ! value.dates || ! value.dates.length ) {
					return false;
				}

				dates = value.dates.map( ( item ) => {
					const endDate = undefined !== item.endDate ? item.endDate : item.end_date;
					const isEndDate = undefined !== item.isEndDate ? item.isEndDate : item.is_end_date;

					return {
						date: item.date,
						isEndDate,
						endDate,
					};
				} );
			} else {

				// Recurrence Rule format.
				dates.push( {
					date: value.date,
					isEndDate: value.is_end_date,
					endDate: value.end_date,
				} );

			}

			for ( const item of dates ) {

				if ( ! item.date ) {
					return false;
				}

				const isEndDateActive = allowEndDate && (
					forceEndDate || isTruthy( item.isEndDate ) || !! item.endDate
				);

				if ( isEndDateActive && ! item.endDate ) {
					return false;
				}
			}

			return true;

		} catch ( e ) {
			return false;
		}
	}

	function init() {

		cxInterfaceBuilderAPI.filters.addFilter(
			'cxInterfaceBuilder/control/required-value',
			requiredValue
		);
	}

	$( document ).ready( init );

})( jQuery );
