"use strict";
/* ============================================================
   TAX / TOTALS
   ============================================================ */
function taxLabels(){
  const t=$("taxType").value;
  if(t==="intra") return ["SGST","CGST"];
  if(t==="inter") return ["IGST",null];
  return [null,null];
}
function applyTaxUI(){
  if($("taxType").value==="inter"){
    $("rate1").value=18;
    $("rate1").readOnly=true;
    $("rate2").readOnly=false;
  } else {
    $("rate1").readOnly=false;
    $("rate2").readOnly=false;
  }
  const [l1,l2]=taxLabels();
  $("rate1Wrap").style.display = l1?"flex":"none";
  $("rate2Wrap").style.display = l2?"flex":"none";
  if(l1) $("rate1Wrap").childNodes[0].nodeValue = l1+" %";
  if(l2) $("rate2Wrap").childNodes[0].nodeValue = l2+" %";
}
function computeTotals(){
  const items=readItems();
  const sub=items.reduce((s,i)=>s+i.amt,0);
  const [l1,l2]=taxLabels();
  const r1=l1?Math.max(0,Number($("rate1").value)||0):0;
  const r2=l2?Math.max(0,Number($("rate2").value)||0):0;
  const t1=sub*r1/100, t2=sub*r2/100;
  const carrying=Math.max(0,Number($("carrying").value)||0);
  const discount=Math.max(0,Number($("discount").value)||0);
  const round=Number($("roundOff").value)||0; // may be negative when rounding down
  const grand=sub+t1+t2+carrying-discount+round;
  return {sub,l1,l2,r1,r2,t1,t2,carrying,discount,round,grand};
}
function recalc(){
  const t=computeTotals();
  let html=`<div class="line"><span>Subtotal</span><b>₹ ${money(t.sub)}</b></div>`;
  if(t.l1) html+=`<div class="line"><span>${t.l1} ${t.r1}%</span><b>₹ ${money(t.t1)}</b></div>`;
  if(t.l2) html+=`<div class="line"><span>${t.l2} ${t.r2}%</span><b>₹ ${money(t.t2)}</b></div>`;
  if(t.carrying) html+=`<div class="line"><span>Coolie</span><b>₹ ${money(t.carrying)}</b></div>`;
  if(t.discount) html+=`<div class="line"><span>Discount</span><b>₹ ${money(t.discount)}</b></div>`;
  html+=`<div class="line"><span>Round off</span><b>₹ ${money(t.round)}</b></div>`;
  html+=`<div class="line grand"><span>TOTAL</span><span>₹ ${money(t.grand)}</span></div>`;
  $("totalsBox").innerHTML=html;
  $("wordsBox").textContent = "₹ in words:  "+numToWords(t.grand);
}
["taxType","rate1","rate2","roundOff","carrying","discount"].forEach(id=>$(id).addEventListener("input",e=>{if(id==="taxType")applyTaxUI(); if($("taxType").value==="inter" && id==="rate1") $("rate1").value=18; if(id!=="roundOff" && Number($(id).value)<0) $(id).value='0'; recalc();}));
$("taxType").addEventListener("change",()=>{applyTaxUI();recalc();});
$("autoRoundBtn").addEventListener("click",()=>{
  const t=computeTotals();
  const before=t.sub+t.t1+t.t2+t.carrying-t.discount;
  $("roundOff").value=(Math.round(before)-before).toFixed(2);
  recalc();
});
$("addRowBtn").addEventListener("click",()=>{addRow();});
