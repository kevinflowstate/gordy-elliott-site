package com.gordyelliott.atcapacity
import android.os.Bundle
import android.widget.TextView
import android.text.method.LinkMovementMethod
import android.text.SpannableString
import android.text.Spanned
import android.text.style.URLSpan
import androidx.appcompat.app.AppCompatActivity
class HealthPrivacyActivity: AppCompatActivity() {
 override fun onCreate(state:Bundle?) {
  super.onCreate(state)
  val text=SpannableString("AT CAPACITY reads the activity, sleep and heart-rate categories you approve through Health Connect to show trends to you and your coach. Read our Privacy Notice.")
  text.setSpan(URLSpan("https://app.onlinegordy.com/privacy"),text.indexOf("Privacy Notice"),text.length,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
  setContentView(TextView(this).apply {setPadding(48,64,48,48);textSize=18f;this.text=text;movementMethod=LinkMovementMethod.getInstance()})
 }
}
