package com.gordyelliott.atcapacity;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
 @Override public void onCreate(android.os.Bundle savedInstanceState) {
  registerPlugin(TerraHealthPlugin.class);
  super.onCreate(savedInstanceState);
 }
}
