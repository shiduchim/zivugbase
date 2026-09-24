package org.zivugbase.addon;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Setup: turn the bubble on (Android's Accessibility settings), show or hide it. */
public class MainActivity extends Activity {
    private TextView status;
    private Button toggle;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        int pad = Math.round(20 * getResources().getDisplayMetrics().density);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(pad, pad, pad, pad);

        col.addView(text("ZivugBase add-on", 24, true));
        col.addView(text("A small “Z” bubble floats over any app. In a WhatsApp chat, tap it: the messages on the screen open in ZivugBase, filled in, ready for you to check and Save.\n\nYou can also select text anywhere and choose “ZivugBase” in the menu.", 16, false));

        status = text("", 18, true);
        col.addView(status);

        Button on = button("1. Turn on the bubble");
        on.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        col.addView(on);
        col.addView(text("In the list, tap “ZivugBase bubble” → turn it on → Allow.\n\nIf Android says the setting is restricted: come back here, tap “2. Allow restricted settings”, tap ⋮ at the top right → “Allow restricted settings”, then try step 1 again.", 14, false));

        Button restricted = button("2. Allow restricted settings (only if needed)");
        restricted.setOnClickListener(v -> {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
            startActivity(i);
        });
        col.addView(restricted);

        toggle = button("");
        toggle.setOnClickListener(v -> {
            boolean show = !BubbleService.prefs(this).getBoolean("show", true);
            BubbleService.prefs(this).edit().putBoolean("show", show).apply();
            if (BubbleService.running != null) {
                if (show) BubbleService.running.show(); else BubbleService.running.hide();
            }
            refresh();
        });
        col.addView(toggle);

        Button open = button("Open ZivugBase");
        open.setOnClickListener(v -> Links.openApp(this));
        col.addView(open);

        col.addView(text("Privacy: the bubble reads the screen only when you tap it, and only hands the text to ZivugBase on this phone. This add-on has no internet permission — it cannot send anything anywhere.", 13, false));

        ScrollView scroll = new ScrollView(this);
        scroll.addView(col);
        setContentView(scroll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    private boolean serviceEnabled() {
        String enabled = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        String me = new ComponentName(this, BubbleService.class).flattenToString();
        return enabled != null && enabled.contains(me);
    }

    private void refresh() {
        boolean on = serviceEnabled();
        boolean show = BubbleService.prefs(this).getBoolean("show", true);
        status.setText(on ? (show ? "Bubble: On ✓" : "Bubble: Hidden") : "Bubble: Off — do step 1");
        toggle.setText(show ? "Hide the bubble" : "Show the bubble");
        toggle.setVisibility(on ? View.VISIBLE : View.GONE);
    }

    private TextView text(String s, int sp, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(0xFF16283A);
        if (bold) t.setTypeface(t.getTypeface(), android.graphics.Typeface.BOLD);
        int m = Math.round(8 * getResources().getDisplayMetrics().density);
        t.setPadding(0, m, 0, m);
        return t;
    }

    private Button button(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(17);
        b.setMinHeight(Math.round(56 * getResources().getDisplayMetrics().density));
        return b;
    }
}
