# Live WordPress inventory and source provenance

Checked on 2026-10-26 against the authenticated WordPress admin for `https://bdsmarvel.com`.

| Active component | Live version | Repository snapshot |
| --- | ---: | --- |
| BDS Marvel theme | 2.0.2 | `themes/bds-marvel-theme-2.0.2/` |
| BDS Marvel App | 3.4.5 | `plugins/bds-marvel-app-3.4.5/` |
| BDS Marvel Accessibility and Script Delivery Fixes | 1.8.0 | `plugins/bds-marvel-accessibility-fixes/` |
| BDS Marvel Hero Performance Fix | 1.1.0 | `plugins/bds-marvel-hero-performance/` |
| BDS Marvel Inline Homepage Custom CSS | 1.1.0 | `plugins/bds-marvel-inline-custom-css/` |
| BDS Marvel Mobile Image Delivery | 1.0.0 | `plugins/bds-mobile-image-delivery/` |
| BDS Marvel Performance & Accessibility Fixes | 1.7.2 | `plugins/bds-site-performance-patch-restored/` |

The app PHP/admin files, theme files, and each active custom plugin's main PHP file were retrieved from the live editor. App build manifest and text-based frontend assets were also retrieved from the live editor. The live theme files match the BMM theme snapshot; the app's main JS differs from BMM's 3.4.3 build, which is why the live bundle set is stored here.

The app's `includes/content-defaults.json`, `includes/stays.json`, client-image files, and static map images came from the BMM package and were not compared byte-for-byte against the live filesystem. These are content/media assets rather than the PHP implementation; do not treat those individual files as an exact live copy. WordPress's active plugins showed no available updates at inspection time.

This repository snapshot records source; it does not deploy changes to WordPress.com. WordPress settings, payment credentials, user data, and booking records are deliberately excluded.
