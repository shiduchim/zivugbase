package org.zivugbase.addon;

import android.content.Context;

/** The full add-on has the bubble. */
final class Bubble {
    static final boolean AVAILABLE = true;
    private Bubble() {}
    static boolean shown(Context c) { return BubbleService.prefs(c).getBoolean("show", true); }
    static void setShown(Context c, boolean show) {
        BubbleService.prefs(c).edit().putBoolean("show", show).apply();
        if (BubbleService.running != null) {
            if (show) BubbleService.running.show(); else BubbleService.running.hide();
        }
    }
    static String serviceName(Context c) { return c.getPackageName() + "/" + BubbleService.class.getName(); }
}
