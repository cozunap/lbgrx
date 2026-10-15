Vue.component( 'jet-meta-field-options', {
	name: 'jet-meta-field-options',
	template: '#jet-meta-field-options',
	props: {
		value: {
			type: Array,
			default: function() {
				return [];
			},
		},
		field: {
			type: Object,
			default: function() {
				return {};
			},
		},
	},
	data() {
		return {
			options: []
		};
	},
	created() {
		this.options = [ ...this.value ];
	},
	watch: {
		options: {
			handler: function( val ) {
				this.$emit( 'input', val );
			},
			deep: true,
		},
	},
	methods: {
		setOptionProp: function( optionIndex, key, value ) {

			var options = [ ...this.options ];

			if ( 'is_checked' === key && ( 'radio' === this.field.type || ( 'select' === this.field.type && ! this.field.is_multiple ) ) ) {
				for ( var i = 0; i < options.length; i++ ) {
					if ( options[ i ].is_checked ) {
						options[ i ].is_checked = false;
					}
				}
			}

			options[ optionIndex ][ key ] = value;

			this.options = [ ...options ];
			//this.$emit( 'input', this.options );

		},
		getOptionSubtitle: function( option ) {

			var result = option.key;

			if ( option.is_checked ) {
				result += ' (checked)';
			}

			return result;

		},
		cloneOption: function( optionIndex ) {

			var option    = this.options[ optionIndex ],
				newOption = {
					key: option.key + '_copy',
					value: option.value + '(Copy)',
					id: this.getRandomID(),
				};

			this.options.splice( optionIndex + 1, 0, newOption );
			//this.$emit( 'input', this.options );

		},
		deleteOption: function( optionIndex ) {
			this.options.splice( optionIndex, 1 );
			//this.$emit( 'input', this.options );
		},
		addNewFieldOption: function( $event, index ) {

			var option = {
				key: '',
				value: '',
				collapsed: false,
				id: this.getRandomID(),
			};

			this.options.push( option );
			//this.$emit( 'input', this.options );

		},
		getRandomID: function() {
			return Math.floor( Math.random() * 8999 ) + 1000;
		},
		isCollapsed: function( object ) {
			if ( undefined === object.collapsed || true === object.collapsed ) {
				return true;
			} else {
				return false;
			}
		},
	}
} );

window.JetEngineMetaFieldsValidation = window.JetEngineMetaFieldsValidation || {
	instances: [],
	register( instance ) {
		if ( ! this.instances.includes( instance ) ) {
			this.instances.push( instance );
		}
	},
	unregister( instance ) {
		const index = this.instances.indexOf( instance );

		if ( -1 !== index ) {
			this.instances.splice( index, 1 );
		}
	},
	hasErrors() {
		return this.instances.some( function( instance ) {
			return instance && instance.isRoot && instance.hasHardValidationErrors && instance.hasHardValidationErrors();
		} );
	},
	getErrors() {
		let errors = [];

		for ( const instance of this.instances ) {
			if ( instance && instance.isRoot && instance.collectValidationErrors ) {
				errors = errors.concat( instance.collectValidationErrors() );
			}
		}

		return errors;
	},
};

