( function( $ ) {
    document.addEventListener(
        'DOMContentLoaded',
        initLinksHandler
    );

    document.addEventListener(
        'jet-smart-filters/inited',
        jsfInit
    );

    document.addEventListener(
        'jet-smart-filters/before-init',
        beforeJsfInit
    );

    function beforeJsfInit() {
        for ( const filter of document.querySelectorAll( '[data-content-provider][data-apply-type]:is([data-apply-type="reload"], [data-apply-type="mixed"])' ) ) {
            filter.setAttribute( 'data-apply-type', 'ajax' );
            
            if ( filter.dataset?.applyOn === 'submit' ) {
                filter.setAttribute( 'data-apply-on', 'value' );
            }
        }
    }

    function jsfInit() {
        //disable aliases just in case
        if ( JetSmartFilterSettings?.plugin_settings?.use_url_aliases ) {
            JetSmartFilterSettings.plugin_settings.use_url_aliases = false;
        }
    }

    function initLinksHandler() {
        const preventMode = JetEngineAdminPageConfig.link_clicks || 'prevent';

        switch ( preventMode ) {
            case 'prevent':
                document.addEventListener(
                    'click',
                    preventLinkOpen
                );
                break;
            case 'new_window':
                setTarget();

                $( document )
                    .on( 'jet-filter-content-rendered', setTarget )
                    .on( 'jet-engine/listing-grid/after-load-more', setTarget )
                    .on( 'jet-engine/listing-grid/after-lazy-load', setTarget );
                break;
        }
    }

    function preventLinkOpen( e ) {
        if ( e.target?.tagName === 'A' || e.target.closest( 'a' ) ) {
            e.preventDefault();
        }
    }

    function setTarget() {
        document.querySelectorAll('a:not([target="_blank"])').forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });
    }
} )( jQuery )
