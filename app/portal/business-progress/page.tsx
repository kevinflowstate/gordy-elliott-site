"use client";
import {useEffect,useState} from 'react';
import type {CheckIn} from '@/lib/types';
import BusinessMetricTrends from '@/components/portal/BusinessMetricTrends';
export default function BusinessProgressPage(){const [checkins,setCheckins]=useState<CheckIn[]>([]);const [state,setState]=useState<'loading'|'ready'|'error'>('loading');useEffect(()=>{fetch('/api/portal/business-progress').then(async res=>{if(!res.ok)throw new Error();setCheckins((await res.json()).checkins||[]);setState('ready')}).catch(()=>setState('error'))},[]);return <div className="mx-auto max-w-5xl p-5 sm:p-0">{state==='loading'?<p>Loading business progress…</p>:state==='error'?<p role="alert">Couldn’t load your progress. Refresh to try again.</p>:<BusinessMetricTrends checkins={checkins}/>}</div>}
