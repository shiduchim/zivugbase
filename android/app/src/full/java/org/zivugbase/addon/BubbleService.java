package org.zivugbase.addon;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
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

import java.util.List;
import java.util.regex.Pattern;

/** Temporary diagnostic version: tapping Z dumps exactly what the Accessibility API exposes. */
public class BubbleService extends AccessibilityService {
    static BubbleService running;

    private WindowManager wm;
    private TextView bubble;
    private WindowManager.LayoutParams lp;

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("bubble", MODE_PRIVATE);
    }

    @Override
    protected void onServiceConnected() {
        running = this;
        if (prefs(this).getBoolean("show", true)) show();
    }

    @Override
    public boolean onUnbind(Intent intent) {
        hide();
        running = null;
        return super.onUnbind(intent);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) { }

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
        bubble.setContentDescription("Accessibility diagnostic");
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

    private void capture() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            Toast.makeText(this, "Nothing to inspect on this screen.", Toast.LENGTH_SHORT).show();
            return;
        }

        String pkg = root.getPackageName() == null ? "" : root.getPackageName().toString();
        if (pkg.equals(getPackageName())) return;

        StringBuilder out = new StringBuilder();
        out.append("ZIVUGBASE ACCESSIBILITY DIAGNOSTIC\n");
        out.append("================================\n");
        out.append("Package: ").append(pkg).append("\n");
        out.append("Root class: ").append(safeClass(root)).append("\n\n");

        if (pkg.startsWith("com.whatsapp")) {
            out.append("WHATSAPP-SPECIFIC CHECKS\n");
            out.append("------------------------\n");
            dumpViewIdMatches(root, pkg + ":id/conversation_contact_name", out, "conversation_contact_name");
            dumpViewIdMatches(root, pkg + ":id/message_text", out, "message_text");
            out.append("\n");
        }

        out.append("FULL ACCESSIBILITY NODE TREE\n");
        out.append("----------------------------\n");
        int[] count = new int[] {0, 0};
        dumpNode(root, out, 0, count);

        out.append("\nSUMMARY\n");
        out.append("-------\n");
        out.append("Nodes visited: ").append(count[0]).append("\n");
        out.append("Text-bearing nodes: ").append(count[1]).append("\n");
        out.append("Compare text in nodes marked visible=false with visible=true nodes.\n");
        out.append("If a long WhatsApp message appears as one complete message_text node even when part is off-screen, the complete text is accessible without scrolling.\n");

        if (out.length() > 350000) {
            out.setLength(350000);
            out.append("\n\n[DIAGNOSTIC OUTPUT TRUNCATED AT 350,000 CHARACTERS]\n");
        }

        getSharedPreferences("diagnostic", MODE_PRIVATE)
                .edit()
                .putString("dump", out.toString())
                .putString("package", pkg)
                .apply();

        Intent i = new Intent(this, DiagnosticActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(i);
    }

    private void dumpViewIdMatches(AccessibilityNodeInfo root, String viewId, StringBuilder out, String label) {
        List<AccessibilityNodeInfo> nodes;
        try {
            nodes = root.findAccessibilityNodeInfosByViewId(viewId);
        } catch (Exception e) {
            out.append(label).append(": ERROR ").append(e).append("\n");
            return;
        }

        out.append(label).append(" nodes: ").append(nodes.size()).append("\n");
        for (int i = 0; i < nodes.size(); i++) {
            AccessibilityNodeInfo n = nodes.get(i);
            out.append("  [").append(i).append("] ");
            appendNodeDetails(n, out);
            out.append("\n");
        }
    }

    private void dumpNode(AccessibilityNodeInfo n, StringBuilder out, int depth, int[] count) {
        if (n == null || depth > 50 || out.length() > 345000) return;
        count[0]++;

        boolean hasText = n.getText() != null || n.getContentDescription() != null;
        if (hasText) count[1]++;

        for (int i = 0; i < depth; i++) out.append("  ");
        out.append("[").append(count[0]).append("] ");
        appendNodeDetails(n, out);
        out.append("\n");

        for (int i = 0; i < n.getChildCount(); i++) {
            dumpNode(n.getChild(i), out, depth + 1, count);
        }
    }

    private void appendNodeDetails(AccessibilityNodeInfo n, StringBuilder out) {
        out.append("class=").append(safeClass(n));
        out.append(" visible=").append(n.isVisibleToUser());
        out.append(" scrollable=").append(n.isScrollable());
        out.append(" enabled=").append(n.isEnabled());
        out.append(" children=").append(n.getChildCount());

        try {
            String id = n.getViewIdResourceName();
            if (id != null) out.append(" viewId=").append(id);
        } catch (Exception ignored) {}

        android.graphics.Rect r = new android.graphics.Rect();
        n.getBoundsInScreen(r);
        out.append(" bounds=").append(r.toShortString());

        CharSequence text = n.getText();
        if (text != null) out.append(" text=").append(escape(text.toString()));

        CharSequence desc = n.getContentDescription();
        if (desc != null) out.append(" contentDescription=").append(escape(desc.toString()));
    }

    private static String safeClass(AccessibilityNodeInfo n) {
        try {
            CharSequence c = n.getClassName();
            return c == null ? "" : c.toString();
        } catch (Exception e) {
            return "?";
        }
    }

    private static String escape(String s) {
        return s.replace("\r", "\\r").replace("\n", "\\n");
    }
}
