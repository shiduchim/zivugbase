package org.zivugbase.addon;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/** Select text in any app → "ZivugBase" in the menu → it opens in ZivugBase's form. */
public class ProcessTextActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        CharSequence text = getIntent().getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT);
        if (text != null && text.length() > 0) Links.openPaste(this, text.toString(), null);
        finish();
    }
}
