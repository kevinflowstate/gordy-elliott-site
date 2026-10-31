import Capacitor
import TerraiOS

@objc(TerraHealthPlugin)
public class TerraHealthPlugin: CAPPlugin, CAPBridgedPlugin {
 public let identifier = "TerraHealthPlugin"
 public let jsName = "TerraHealth"
 public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise), CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise), CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise)]
 private var manager: TerraManager?
 private var connecting = false
 @objc func connect(_ call: CAPPluginCall) {
  guard call.getString("connection") == "APPLE_HEALTH", let devId=call.getString("devId"), let reference=call.getString("referenceId"), let token=call.getString("token") else { call.reject("Invalid health connection"); return }
  DispatchQueue.main.async {
   guard !self.connecting else { call.reject("A connection is already in progress"); return }
   self.connecting = true
   Terra.instance(devId:devId, referenceId:reference, requestPermissions:false) { manager, error in
    guard let manager=manager, error == nil else { self.connecting=false; call.reject("Couldn't initialise Apple Health"); return }
    self.manager=manager
    DispatchQueue.main.async {
     manager.initConnection(type:.APPLE_HEALTH, token:token, customReadTypes:[.WORKOUT_TYPE,.ACTIVITY_SUMMARY,.STEPS,.HEART_RATE,.RESTING_HEART_RATE,.HEART_RATE_VARIABILITY,.SLEEP_ANALYSIS,.CALORIES], schedulerOn:true) { success, error in
      self.connecting=false
      guard success, error == nil, let userId=manager.getUserId(type:.APPLE_HEALTH) else { call.reject("Apple Health connection was not completed"); return }
      call.resolve(["userId":userId])
     }
    }
   }
  }
 }
 @objc func status(_ call: CAPPluginCall) { call.resolve(["userId":manager?.getUserId(type:.APPLE_HEALTH) as Any? ?? NSNull()]) }
 @objc func disconnect(_ call: CAPPluginCall) { manager=nil; call.resolve() }
}
