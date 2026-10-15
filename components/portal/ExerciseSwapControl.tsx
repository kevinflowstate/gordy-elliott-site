"use client";
import { useState } from "react";
import type { Exercise } from "@/lib/types";
export interface ExerciseAlternative { exercise: Exercise; status: "generated"|"approved"; rationale: string; required_equipment: string[] }
export default function ExerciseSwapControl({alternatives,original,current,locked,onChoose}:{alternatives:ExerciseAlternative[];original:Exercise;current:Exercise;locked:boolean;onChoose:(exercise:Exercise)=>void}) {
 const [open,setOpen]=useState(false); const [equipment,setEquipment]=useState<string[]>([]);
 if(!alternatives.length&&original.id===current.id) return null;
 const needed=[...new Set(alternatives.flatMap(a=>a.required_equipment).filter(e=>!["bodyweight","none"].includes(e)))];
 const eligible=alternatives.filter(a=>a.required_equipment.every(e=>["bodyweight","none"].includes(e)||equipment.includes(e)));
 return <div className="mt-4 rounded-2xl border border-white/15 p-3">
  {current.id!==original.id&&<p className="mb-2 text-xs text-white/60">For this workout · originally {original.name}</p>}
  <button type="button" onClick={()=>setOpen(!open)} disabled={locked} className="min-h-11 text-sm font-semibold text-[#F060E0] disabled:text-white/40"><span aria-hidden="true" className="mr-2 text-xl">⇄</span>Swap exercise</button>
  {locked&&<p className="text-xs text-white/50">Choose before entering sets. Saved exercises stay in your history.</p>}
  {open&&!locked&&<div className="space-y-3">
   <p className="text-sm text-white/70">Select the equipment you have available. Keep the prescribed sets and reps, and choose a fresh comfortable load. These matches do not assess injuries or personal restrictions.</p>
   <fieldset className="flex flex-wrap gap-2"><legend className="mb-2 text-sm font-semibold">Available equipment</legend>{needed.map(e=><label key={e} className="flex min-h-11 items-center gap-2 rounded-lg bg-white/5 px-3 text-sm"><input type="checkbox" checked={equipment.includes(e)} onChange={event=>setEquipment(previous=>event.target.checked?[...previous,e]:previous.filter(x=>x!==e))}/>{e}</label>)}</fieldset>
   {eligible.length===0&&<p className="text-sm text-white/50">No alternatives match your selected equipment.</p>}
   {eligible.map(a=><button type="button" key={a.exercise.id} onClick={()=>{onChoose(a.exercise);setOpen(false);}} className="block min-h-12 w-full rounded-xl border border-white/15 p-3 text-left"><span className="block font-semibold">{a.exercise.name}</span><span className="text-xs text-white/50">{a.status==='approved'?'Coach reviewed':'Suggested movement match'} · {a.required_equipment.join(', ')}</span></button>)}
   {current.id!==original.id&&<button type="button" onClick={()=>{onChoose(original);setOpen(false);}} className="min-h-11 text-sm underline">Keep original: {original.name}</button>}
   <p className="text-xs text-white/50">Changing exercise clears all entered sets and loads. Your assigned plan stays the same.</p>
  </div>}
 </div>;
}
