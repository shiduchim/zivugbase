#!/usr/bin/env bash
# Builds and signs the add-on APK into the folder given as $1. Used by CI.
# The signing key is in this public repository on purpose, so every build can update the
# installed add-on; it proves nothing about who built the file. Only install the add-on
# from the ZivugBase site.
set -euo pipefail
OUT="$1"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
BT="$SDK/build-tools/35.0.0"
gradle -p android :app:assembleFullRelease :app:assembleLiteRelease --no-daemon
mkdir -p "$OUT"
for kind in full lite; do
  name="ZivugBase-addon"; [ "$kind" = lite ] && name="ZivugBase-addon-lite"
  "$BT/zipalign" -p -f 4 "android/app/build/outputs/apk/$kind/release/app-$kind-release-unsigned.apk" "/tmp/addon-$kind.apk"
  "$BT/apksigner" sign --ks android/zivugbase-addon.jks --ks-key-alias addon \
    --ks-pass pass:zivugbase-addon --key-pass pass:zivugbase-addon \
    --out "$OUT/$name.apk" "/tmp/addon-$kind.apk"
  "$BT/apksigner" verify "$OUT/$name.apk"
done
ls -la "$OUT"
