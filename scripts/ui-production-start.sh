#!/bin/sh
set -eu

# Only these public settings enter website files. No private environment-file
# loader is needed by the standalone website image.
TARGET_DIR="${MARTY_WEBSITE_HTML_ROOT:-/usr/share/nginx/html}"
case "$TARGET_DIR" in /*) ;; *) echo 'Website HTML root must be absolute' >&2; exit 1 ;; esac
if [ "$TARGET_DIR" = / ] || [ ! -d "$TARGET_DIR" ] || [ -L "$TARGET_DIR" ] \
    || [ "$TARGET_DIR" != "$(cd "$TARGET_DIR" && pwd -P)" ]; then
    echo 'Website HTML root must be a real directory without symlinks' >&2; exit 1
fi
RUNTIME_CONFIG_PATH="${TARGET_DIR}/_website/runtime-config.js"
if [ "${MARTY_UI_RUNTIME_CONFIG_PATH:-$RUNTIME_CONFIG_PATH}" != "$RUNTIME_CONFIG_PATH" ]; then
    echo 'Website runtime configuration must use /_website/runtime-config.js' >&2; exit 1
fi
if [ -L "${TARGET_DIR}/_website" ] || [ -L "$RUNTIME_CONFIG_PATH" ]; then
    echo 'Website runtime configuration must not follow symlinks' >&2; exit 1
fi
if { [ -e "${TARGET_DIR}/_website" ] && [ ! -d "${TARGET_DIR}/_website" ]; } \
    || { [ -e "$RUNTIME_CONFIG_PATH" ] && [ ! -f "$RUNTIME_CONFIG_PATH" ]; }; then
    echo 'Website runtime target must be a regular file in its resource directory' >&2; exit 1
fi
ga_measurement_id="${GOOGLE_ANALYTICS_MEASUREMENT_ID:-}"
site_verification="${GOOGLE_SITE_VERIFICATION:-}"
organization_creation_enabled="${ORGANIZATION_CREATION_ENABLED-false}"
case "$organization_creation_enabled" in
    true|false) ;;
    *) echo 'ORGANIZATION_CREATION_ENABLED must be true or false' >&2; exit 1 ;;
esac
case "$ga_measurement_id$site_verification" in
    *'
'*) echo 'Public website settings must be single-line values' >&2; exit 1 ;;
esac
if printf '%s' "$ga_measurement_id$site_verification" | LC_ALL=C grep -q '[[:cntrl:]]'; then
    echo 'Public website settings must not contain control characters' >&2; exit 1
fi
if [ "${#ga_measurement_id}" -gt 64 ] || { [ -n "$ga_measurement_id" ] \
    && ! printf '%s' "$ga_measurement_id" | LC_ALL=C grep -Eq '^G-[A-Z0-9]+$'; }; then
    echo 'GOOGLE_ANALYTICS_MEASUREMENT_ID must be a GA4 measurement identifier' >&2; exit 1
fi
if [ "${#site_verification}" -gt 2048 ]; then
    echo 'GOOGLE_SITE_VERIFICATION is too long' >&2; exit 1
fi

escape_html_attr() {
    printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/"/\&quot;/g' -e "s/'/\&#39;/g" \
        -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}
verification_meta=""
if [ -n "$site_verification" ]; then
    verification_meta="<meta name=\"google-site-verification\" content=\"$(escape_html_attr "$site_verification")\" />"
fi
verification_replacement="$(printf '%s' "$verification_meta" | sed -e 's/[\\&~]/\\&/g')"
export verification_replacement

mkdir -p "${TARGET_DIR}/_website"
runtime_temporary="$(mktemp "${RUNTIME_CONFIG_PATH}.XXXXXX")"
trap 'if [ -n "$runtime_temporary" ]; then rm -f "$runtime_temporary"; fi' EXIT HUP INT TERM
cat > "$runtime_temporary" <<EOF
window.__MARTY_RUNTIME_CONFIG__ = Object.assign({}, window.__MARTY_RUNTIME_CONFIG__, {
  googleAnalyticsMeasurementId: '${ga_measurement_id}',
  organizationCreationEnabled: ${organization_creation_enabled}
});
EOF
chmod 644 "$runtime_temporary"
mv "$runtime_temporary" "$RUNTIME_CONFIG_PATH"
runtime_temporary=""

# Generated prerendered heads use single-line meta tags. Match both quote and
# HTML tag casing variants; reset stale verification data on every startup.
# find -exec preserves spaces and newlines in filenames without following links.
find "$TARGET_DIR" -type f -name '*.html' -exec sh -c '
    set -eu
    temporary=""
    trap '\''if [ -n "$temporary" ]; then rm -f "$temporary"; fi'\'' EXIT HUP INT TERM
    for html do
        temporary="$(mktemp "${html}.runtime.XXXXXX")"
        remove_meta="<[Mm][Ee][Tt][Aa]([[:space:]][^>]*)?[[:space:]][Nn][Aa][Mm][Ee][[:space:]]*=[[:space:]]*(\"google-site-verification\"|'\''google-site-verification'\''|google-site-verification)([[:space:]][^>]*)?[[:space:]]*/?>"
        sed -E "s~${remove_meta}~~g; s~</[Hh][Ee][Aa][Dd][[:space:]]*>~${verification_replacement}</head>~g" "$html" > "$temporary"
        chmod 644 "$temporary"
        mv "$temporary" "$html"
        temporary=""
    done
' sh {} +
