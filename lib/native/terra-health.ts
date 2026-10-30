import { Capacitor, registerPlugin } from "@capacitor/core";
export interface TerraHealthPlugin {
 connect(options: {devId:string;referenceId:string;token:string;connection:"APPLE_HEALTH"|"HEALTH_CONNECT"}):Promise<{userId:string}>;
 status():Promise<{userId:string|null}>;
 disconnect():Promise<void>;
}
export const TerraHealth=registerPlugin<TerraHealthPlugin>("TerraHealth");
export function nativeHealthProvider() {
 if(!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("TerraHealth")) return null;
 return Capacitor.getPlatform()==="ios" ? "apple" : Capacitor.getPlatform()==="android" ? "healthconnect" : null;
}
