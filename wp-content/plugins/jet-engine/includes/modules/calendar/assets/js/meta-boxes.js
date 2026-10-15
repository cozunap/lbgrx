window.JetPlugins.hooks.addFilter(
	'jetEngine.metaFields.allowedFieldTypes',
	'jetEngineWCMetaBoxes',
	( fieldTypes ) => {

		// if is metabox page
		if ( window.JetEngineMB && 'post' === window.JetEngineMB.generalSettings.object_type ) {
			return fieldTypes;
		}

		// If is post type edit page
		if ( window.JetEngineCPTConfig && window.JetEngineCPTConfig.is_post_types_editor ) {
			return fieldTypes;
		}

		return fieldTypes.filter( ( fieldType ) => {

			if ( 'advanced-date' === fieldType.value ) {
				return false;
			} else {
				return true;
			}

		} );
	}
);

window.JetPlugins.hooks.addFilter(
	'jetEngine.metaFields.defaultFieldProps',
	'jet-engine-calendar/advanced-date',
	( defaults, type ) => {

		if ( 'advanced-date' !== type ) {
			return defaults;
		}

		return {
			...defaults,
			allow_end_date: true,
			force_end_date: false,
		};
	}
);