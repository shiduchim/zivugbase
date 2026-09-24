package org.zivugbase.addon;

import android.content.Context;

/** The light add-on has no bubble (so Play Protect has nothing to block): only the text menu. */
final class Bubble {
    static final boolean AVAILABLE = false;
    private Bubble() {}
    static boolean shown(Context c) { return false; }
    static void setShown(Context c, boolean show) {}
    static String serviceName(Context c) { return ""; }
}