Vue.component( 'jet-meta-field', {
	name: 'jet-meta-field',
	template: '#jet-meta-field',
	props: {
		value: {
			type: Object,
			default: function() {
				return {};
			},
		},
		hideOptions: {
			type: Array,
			default: function() {
				return [];
			},
		},
		showSanitize: {
			type: Boolean,
			default: false,
		},
		fieldTypes: {
			type: Array,
			default: function() {
				return [];
			},
		},
		fieldsNames: {
			type: Array,
			default: function() {
				return [];
			},
		},
		disabledFields: {
			type: Array,
			default: function() {
				return [];
			}
		},
		slugDelimiter: {
			type: String,
			default: function() {
				return '_';
			},
		},
		index: {
			type: Number,
			default: 0,
		},
		reservedNames: {
			type: Array,
			default: function() {
				return [];
			},
		},
		isNewField: {
			type: Boolean,
			default: false,
		},
		depth: {
			type: Number,
			default: -1,
		},
		path: {
			type: Array,
			default: function() {
				return [];
			},
		},
		isNestedRepeaterField: {
			type: Boolean,
			default: false,
		},
		hostCapabilities: {
			type: Object,
			default: function() {
				return JetEngineFieldsConfig.nested_repeater || {};
			},
		},
	},
	data() {
		return {
			field: {},
			glossariesList: JetEngineFieldsConfig.glossaries,
			queriesList: JetEngineFieldsConfig.queries,
			taxonomiesList: JetEngineFieldsConfig.taxonomies || [],
			allowedSources: JetEngineFieldsConfig.allowed_sources,
			sanitizeOptions: JetEngineFieldsConfig.sanitize_options || [],
			postTypes: JetEngineFieldsConfig.post_types,
			i18n: JetEngineFieldsConfig.i18n,
			quickEditSupports: JetEngineFieldsConfig.quick_edit_supports,
			iconsLibraries: JetEngineFieldsConfig.icons_libraries,
			fieldError: false,
			typeSelectRenderKey: 0,
		};
	},
	created() {
		this.field = { ...this.value };

		if ( ! this.field.object_type ) {
			this.$set( this.field, 'object_type', 'field' );
		}

		if ( ! Array.isArray( this.field['repeater-fields'] ) ) {
			this.$set( this.field, 'repeater-fields', [] );
		}

		if ( 'repeater' === this.field.type && ! this.isValidRepeaterLayout( this.field.repeater_layout ) ) {
			this.$set( this.field, 'repeater_layout', 'block' );
		}

		// Ensure options_source migrated correctly
		if ( ! this.field.options_source ) {
			if ( this.field.options_from_glossary ) {
				this.field.options_source = 'glossary';
			} else {
				this.field.options_source = 'manual';
			}
		}

		// Ensure options_source migrated correctly for repeater fields
		this.ensureRepeaterOptionsSource( this.field['repeater-fields'] );

	},
	computed: {
		repeaterFieldTypes: function() {
			var self      = this;
			var skipTypes = [ 'html' ];

			return this.fieldTypes.filter( function( field ) {

				if ( skipTypes.includes( field.value ) || field.skip_repeater ) {
					return false;
				}

				if ( 'repeater' === field.value ) {
					return self.canAddNestedRepeater();
				}

				return true;
			} );
		},
		nestedHideOptions: function() {
			var result = [ ...this.hideOptions, 'object_type', 'field_layout', 'width', 'quick_editable', 'revision_support', 'repeater_save_separate', 'show_in_rest' ];

			if ( 'table' === this.normalizedRepeaterLayout ) {
				result.push( 'repeater_collapsed', 'repeater_title_field' );
			}

			return [ ...new Set( result ) ];
		},
		normalizedRepeaterLayout: function() {
			return this.isValidRepeaterLayout( this.field.repeater_layout ) ? this.field.repeater_layout : 'block';
		},
		currentPath: function() {
			if ( this.path.length ) {
				return this.path;
			}

			return this.field.name ? [ this.field.name ] : [];
		},
		pathLabel: function() {
			return this.currentPath.filter( Boolean ).join( ' > ' );
		},
	},
	watch: {
		'field.type': function ( newType ) {
			this.resetQuickEditIfNotSupported( newType );
		}
	},
	methods: {
		isValidRepeaterLayout: function( layout ) {
			return [ 'block', 'table' ].includes( layout );
		},
		isRepeaterLayoutOptionVisible: function() {
			return 'repeater' === this.field.type && 'field' === this.field.object_type;
		},
		isRepeaterTableLayout: function() {
			return this.isRepeaterLayoutOptionVisible() && 'table' === this.normalizedRepeaterLayout;
		},
		isRepeaterBlockSettingsVisible: function() {
			if ( 'repeater' !== this.field.type || 'field' !== this.field.object_type ) {
				return false;
			}

			return 'table' !== this.normalizedRepeaterLayout;
		},
		ensureRepeaterOptionsSource: function( fields ) {
			if ( ! Array.isArray( fields ) ) {
				return;
			}

			for ( var i = 0; i < fields.length; i++ ) {
				if ( ! fields[ i ].object_type ) {
					this.$set( fields[ i ], 'object_type', 'field' );
				}

				if ( ! fields[ i ].options_source ) {
					if ( fields[ i ].options_from_glossary ) {
						this.$set( fields[ i ], 'options_source', 'glossary' );
					} else {
						this.$set( fields[ i ], 'options_source', 'manual' );
					}
				}

				if ( 'repeater' === fields[ i ].type ) {
					if ( ! Array.isArray( fields[ i ]['repeater-fields'] ) ) {
						this.$set( fields[ i ], 'repeater-fields', [] );
					}

					this.ensureRepeaterOptionsSource( fields[ i ]['repeater-fields'] );
				}
			}
		},
		canAddNestedRepeater: function() {
			const config = this.hostCapabilities || {};

			if ( ! config.enabled ) {
				return false;
			}

			const maxDepth = undefined !== config.max_public_depth ? parseInt( config.max_public_depth, 10 ) : 1;

			return this.depth < maxDepth;
		},
		childPath: function( childField ) {
			const path = [ ...this.currentPath ];

			if ( childField && childField.name ) {
				path.push( childField.name );
			}

			return path;
		},
		getFieldPathLabel: function( childField ) {
			return this.childPath( childField ).filter( Boolean ).join( ' > ' );
		},
		setFieldProp: function( key, value ) {
			this.$set( this.field, key, value );
			this.$emit( 'input', this.field );
		},
		getFilteredFieldConditions: function( conditions, fieldOption ) {

			return window.JetPlugins.hooks.applyFilters( 
				'jetEngine.metaFields.fieldConditions',
				conditions,
				fieldOption,
				this.field,
				this
			);
		},
		getFilteredObjectTypes: function( objectTypes ) {
			return window.JetPlugins.hooks.applyFilters( 
				'jetEngine.metaFields.allowedObjectTypes',
				objectTypes,
				this.field,
				this
			);
		},
		getFilteredFieldTypes: function( fieldTypes ) {
			if ( this.isNestedRepeaterField ) {
				fieldTypes = this.repeaterFieldTypes;
			}

			return window.JetPlugins.hooks.applyFilters(
				'jetEngine.metaFields.allowedFieldTypes',
				fieldTypes,
				this.field,
				this
			);
		},
		getSanitizeOptions: function( type ) {

			if ( 'number' !== type ) {
				return this.sanitizeOptions;
			}

			return this.sanitizeOptions.filter( function( option ) {
				return [ 'default', 'raw', 'absint', 'floatval' ].includes( option.value );
			} );
		},
		isSanitizeSupportedField: function( field ) {

			if ( ! field || 'field' !== ( field.object_type || 'field' ) ) {
				return false;
			}

			if ( [ 'repeater', 'media', 'gallery', 'html' ].includes( field.type ) ) {
				return false;
			}

			if ( 'checkbox' === field.type && field.is_array ) {
				return false;
			}

			return ! ( [ 'select', 'posts' ].includes( field.type ) && field.is_multiple );
		},
		preSetFieldName: function() {

			if ( ! this.field.name && this.field.title ) {
				this.sanitizeFieldName();
			}

		},
		sanitizeFieldName: function() {

			var names = this.fieldsNames;
			var regex = /\s+/g;
			var name  = this.field.name || this.field.title;
			
			name = name.toLowerCase().replace( regex, this.slugDelimiter );
			name = window.JetEngineTools.maybeCyrToLatin( name );
			names.splice( this.index, 1 );

			if ( -1 !== names.indexOf( name ) ) {
				name = name + '_' + Math.floor( Math.random() * Math.floor( 999 ) );
			}

			if ( this.reservedNames 
				&& this.reservedNames.length
				&& this.reservedNames.includes( name )
			) {
				
				this.fieldError = true;
				this.$CXNotice.add( {
					message: `'${name}' is reserved for internal use. Please rename this field`,
					type: 'error',
					duration: 8000,
				} );

				return;
			}

			this.$set( this.field, 'name', name );

		},
		preSetRepeaterFieldName: function( repeaterFieldIndex ) {

			var repeaterField = this.field['repeater-fields'][ repeaterFieldIndex ];

			if ( ! repeaterField.name && repeaterField.title ) {
				repeaterField.name = repeaterField.title;
				this.field['repeater-fields'].splice( repeaterFieldIndex, 1, repeaterField );
				this.sanitizeRepeaterFieldName( repeaterFieldIndex );
			}

		},
		sanitizeRepeaterFieldName: function( repeaterFieldIndex ) {

			var repeaterField  = this.field['repeater-fields'][ repeaterFieldIndex ],
				needModifyName = false;

			var regex = /\s+/g;
			repeaterField.name = repeaterField.name.toLowerCase().replace( regex, this.slugDelimiter );
			repeaterField.name = window.JetEngineTools.maybeCyrToLatin( repeaterField.name );

			for ( var i = 0; i < this.field['repeater-fields'].length; i++ ) {

				if ( i === repeaterFieldIndex ) {
					continue;
				}

				if ( this.field['repeater-fields'][i].name === repeaterField.name ) {
					needModifyName = true;
					break;
				}
			}

			if ( needModifyName ) {
				repeaterField.name = repeaterField.name + '_' + Math.floor( Math.random() * Math.floor( 999 ) );
			}

			this.field['repeater-fields'].splice( repeaterFieldIndex, 1, repeaterField );
			this.$emit( 'input', this.field );

		},
		setRepeaterFieldProp: function( repeaterFieldIndex, key, value ) {

			var repeaterField = this.field['repeater-fields'][ repeaterFieldIndex ];

			repeaterField[ key ] = value;

			this.field['repeater-fields'].splice( repeaterFieldIndex, 1, repeaterField );
			this.$emit( 'input', this.field );

		},

		cloneRepeaterField: function( childIndex ) {

			var newField = { ...this.field['repeater-fields'][ childIndex ] };

			newField.title = newField.title + ' (Copy)';
			newField.name  = this.getUniqueFieldName( newField.name + '_copy', this.field['repeater-fields'] );
			newField.id    = this.getRandomID();

			this.field['repeater-fields'].splice( childIndex + 1, 0, newField );
			this.$emit( 'input', this.field );

		},
		deleteRepeaterField: function( childIndex ) {

			// Maybe clear a `Title Field` value.
			this.maybeClearRepeaterTitleField( childIndex );

			// Remove conditions dependency
			this.deleteRepeaterConditionsDependency( this.field['repeater-fields'][ childIndex ].name );

			this.field['repeater-fields'].splice( childIndex, 1 );
			this.$emit( 'input', this.field );
		},
		addNewRepeaterField: function( $event ) {

			var rField = {
				title: '',
				name: '',
				type: 'text',
				options_source: 'manual',
				collapsed: false,
				id: this.getRandomID(),
			};

			if ( this.showSanitize ) {
				rField.sanitize = 'default';
			}

			if ( ! this.field['repeater-fields'] ) {
				this.field['repeater-fields'] = [];
			}

			this.field['repeater-fields'].push( rField );
			this.$emit( 'input', this.field )

		},

		addNewRepeaterFieldOption: function( $event, rIndex, index ) {
			var option = {
				key: '',
				value: '',
				collapsed: false,
				id: this.getRandomID(),
			};

			if ( ! this.fieldsList[ index ]['repeater-fields'][ rIndex ].options ) {
				this.$set( this.fieldsList[ index ]['repeater-fields'][ rIndex ], 'options', [] );
			}

			this.fieldsList[ index ]['repeater-fields'][ rIndex ].options.push( option );
			//this.onInput();
		},
		cloneRepeaterFieldOption: function( optionIndex, rFieldIndex ) {
			var field     = this.fieldsList[ fieldIndex ]['repeater-fields'][ rFieldIndex ],
				option    = field.options[ optionIndex ],
				newOption = {
					key: option.key + '_copy',
					value: option.value + '(Copy)',
					id: this.getRandomID(),
				};

			field.options.splice( optionIndex + 1, 0, newOption );

			this.fieldsList[ fieldIndex ]['repeater-fields'].splice( rFieldIndex, 1, field );
			//this.onInput();
		},
		deleteRepeaterFieldOption: function( optionIndex, rFieldIndex, fieldIndex ) {
			this.fieldsList[ fieldIndex ]['repeater-fields'][ rFieldIndex ].options.splice( optionIndex, 1 );
		},
		setRepeaterFieldOptionProp: function( fieldIndex, rFieldIndex, optionIndex, key, value ) {
			var field  = this.fieldsList[ fieldIndex ]['repeater-fields'][ rFieldIndex ],
				option = field.options[ optionIndex ];

			if ( 'is_checked' === key && ( 'radio' === field.type || ( 'select' === field.type && ! field.is_multiple ) ) ) {
				for ( var i = 0; i < field.options.length; i++ ) {
					if ( field.options[ i ].is_checked ) {
						field.options[ i ].is_checked = false;
					}
				}
			}

			option[ key ] = value;

			field.options.splice( optionIndex, 1, option );

			this.fieldsList[ fieldIndex ]['repeater-fields'].splice( rFieldIndex, 1, field );
			//this.onInput();
		},

		getRepeaterTitleFields: function() {
			var allowedTypes = [ 'text', 'textarea', 'radio', 'select', 'posts' ],
				titleFieldsList = [],
				repeaterFields;

			if ( 'field' !== this.field.object_type || 'repeater' !== this.field.type ) {
				return titleFieldsList;
			}

			titleFieldsList.push( {
				value: '',
				label: this.i18n.select_field,
			} );

			if ( undefined === this.field['repeater-fields'] ) {
				return titleFieldsList;
			}

			repeaterFields = this.field['repeater-fields'];

			if ( ! repeaterFields.length ) {
				return titleFieldsList;
			}

			for ( var i = 0; i < repeaterFields.length; i++ ) {

				if ( -1 === allowedTypes.indexOf( repeaterFields[i].type ) ) {
					continue;
				}

				titleFieldsList.push( {
					value: repeaterFields[i].name,
					label: repeaterFields[i].title,
				} );

			}

			return titleFieldsList;

		},
		maybeClearRepeaterTitleField: function( childIndex ) {
			if ( this.field.repeater_title_field === this.field['repeater-fields'][ childIndex ].name ) {
				this.field.repeater_title_field = '';
			}
		},
		deleteRepeaterConditionsDependency: function( fieldName ) {
			for ( var i = 0; i < this.field['repeater-fields'].length; i++ ) {

				if ( undefined === this.field['repeater-fields'][i].conditions ) {
					continue;
				}

				if ( ! this.field['repeater-fields'][i].conditions.length ) {
					continue;
				}

				for ( var j = 0; j < this.field['repeater-fields'][i].conditions.length; j++ ) {

					if ( fieldName !== this.field['repeater-fields'][i].conditions[j].field ) {
						continue;
					}

					this.field['repeater-fields'][i].conditions.splice( j, 1 );
				}
			}
		},
		showCondition: function( field ) {

			var result     = true,
				objectType = field.object_type ? field.object_type : 'field';

			if ( -1 !== this.disabledFields.indexOf( 'conditional_logic' ) ) {
				result = false;
			} else if ( 'endpoint' === objectType ) {
				result = false;
			} else if ( 'field' === objectType && 'html' === field.type ) {
				result = false;
			}

			return window.JetPlugins.hooks.applyFilters(
				'jetEngine.metaFields.showConditionsEditor',
				result,
				field
			);
		},
		showConditionPopup: function() {
			this.$emit( 'show-condition-popup' );
		},
		showRepeaterConditionPopup: function( rFieldIndex ) {
			this.$emit( 'show-repeater-condition-popup', rFieldIndex );
		},
		hasConditions: function( object ) {
			return object.conditional_logic && object.conditions && object.conditions.length;
		},
		getRepeaterFields: function( repeater ) {
			let fields = [];

			if ( ! Array.isArray( repeater?.['repeater-fields'] ) ) {
				return fields;
			}

			for ( const field of repeater['repeater-fields'] ) {
				fields.push( field.name );
			}

			return fields;
		},
		repeaterFieldConditionsInvalid( object, repeater ) {
			if ( ! this.hasConditions( object ) ) {
				return false;
			}

			if ( ! Array.isArray( object?.conditions ) ) {
				return false;
			}

			const rFields = this.getRepeaterFields( repeater );

			for ( const condition of object.conditions ) {
				if ( ! rFields.includes( condition.field ) || condition.field === object.name ) {
					return true;
				}
			}
			
			return false;
		},
		getRandomID: function() {
			return Math.floor( Math.random() * 8999 ) + 1000;
		},
		getUniqueFieldName: function( name, fields ) {
			var usedNames = {};
			var baseName  = name || 'field';
			var nextName  = baseName;
			var suffix    = 1;

			if ( ! Array.isArray( fields ) ) {
				return nextName;
			}

			for ( var i = 0; i < fields.length; i++ ) {
				if ( fields[ i ].name ) {
					usedNames[ fields[ i ].name ] = true;
				}
			}

			while ( usedNames[ nextName ] ) {
				nextName = baseName + '_' + suffix;
				suffix++;
			}

			return nextName;
		},
		isCollapsed: function( object ) {
			if ( undefined === object.collapsed || true === object.collapsed ) {
				return true;
			} else {
				return false;
			}
		},
		getCommonFieldProps: function() {
			return [
				'id',
				'title',
				'name',
				'object_type',
				'type',
				'width',
				'conditional_logic',
				'conditional_relation',
				'conditions',
			];
		},
		getOptionFieldProps: function() {
			return [
				'options_source',
				'options',
				'glossary_id',
				'query_id',
				'query_value_field',
				'query_label_field',
				'taxonomy',
				'return_value',
				'terms_orderby',
				'terms_order',
				'bulk_options',
			];
		},
		isOptionFieldType: function( type ) {
			return [ 'select', 'radio', 'checkbox' ].includes( type );
		},
		getAllowedFieldPropsForSwitch: function( newType, oldType ) {
			let allowed = [ ...this.getCommonFieldProps() ];

			if ( this.isOptionFieldType( newType ) && this.isOptionFieldType( oldType ) ) {
				allowed = [ ...allowed, ...this.getOptionFieldProps() ];
			}

			return allowed;
		},
		getDefaultFieldPropsByType: function( type ) {
			let defaults = {
				type: type,
				options: [],
			};

			if ( this.isOptionFieldType( type ) ) {
				defaults.options_source = 'manual';
			}

			if ( 'repeater' === type ) {
				defaults['repeater-fields'] = [];
				defaults.repeater_layout = 'block';
			}

			defaults = window.JetPlugins.hooks.applyFilters(
				'jetEngine.metaFields.defaultFieldProps',
				defaults,
				type
			);

			return defaults;
		},
		resetFieldSettingsOnTypeSwitch: function( newType, oldType ) {
			let allowedKeys   = this.getAllowedFieldPropsForSwitch( newType, oldType );
			let defaultValues = this.getDefaultFieldPropsByType( newType );
			let nextField     = {};
			let i, key;

			for ( i = 0; i < allowedKeys.length; i++ ) {
				key = allowedKeys[ i ];

				if ( undefined !== this.field[ key ] ) {
					nextField[ key ] = this.field[ key ];
				}
			}

			nextField = {
				...defaultValues,
				...nextField,
				type: newType,
			};

			if ( this.isOptionFieldType( newType ) && ! nextField.options_source ) {
				nextField.options_source = 'manual';
			}

			this.field = nextField;
			this.$emit( 'input', this.field );
		},
		handleFieldTypeChange: function( newType ) {
			const oldType = this.field.type;

			if ( newType === oldType ) {
				return;
			}

			if ( ! this.isNewField ) {
				let message = this.i18n.switch_type_confirm;

				if ( 'repeater' === oldType && 'repeater' !== newType && this.field['repeater-fields'] && this.field['repeater-fields'].length ) {
					message = this.i18n.nested_repeater_child_warning || message;
				}

				const confirmed = window.confirm( message );

				if ( ! confirmed ) {
					this.typeSelectRenderKey++;
					return;
				}
			}

			this.resetFieldSettingsOnTypeSwitch( newType, oldType );
		},
		resetQuickEditIfNotSupported( type ) {
			if ( ! this.field || ! this.field.quick_editable ) {
				return;
			}

			if ( ! Array.isArray( this.quickEditSupports ) ) {
				return;
			}

			if ( this.quickEditSupports.indexOf( type ) === -1 ) {
				this.$set( this.field, 'quick_editable', false );
				this.$emit( 'input', this.field );
			}
		},
	}
} );

