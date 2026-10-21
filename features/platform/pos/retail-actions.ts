"use server";

import { revalidatePath } from "next/cache";
import { RefundReasonType, ReturnReasonType, ReturnLineDispositionType, ReturnLineConditionType } from "@prisma/client";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { registerCloseActorId } from "./register-close-actions";
import { normalizeQuantity } from "@/features/keystone/lib/quantity";
import { parseRetailIntent, type RetailIntent } from "./retainedRetail";

async function original(form: FormData) {
  const raw=form.get("__intent");
  if(typeof raw!=="string"||raw.length>80_000)throw new Error("Invalid retained operation");
  let value: unknown;
  try { value=JSON.parse(raw); } catch { throw new Error("Invalid retained operation"); }
  const intent=parseRetailIntent(value);
  if(await registerCloseActorId()!==intent.userId)throw new Error("Original account is unavailable");
  return intent;
}
function command(intent: RetailIntent) {
  const text=(name:string)=>intent.fields[name]?.trim()??"";
  const optional=(name:string)=>text(name)||null;
  const integer=(name:string)=>{
    const raw=text(name),value=Number(raw);
    if(!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value>2_147_483_647)throw new Error("Amount must be integer cents");
    return value;
  };
  const base={businessId:intent.businessId,storeId:intent.storeId,idempotencyKey:intent.key};
  if(intent.purpose==="completePosSale") {
    const tender=(suffix:string)=>{
      const method=text(`method${suffix}`),amountCents=integer(`amountCents${suffix}`);
      if(!["cash","credit_card","debit_card","mobile_wallet","fleet_card"].includes(method))throw new Error("Tender method unavailable");
      return {method,amountCents,tenderedCents:method==="cash"?(text(`tenderedCents${suffix}`)?integer(`tenderedCents${suffix}`):amountCents):null,paymentProviderId:method==="cash"?null:optional(`paymentProviderId${suffix}`),providerPaymentId:method==="cash"?null:optional(`providerPaymentId${suffix}`),providerAuthority:method==="cash"?null:optional(`providerAuthority${suffix}`),cardBrand:method==="cash"?null:optional(`cardBrand${suffix}`),cardLast4:method==="cash"?null:optional(`cardLast4${suffix}`)};
    };
    return {...base,cartId:text("cartId"),tenders:[tender(""),...(text("amountCents2")?[tender("2")]:[])]};
  }
  const allocation=(suffix:string)=>({tenderId:text(`originalTenderId${suffix}`),amountCents:integer(`refundAllocationCents${suffix}`),providerRefundId:optional(`providerRefundId${suffix}`),providerAuthority:optional(`providerAuthority${suffix}`)});
  const tenderAllocations=text("refundAllocationCents")?[allocation(""),...(text("refundAllocationCents2")?[allocation("2")]:[])]:null;
  if(text("managerPin")&&!/^\d{6,12}$/.test(text("managerPin")))throw new Error("Invalid manager PIN");
  for (const [name, values, optionalValue] of [["reason",Object.values(RefundReasonType),false],["returnReason",Object.values(ReturnReasonType),true],["disposition",Object.values(ReturnLineDispositionType),false],["condition",Object.values(ReturnLineConditionType),true]] as const) {
    if (!(optionalValue && !text(name)) && !(values as readonly string[]).includes(text(name))) throw new Error("Return selection unavailable");
  }
  return {...base,saleId:text("saleId"),originalTenderId:tenderAllocations?null:text("originalTenderId"),tenderAllocations,registerSessionId:text("registerSessionId"),employeeId:text("employeeId"),reason:text("reason"),returnReason:optional("returnReason"),providerRefundId:optional("providerRefundId"),providerAuthority:optional("providerAuthority"),notes:optional("notes"),overrideNonReturnable:text("overrideNonReturnable")==="true",overrideReason:optional("overrideReason"),managerPin:optional("managerPin"),lines:[{saleLineId:text("saleLineId"),quantity:normalizeQuantity(text("quantity")),disposition:text("disposition"),condition:optional("condition"),note:optional("notes")}]};
}
// FormData keeps private PIN/proof values out of development action-argument logs.
export async function submitRetainedRetail(form:FormData):Promise<void> {
  const intent=await original(form),input=command(intent);
  const document=intent.purpose==="completePosSale"
    ? "mutation($input:CompletePosSaleInput!){completePosSale(input:$input){id status reference}}"
    : "mutation($input:RefundPosSaleInput!){refundPosSale(input:$input){id status reference}}";
  const result=await keystoneClient(document,{input});
  if(!result.success)throw new Error("Original operation is unconfirmed");
  for(const path of ["/dashboard/platform/pos","/dashboard/platform/payments","/dashboard/platform/reconciliation","/account"])revalidatePath(path);
}
export async function readRetainedRetail(form:FormData):Promise<unknown> {
  const intent=await original(form),body=command(intent);
  const result=await keystoneClient<{posOperationOutcome:unknown}>("query($input:PosOperationOutcomeInput!){posOperationOutcome(input:$input){state retryable id status reference}}",{input:{businessId:intent.businessId,storeId:intent.storeId,scope:intent.purpose,idempotencyKey:intent.key,command:body}});
  const outcome=result.success?result.data.posOperationOutcome:null;
  return outcome && typeof outcome === "object" ? {...outcome,purpose:intent.purpose,key:intent.key} : null;
}
