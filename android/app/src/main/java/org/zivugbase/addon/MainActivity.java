package org.zivugbase.addon;

import android.app.Activity;
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
        if (Bubble.AVAILABLE) {
            col.addView(text("A small “Z” bubble floats over any app. In a WhatsApp chat, tap it: the messages on the screen open in ZivugBase, filled in, ready for you to check and Save.\n\nYou can also select text anywhere and choose “ZivugBase” in the menu.", 16, false));

            status = text("", 18, true);
            col.addView(status);

            Button on = button("1. Turn on the bubble");
            on.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
            col.addView(on);
            col.addView(text("In the list, tap “ZivugBase bubble” → turn it on → Allow.\n\nIf Android says the setting is restricted: come back here, tap “2. Allow restricted settings”, tap ⋮ at the top right → “Allow restricted settings”, then try step 1 again.", 14, false));

            Button restricted = button("2. Allow restricted settings (only if needed)");
            restricted.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))));
            col.addView(restricted);

            toggle = button("");
            toggle.setOnClickListener(v -> { Bubble.setShown(this, !Bubble.shown(this)); refresh(); });
            col.addView(toggle);
        } else {
            col.addView(text("Nothing to set up.\n\nIn WhatsApp (or any app): press and hold on the profile text, drag the handles to select all of it, then tap “ZivugBase” in the small menu (tap ⋮ in that menu if you don’t see it). ZivugBase opens with it filled in, ready for you to check and Save.", 16, false));
        }

        Button open = button("Open ZivugBase");
        open.setOnClickListener(v -> Links.openApp(this));
        col.addView(open);

        col.addView(text(Bubble.AVAILABLE ? "Privacy: the bubble reads the screen only when you tap it, and only hands the text to ZivugBase on this phone. This add-on has no internet permission — it cannot send anything anywhere." : "Privacy: this add-on only receives text you select and hand to it. It has no internet permission — it cannot send anything anywhere.", 13, false));

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
        return enabled != null && enabled.contains(Bubble.serviceName(this));
    }

    private void refresh() {
        if (!Bubble.AVAILABLE) return;
        boolean on = serviceEnabled();
        boolean show = Bubble.shown(this);
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