Vue.component( 'jet-meta-fields', {
	name: 'jet-meta-fields',
	template: '#jet-meta-fields',
	props: {
		value: {
			type: Array,
			default: function() {
				return [];
			},
		},
		hideOptions: {
			type: Array,
			default: function() {
				return [];
			},
		},
		showSanitize: {
			type: Boolean,
			default: false,
		},
		slugDelimiter: {
			type: String,
			default: function() {
				return '_';
			},
		},
		reservedNames: {
			type: Array,
			default: function() {
				return [];
			},
		},
		fieldValidationCallback: {
			type: Function,
			default: null,
		},
		isRecursive: {
			type: Boolean,
			default: false,
		},
		depth: {
			type: Number,
			default: -1,
		},
		path: {
			type: Array,
			default: function() {
				return [];
			},
		},
		parentField: {
			type: Object,
			default: function() {
				return null;
			},
		},
		hostCapabilities: {
			type: Object,
			default: function() {
				return JetEngineFieldsConfig.nested_repeater || {};
			},
		},
	},
	data: function() {
		return {
			fieldsList: this.value,
			newFieldIds: [],
			fieldTypes: JetEngineFieldsConfig.field_types,
			allowedFieldTypes: JetEngineFieldsConfig.allowed_types,
			postTypes: JetEngineFieldsConfig.post_types,
			blockTitle: JetEngineFieldsConfig.title,
			buttonLabel: JetEngineFieldsConfig.button,
			disabledFields: JetEngineFieldsConfig.disabled,
			i18n: JetEngineFieldsConfig.i18n,

			currentConditionIndex: null,
			currentConditionField: null,
			isVisibleConditionPopup: false,
		};
	},
	created: function() {

		if ( this.allowedFieldTypes ) {

			const fields = this.fieldTypes.filter( ( item ) => {
				return this.allowedFieldTypes.includes( item.value );
			} );

			this.fieldTypes = fields;

		}

	},
	mounted() {
		if ( this.isRoot ) {
			window.JetEngineMetaFieldsValidation.register( this );
		}

		window.addEventListener( 'jet-engine/post-types/saved', this.onPostTypeSaved );
	},
	watch: {
		value: function( val ) {
			var openedTab = false;

			if ( ! this.isRecursive ) {
				for ( var i = 0; i < val.length; i++ ) {
					switch ( val[i].object_type ) {
						case 'field':
							val[i].isNested = openedTab;
							break;

						case 'tab':
						case 'accordion':
							openedTab = true;
							val[i].isNested = false;
							break;

						case 'endpoint':
							openedTab = false;
							val[i].isNested = false;
							break;
					}
				}
			}

			this.fieldsList = val;
		},
		fieldsList: {
			handler: function( val ) {
				this.$emit( 'input', val );
			},
			deep: true,
		},
	},
	computed: {
		isRoot: function() {
			return ! this.isRecursive;
		},
		pathLabel: function() {
			return this.path.filter( Boolean ).join( ' > ' );
		},
		effectiveHideOptions: function() {
			if ( ! this.isRecursive ) {
				return this.hideOptions;
			}

			var result = [ ...this.hideOptions, 'object_type', 'field_layout', 'width', 'quick_editable', 'revision_support', 'repeater_save_separate', 'show_in_rest' ];

			return [ ...new Set( result ) ];
		},
		fieldsNames: function() {
			var result = [];

			for ( var i = 0; i < this.fieldsList.length; i++ ) {
				result.push( this.fieldsList[i].name );
			}

			return result;
		},
	},
	methods: {
		fieldIsValid: function( field, returnType ) {

			returnType = returnType || 'bool';

			if ( this.fieldValidationCallback && ! this.isRecursive ) {
				try {
					this.fieldValidationCallback( field );
				} catch( e ) {
					if ( 'error' === returnType ) {
						return e;
					} else {
						return false;
					}
				}

			}

			const validationError = this.getFieldValidationError( field );

			if ( validationError ) {
				if ( 'error' === returnType ) {
					return validationError;
				}

				return false;
			}

			return true;

		},
		onInput: function() {
			this.$emit( 'input', this.fieldsList );
		},
		isFieldCollapsed: function( fieldID ) {
			if ( ! this.$refs[ 'field' + fieldID ] ) {
				return false;
			} else {
				return this.$refs[ 'field' + fieldID ][0].isCollapsed;
			}
		},
		getFieldSubtitle: function( field ) {

			var result = field.name + ' (';

			if ( 'field' === field.object_type ) {
				result += field.type;
			} else {
				result += field.object_type;
			}

			result += ')';

			return result;

		},
		addNewField: function( event ) {

			var field = {
				title: '',
				name: '',
				object_type: 'field',
				width: '100%',
				options: [],
				'repeater-fields': [],
				type: 'text',
				collapsed: false,
				id: this.getRandomID(),
			};

			if ( this.showSanitize ) {
				field.sanitize = 'default';
			}

			this.fieldsList.push( field );
			this.newFieldIds.push( field.id );

		},
		
		cloneField: function( index ) {

			var newField = JSON.parse( JSON.stringify( this.fieldsList[index] ) );

			newField.title = newField.title + ' (Copy)';
			newField.name  = this.getUniqueFieldName( newField.name + '_copy', this.fieldsList );
			this.refreshFieldTreeIds( newField );

			this.fieldsList.splice( index + 1, 0, newField );

		},
		deleteField: function( index ) {

			// Remove conditions dependency
			this.deleteConditionsDependency( this.fieldsList[index].name );
			this.maybeClearParentTitleField( this.fieldsList[index].name );

			this.fieldsList.splice( index, 1 );
		},

		showCondition: function( field ) {

			var result = true;

			if ( -1 !== this.disabledFields.indexOf( 'conditional_logic' ) ) {
				result = false;
			} else if ( 'endpoint' === field.object_type ) {
				result = false;
			} else if ( 'field' === field.object_type && 'html' === field.type ) {
				result = false;
			}

			return window.JetPlugins.hooks.applyFilters(
				'jetEngine.metaFields.showConditionsEditor',
				result,
				field
			);
		},
		showConditionPopup: function( fieldIndex ) {
			this.currentConditionIndex = fieldIndex;
			this.currentConditionField = this.fieldsList[ fieldIndex ];
			this.isVisibleConditionPopup = true;
		},
		hideConditionPopup: function() {
			this.currentConditionIndex = null;
			this.currentConditionField = null;
			this.isVisibleConditionPopup = false;
		},
		hasConditions: function( object ) {
			return object.conditional_logic && object.conditions && object.conditions.length;
		},
		conditionsInvalid( object ) {
			if ( ! this.hasConditions( object ) ) {
				return false;
			}
			
			if ( ! Array.isArray( object?.conditions ) ) {
				return false;
			}

			for ( const condition of object.conditions ) {
				if ( ! this.fieldsNames.includes( condition.field ) || condition.field === object.name ) {
					return true;
				}
			}
			
			return false;
		},
		setConditionsFieldProps: function( fieldIndex, rFieldIndex, valueObj ) {

			var field = this.fieldsList[ fieldIndex ];

			field.conditional_logic    = valueObj.isEnabled;
			field.conditions           = valueObj.conditions;
			field.conditional_relation = valueObj.relation;

			this.fieldsList.splice( fieldIndex, 1, field );
		},

		deleteConditionsDependency: function( fieldName ) {
			for ( var i = 0; i < this.fieldsList.length; i++ ) {

				if ( 'field' !== this.fieldsList[i].object_type ) {
					continue;
				}

				if ( undefined === this.fieldsList[i].conditions ) {
					continue;
				}

				if ( !this.fieldsList[i].conditions.length ) {
					continue;
				}

				for ( var j = 0; j < this.fieldsList[i].conditions.length; j++ ) {

					if ( fieldName !== this.fieldsList[i].conditions[j].field ) {
						continue;
					}

					this.fieldsList[i].conditions.splice( j, 1 );
				}
			}
		},

		isCollapsed: function( object ) {
			if ( undefined === object.collapsed || true === object.collapsed ) {
				return true;
			} else {
				return false;
			}
		},

		isNestedField: function( field ) {
			if ( undefined !== field.isNested && field.isNested ) {
				return true;
			}

			return false;
		},

		childPath: function( field ) {
			const path = [ ...this.path ];

			if ( field && field.name ) {
				path.push( field.name );
			}

			return path;
		},

		childPathLabel: function( field ) {
			return this.childPath( field ).filter( Boolean ).join( ' > ' );
		},

		maybeClearParentTitleField: function( fieldName ) {
			if ( this.parentField && this.parentField.repeater_title_field === fieldName ) {
				this.$set( this.parentField, 'repeater_title_field', '' );
			}
		},

		refreshFieldTreeIds: function( field ) {
			field.id = this.getRandomID();

			if ( Array.isArray( field['repeater-fields'] ) ) {
				for ( var i = 0; i < field['repeater-fields'].length; i++ ) {
					this.refreshFieldTreeIds( field['repeater-fields'][ i ] );
				}
			}
		},

		getDuplicateSiblingNames: function() {
			const names      = {};
			const duplicates = [];

			for ( const field of this.fieldsList ) {
				if ( ! field.name ) {
					continue;
				}

				if ( names[ field.name ] && ! duplicates.includes( field.name ) ) {
					duplicates.push( field.name );
				}

				names[ field.name ] = true;
			}

			return duplicates;
		},

		getAllowedRepeaterTypes: function( depth ) {
			const config       = this.hostCapabilities || {};
			const maxDepth     = undefined !== config.max_public_depth ? parseInt( config.max_public_depth, 10 ) : 1;
			const allowedTypes = this.fieldTypes.filter( function( fieldType ) {
				return 'html' !== fieldType.value && ! fieldType.skip_repeater;
			} ).map( function( fieldType ) {
				return fieldType.value;
			} );

			if ( ! config.enabled || depth >= maxDepth ) {
				return allowedTypes.filter( function( type ) {
					return 'repeater' !== type;
				} );
			}

			return allowedTypes;
		},

		getFieldValidationError: function( field ) {
			if ( this.getDuplicateSiblingNames().includes( field.name ) ) {
				return this.i18n.nested_repeater_duplicate_error;
			}

			if ( this.isRecursive && this.isFieldTypeUnsupportedAtDepth( field, this.depth ) ) {
				if ( 'repeater' === field.type ) {
					return this.i18n.nested_repeater_depth_error;
				}

				return this.i18n.nested_repeater_type_error;
			}

			if ( this.conditionsInvalid( field ) ) {
				return 'Invalid conditional logic reference';
			}

			return false;
		},

		isFieldTypeUnsupportedAtDepth: function( field, depth ) {
			if ( -1 === depth ) {
				return false;
			}

			return ! this.getAllowedRepeaterTypes( depth ).includes( field.type );
		},

		fieldConditionsInvalidInList: function( field, fields ) {
			if ( ! this.hasConditions( field ) || ! Array.isArray( field.conditions ) ) {
				return false;
			}

			const names = fields.map( function( item ) {
				return item.name;
			} );

			for ( const condition of field.conditions ) {
				if ( ! names.includes( condition.field ) || condition.field === field.name ) {
					return true;
				}
			}

			return false;
		},

		fieldTreeHasErrors: function( fields, depth ) {
			const siblingNames = {};

			for ( const field of fields ) {
				if ( field.name ) {
					if ( siblingNames[ field.name ] ) {
						return true;
					}

					siblingNames[ field.name ] = true;
				}

				if ( this.isFieldTypeUnsupportedAtDepth( field, depth ) ) {
					return true;
				}

				if ( this.fieldConditionsInvalidInList( field, fields ) ) {
					return true;
				}

				if ( Array.isArray( field['repeater-fields'] ) && this.fieldTreeHasErrors( field['repeater-fields'], depth + 1 ) ) {
					return true;
				}
			}

			return false;
		},

		fieldHasDescendantErrors: function( field ) {
			if ( ! Array.isArray( field['repeater-fields'] ) || ! field['repeater-fields'].length ) {
				return false;
			}

			return this.fieldTreeHasErrors( field['repeater-fields'], this.isRecursive ? this.depth + 1 : 0 );
		},

		hasHardValidationErrors: function() {
			return this.fieldTreeHasErrors( this.fieldsList, -1 );
		},

		collectValidationErrors: function() {
			const errors = [];

			this.collectFieldTreeErrors( this.fieldsList, -1, [], errors );

			return errors;
		},

		collectFieldTreeErrors: function( fields, depth, path, errors ) {
			const names = {};

			for ( const field of fields ) {
				const fieldPath = [ ...path ];

				if ( field.name ) {
					fieldPath.push( field.name );
				}

				if ( field.name && names[ field.name ] ) {
					errors.push( this.i18n.nested_repeater_duplicate_error + ' ' + fieldPath.join( ' > ' ) );
				}

				names[ field.name ] = true;

				if ( this.isFieldTypeUnsupportedAtDepth( field, depth ) ) {
					errors.push( ( 'repeater' === field.type ? this.i18n.nested_repeater_depth_error : this.i18n.nested_repeater_type_error ) + ' ' + fieldPath.join( ' > ' ) );
				}

				if ( this.fieldConditionsInvalidInList( field, fields ) ) {
					errors.push( 'Invalid conditional logic reference ' + fieldPath.join( ' > ' ) );
				}

				if ( Array.isArray( field['repeater-fields'] ) ) {
					this.collectFieldTreeErrors( field['repeater-fields'], depth + 1, fieldPath, errors );
				}
			}
		},

		getRandomID: function() {
			return Math.floor( Math.random() * 8999 ) + 1000;
		},
		getUniqueFieldName: function( name, fields ) {
			var usedNames = {};
			var baseName  = name || 'field';
			var nextName  = baseName;
			var suffix    = 1;

			if ( ! Array.isArray( fields ) ) {
				return nextName;
			}

			for ( var i = 0; i < fields.length; i++ ) {
				if ( fields[ i ].name ) {
					usedNames[ fields[ i ].name ] = true;
				}
			}

			while ( usedNames[ nextName ] ) {
				nextName = baseName + '_' + suffix;
				suffix++;
			}

			return nextName;
		},
		isNewField: function( fieldId ) {
			return this.newFieldIds.includes( fieldId );
		},
		onPostTypeSaved: function() {
			this.newFieldIds = [];
		},
	},
	beforeDestroy() {
		if ( this.isRoot ) {
			window.JetEngineMetaFieldsValidation.unregister( this );
		}

		window.removeEventListener(
			'jet-engine/post-types/saved',
			this.onPostTypeSaved
		);
	},
} );

window.JetPlugins.hooks.addFilter( 
	'jetEngine.metaFields.fieldConditions', 
	'jetWCFields', 
	( conditions, fieldName, field, fields ) => {
		return conditions;
	}
);
