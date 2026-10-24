"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { captureRetailIntent, confirmedRetailReceipt, performRetainedRetail, retailIntentForm, type RetailIntent, type RetailPurpose, type RetailReceipt } from "./retainedRetail";
import { retailVault, retailVaultLock } from "./retailVault";
import { readRetainedRetail, submitRetainedRetail } from "./retail-actions";
import { shortRef } from "../lib/labels";
import { buttonClass, primaryButtonClass } from "../components/cv-ui";

export function DurableRetailForm({userId,businessId,storeId,purpose,label,children}:{userId:string;businessId:string;storeId:string;purpose:RetailPurpose;label:string;children:ReactNode}) {
  const identity={userId,businessId,storeId},identityKey=JSON.stringify(identity),active=useRef(identityKey);active.current=identityKey;
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[pending,setPending]=useState<RetailIntent|null>(null),[history,setHistory]=useState<{intent:RetailIntent;receipt:RetailReceipt}|null>(null),[message,setMessage]=useState("Loading retained operation");
  const busyRef=useRef(false),formRef=useRef<HTMLFormElement>(null),router=useRouter();
  useEffect(()=>{
    let current=true;
    const sync=async()=>{
      setReady(false);
      try {
        if(!userId||!businessId||!storeId||!navigator.locks?.request)throw new Error("Private operation storage unavailable");
        const loaded=await navigator.locks.request(retailVaultLock,async()=>{const vault=retailVault({userId,businessId,storeId});return {pending:await vault.load(),history:await vault.history()};});
        if(!current)return;
        setPending(loaded.pending);
        const receipt=loaded.history?confirmedRetailReceipt({...(loaded.history.receipt&&typeof loaded.history.receipt==="object"?loaded.history.receipt:{}),state:"succeeded",retryable:false,purpose:loaded.history.intent.purpose,key:loaded.history.intent.key},loaded.history.intent):null;
        setHistory(receipt&&loaded.history?{intent:loaded.history.intent,receipt}:null);
        setReady(true);setMessage(loaded.pending?"Awaiting confirmation":"Ready");
      }catch {if(current){setReady(false);setMessage("Private operation storage unavailable or belongs to another account/store");}}
    };
    void sync();window.addEventListener("ofc-retail-vault",sync);
    return ()=>{current=false;window.removeEventListener("ofc-retail-vault",sync);};
  },[userId,businessId,storeId]);
  async function act(mode:"new"|"read"|"retry",candidate:RetailIntent|null) {
    if(!ready||busyRef.current)return;
    busyRef.current=true;setBusy(true);const originalIdentity=identityKey;
    try {
      const result=await navigator.locks.request(retailVaultLock,async()=>{
        if(active.current!==originalIdentity)throw new Error("Original account or store changed");
        const vault=retailVault(identity);
        return performRetainedRetail({load:()=>vault.load(),save:async intent=>{await vault.save(intent);window.dispatchEvent(new Event("ofc-retail-vault"));},confirm:(intent,receipt)=>vault.confirm(intent,receipt)},identity,mode,candidate,{
          read:intent=>{if(active.current!==originalIdentity)throw new Error("Original scope changed");return readRetainedRetail(retailIntentForm(intent));},
          submit:intent=>{if(active.current!==originalIdentity)throw new Error("Original scope changed");return submitRetainedRetail(retailIntentForm(intent));},
        });
      });
      if(active.current!==originalIdentity)return;
      setPending(result.receipt?null:result.intent);
      setMessage(result.receipt?(purpose==="completePosSale"?"Sale completed":"Refund completed"):"Awaiting confirmation");
      if(result.receipt){setHistory({intent:result.intent,receipt:result.receipt});formRef.current?.reset();router.refresh();}
      window.dispatchEvent(new Event("ofc-retail-vault"));
    }catch {
      if(active.current===originalIdentity){setReady(false);if(candidate)setPending(candidate);setMessage("Sale saved. Review the payment details before continuing.");}
    }finally {busyRef.current=false;if(active.current===originalIdentity)setBusy(false);}
  }
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!ready||busyRef.current||pending)return;
    try {void act("new",captureRetailIntent(new FormData(event.currentTarget),identity,purpose,crypto.randomUUID()));}
    catch {setMessage("Invalid operation details");}
  }
  const receiptSale=history?(history.intent.purpose==="completePosSale"?history.receipt.id:history.intent.fields.saleId):null;
  return <section className="grid min-w-0 gap-3" data-retail-purpose={purpose}>
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{busy?"Confirming…":message}</p>
    {pending&&<div className="grid min-w-0 gap-2 border p-3">
      <p className="text-sm font-medium">{pending.purpose==="completePosSale"?"Sale":"Refund"} awaiting confirmation</p>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!ready||busy} onClick={()=>void act("read",pending)} className={buttonClass}>Check result</button><button type="button" disabled={!ready||busy} onClick={()=>void act("retry",pending)} className={buttonClass}>Retry</button></div>
    </div>}
    <form ref={formRef} onSubmit={submit}>
      <fieldset disabled={!ready||busy||Boolean(pending)} className="grid min-w-0 gap-3 sm:grid-cols-2">
        {children}
        <button type="submit" className={`${primaryButtonClass} sm:col-span-2`}>{label}</button>
      </fieldset>
    </form>
    {history&&receiptSale&&<p role="status" className="flex flex-wrap items-baseline gap-2 rounded-xl border border-emerald-600/25 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
      <span aria-hidden="true" className="inline-block size-2 translate-y-[-0.1em] rounded-full bg-emerald-500" />
      {history.intent.purpose==="completePosSale"?"Sale completed":"Refund completed"} · {shortRef(history.receipt.reference)||"receipt"}
      <Link className="font-medium underline underline-offset-4" href={`/dashboard/platform/pos/receipt/${encodeURIComponent(receiptSale)}?${new URLSearchParams({businessId,storeId})}`}>Open receipt</Link>
    </p>}
  </section>;
}
