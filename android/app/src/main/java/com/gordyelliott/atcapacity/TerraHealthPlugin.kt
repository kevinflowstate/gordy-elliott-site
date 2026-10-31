package com.gordyelliott.atcapacity
import android.app.Activity
import android.content.Intent
import com.getcapacitor.*
import com.getcapacitor.annotation.*
import androidx.activity.result.ActivityResult

@CapacitorPlugin(name="TerraHealth")
class TerraHealthPlugin: Plugin() {
 private var userId: String? = null
 @PluginMethod fun connect(call: PluginCall) {
  val devId=call.getString("devId"); val reference=call.getString("referenceId"); val token=call.getString("token")
  if(call.getString("connection") != "HEALTH_CONNECT" || devId==null || reference==null || token==null) {call.reject("Invalid health connection"); return}
  val intent=Intent(activity,TerraHealthActivity::class.java).putExtra("devId",devId).putExtra("referenceId",reference).putExtra("token",token)
  startActivityForResult(call,intent,"healthResult")
 }
 @ActivityCallback private fun healthResult(call:PluginCall?,result:ActivityResult) {
  if(call==null)return
  val id=result.data?.getStringExtra("userId")
  if(result.resultCode != Activity.RESULT_OK || id==null) {call.reject("Health Connect connection was not completed");return}
  userId=id;call.resolve(JSObject().put("userId",id))
 }
 @PluginMethod fun status(call:PluginCall) {call.resolve(JSObject().put("userId",userId ?: org.json.JSONObject.NULL))}
 @PluginMethod fun disconnect(call:PluginCall) {userId=null;call.resolve()}
}
