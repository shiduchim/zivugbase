package org.zivugbase.addon;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** The floating "Z" bubble. Tap: the text on the screen opens in ZivugBase. Drag: move it.
 *  Nothing is read until the bubble is tapped, and nothing is kept here. */
public class BubbleService extends AccessibilityService {
    static BubbleService running;

    private WindowManager wm;
    private TextView bubble;
    private WindowManager.LayoutParams lp;

    private static final Pattern TIME_ONLY = Pattern.compile("^\\d{1,2}:\\d{2}(\\s?[AaPp][Mm])?$");

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("bubble", MODE_PRIVATE);
    }

    @Override
    protected void onServiceConnected() {
        running = this;
        if (prefs(this).getBoolean("show", true)) show();
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        hide();
        running = null;
        return super.onUnbind(intent);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) { /* not used: the screen is read only on tap */ }

    @Override
    public void onInterrupt() {}

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    void show() {
        if (bubble != null) return;
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubble = new TextView(this);
        bubble.setText("Z");
        bubble.setTextSize(22);
        bubble.setTextColor(0xFFFFFFFF);
        bubble.setGravity(Gravity.CENTER);
        bubble.setContentDescription("Save to ZivugBase");
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(0xE62F5D7C);
        bg.setStroke(dp(2), 0xFFFFFFFF);
        bubble.setBackground(bg);
        bubble.setElevation(dp(6));

        int size = dp(52);
        DisplayMetrics m = getResources().getDisplayMetrics();
        lp = new WindowManager.LayoutParams(size, size,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        lp.x = prefs(this).getInt("x", m.widthPixels - size - dp(4));
        lp.y = prefs(this).getInt("y", m.heightPixels / 3);

        bubble.setOnTouchListener(new View.OnTouchListener() {
            float downX, downY; int startX, startY; boolean dragged;

            @Override
            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = e.getRawX(); downY = e.getRawY(); startX = lp.x; startY = lp.y; dragged = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - downX, dy = e.getRawY() - downY;
                        if (Math.abs(dx) > dp(8) || Math.abs(dy) > dp(8)) dragged = true;
                        if (dragged) {
                            lp.x = startX + Math.round(dx);
                            lp.y = startY + Math.round(dy);
                            wm.updateViewLayout(bubble, lp);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (dragged) prefs(BubbleService.this).edit().putInt("x", lp.x).putInt("y", lp.y).apply();
                        else capture();
                        return true;
                    default:
                        return false;
                }
            }
        });
        wm.addView(bubble, lp);
    }

    void hide() {
        if (bubble != null && wm != null) {
            try { wm.removeView(bubble); } catch (Exception ignored) {}
        }
        bubble = null;
    }

    /** Reads the screen under the bubble. In WhatsApp: the chat's name and the visible messages;
     *  elsewhere: all visible text. */
    private void capture() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            Toast.makeText(this, "Nothing to read on this screen.", Toast.LENGTH_SHORT).show();
            return;
        }
        String pkg = root.getPackageName() == null ? "" : root.getPackageName().toString();
        if (pkg.equals(getPackageName())) return;

        String sender = null;
        List<String> lines = new ArrayList<>();
        if (pkg.startsWith("com.whatsapp")) {
            sender = firstText(root, pkg + ":id/conversation_contact_name");
            for (AccessibilityNodeInfo n : root.findAccessibilityNodeInfosByViewId(pkg + ":id/message_text")) {
                if (n.getText() != null) lines.add(n.getText().toString());
            }
        }
        if (lines.isEmpty()) {
            Set<String> seen = new LinkedHashSet<>();
            walk(root, seen, 0);
            lines.addAll(seen);
        }
        String text = android.text.TextUtils.join("\n", lines).trim();
        if (text.isEmpty()) {
            Toast.makeText(this, "No text found on this screen.", Toast.LENGTH_SHORT).show();
            return;
        }
        Links.openPaste(this, text, sender);
    }

    private static String firstText(AccessibilityNodeInfo root, String viewId) {
        for (AccessibilityNodeInfo n : root.findAccessibilityNodeInfosByViewId(viewId)) {
            if (n.getText() != null && n.getText().length() > 0) return n.getText().toString();
        }
        return null;
    }

    private static void walk(AccessibilityNodeInfo n, Set<String> out, int depth) {
        if (n == null || depth > 40) return;
        if (n.isVisibleToUser() && n.getText() != null) {
            String t = n.getText().toString().trim();
            if (!t.isEmpty() && !TIME_ONLY.matcher(t).matches()) out.add(t);
        }
        for (int i = 0; i < n.getChildCount(); i++) walk(n.getChild(i), out, depth + 1);
    }
}
