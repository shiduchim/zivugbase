#!/usr/bin/env bash
# Uses the Android SDK already installed on GitHub's runners and adds what the build needs.
set -euo pipefail
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
SDKM="$(ls -d "$SDK"/cmdline-tools/*/bin/sdkmanager | sort -V | tail -1)"
yes | "$SDKM" --licenses >/dev/null || true
"$SDKM" "platforms;android-35" "build-tools;35.0.0"
echo "ANDROID_HOME=$SDK" >> "${GITHUB_ENV:-/dev/null}"
