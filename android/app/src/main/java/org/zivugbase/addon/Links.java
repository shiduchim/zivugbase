package org.zivugbase.addon;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;

/** Opens ZivugBase (the installed web app) on its Paste screen with the text filled in.
 *  The text travels after the "#", which never leaves the phone. */
final class Links {
    static final String APP = "https://shiduchim.github.io/zivugbase/";
    private static final int MAX = 12000;

    private Links() {}

    static void openPaste(Context ctx, String text, String sender) {
        String t = text == null ? "" : text.trim();
        if (t.length() > MAX) t = t.substring(t.length() - MAX);
        StringBuilder url = new StringBuilder(APP).append("#/capture/paste?addon=1");
        if (sender != null && !sender.trim().isEmpty()) url.append("&sender=").append(Uri.encode(sender.trim()));
        url.append("&text=").append(Uri.encode(t));
        open(ctx, url.toString());
    }

    static void openApp(Context ctx) {
        open(ctx, APP + "#/home");
    }

    private static void open(Context ctx, String url) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        i.addCategory(Intent.CATEGORY_BROWSABLE);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(i);
        } catch (Exception e) {
            Toast.makeText(ctx, "Couldn't open ZivugBase. Open it once in Chrome, then try again.", Toast.LENGTH_LONG).show();
        }
    }
}
