package org.zivugbase.addon;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public class DiagnosticActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        String dump = getSharedPreferences("diagnostic", MODE_PRIVATE)
                .getString("dump", "No diagnostic result.");
        String pkg = getSharedPreferences("diagnostic", MODE_PRIVATE)
                .getString("package", "");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = Math.round(16 * getResources().getDisplayMetrics().density);
        root.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("WhatsApp Accessibility Test");
        title.setTextSize(22);
        title.setTextColor(Color.rgb(22, 40, 58));
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        root.addView(title);

        TextView intro = new TextView(this);
        intro.setText("Package: " + pkg + "\n\nThis is raw data returned by Android Accessibility when Z was tapped. Test a long WhatsApp message without scrolling and look for the complete message in a message_text node.");
        intro.setTextSize(15);
        root.addView(intro);

        Button copy = new Button(this);
        copy.setText("Copy diagnostic results");
        copy.setAllCaps(false);
        copy.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("ZivugBase accessibility diagnostic", dump));
        });
        root.addView(copy);

        TextView data = new TextView(this);
        data.setText(dump);
        data.setTextSize(11);
        data.setTextIsSelectable(true);
        data.setTypeface(android.graphics.Typeface.MONOSPACE);
        data.setTextColor(Color.DKGRAY);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(data, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        setContentView(root);
    }
}
