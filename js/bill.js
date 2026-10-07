"use strict";
/* ============================================================
   BILL: gather / load / save / print
   ============================================================ */
function gatherBill(){
  const t=computeTotals();
  return {
    id: editingId || ("B"+Date.now()),
    invNo:$("invNo").value.trim(), fy:$("invFY").value.trim(), date:$("invDate").value,
    cust:{name:$("custName").value.trim(),addr:$("custAddr").value.trim(),gst:$("custGst").value.trim(),phone:$("custPhone").value.trim()},
    items:readItems(),
    taxType:$("taxType").value, rate1:$("taxType").value==="inter" ? 18 : Number($("rate1").value)||0, rate2:Number($("rate2").value)||0,
    carrying:Number($("carrying").value)||0,
    discount:Number($("discount").value)||0,
    roundOff:Number($("roundOff").value)||0,
    totals:t,
    savedAt: todayISO()
  };
}
function loadBill(b){
  editingId=b.id;
  $("invNo").value=b.invNo; $("invFY").value=b.fy; $("invDate").value=b.date;
  $("custName").value=b.cust.name; $("custAddr").value=b.cust.addr; $("custGst").value=b.cust.gst; $("custPhone").value=b.cust.phone||"";
  $("taxType").value=b.taxType; $("rate1").value=b.taxType==="inter" ? 18 : b.rate1; $("rate2").value=b.rate2; $("carrying").value=b.carrying||0; $("roundOff").value=b.roundOff;
  $("itemsBody").innerHTML=""; (b.items.length?b.items:[{}]).forEach(addRow);
  applyTaxUI(); recalc();
  $("editingNote").textContent="Editing saved bill "+(b.invNo||b.id);
  document.querySelector('nav.tabs button[data-tab="create"]').click();
}
function newBill(){
  editingId=null;
  settings.lastInv=Number(settings.lastInv)||0;
  $("invNo").value=String((settings.lastInv+1)).padStart(3,"0");
  $("invFY").value=settings.fy||"";
  $("invDate").value=todayISO();
  $("custName").value=$("custAddr").value=$("custGst").value=$("custPhone").value="";
  $("custPick").value="";
  $("taxType").value="intra"; $("rate1").value=9; $("rate2").value=9; $("carrying").value=0; $("roundOff").value=0;
  $("itemsBody").innerHTML=""; addRow();
  applyTaxUI(); recalc();
  $("editingNote").textContent="";
}
function clearBillForm(options={}){
  const silent = !!options.silent;
  if (!silent && document.querySelectorAll("#itemsBody input, #itemsBody textarea").length && !confirm("Clear the current bill form?")) return;
  editingId=null;
  settings.lastInv=Number(settings.lastInv)||0;
  $("invNo").value=String((settings.lastInv+1)).padStart(3,"0");
  $("invFY").value=settings.fy||""; $("invDate").value=todayISO();
  $("custName").value=$("custAddr").value=$("custGst").value=$("custPhone").value="";
  $("custPick").value=""; $("selectedFlag").classList.remove("show");
  $("taxType").value="intra"; $("rate1").value=9; $("rate2").value=9; $("carrying").value=0; $("discount").value=0; $("roundOff").value=0;
  $("itemsBody").innerHTML=""; addRow();
  applyTaxUI(); recalc();
  $("editingNote").textContent="";
  if(!silent) toast("Bill cleared");
}
$("newBillBtn").addEventListener("click",()=>{if(confirm("Start a new blank bill? Unsaved changes will be lost."))newBill();});
$("clearBillBtn").addEventListener("click",clearBillForm);

$("saveBillBtn").addEventListener("click",()=>{
  if(!validateBillItems()) return;
  const b=gatherBill();
  if(!b.invNo){toast("Enter an invoice number");return;}
  bills = normalizeArray(bills);
  const idx=bills.findIndex(x=>x.id===b.id);
  if(idx>=0) bills[idx]=b; else bills.unshift(b);
  // bump auto-increment if this is a new, numeric, higher invoice
  const n=parseInt(b.invNo,10);
  if(!isNaN(n) && n>(Number(settings.lastInv)||0)){settings.lastInv=n;save(LS.settings,settings);}
  editingId=b.id;
  save(LS.bills,bills);
  $("editingNote").textContent="Saved ✓ (bill "+b.invNo+")";
  renderBills();
  toast("Bill saved");
  syncCustomersAndBillsToSupabase({quietSuccess:true});
});

$("printBillBtn").addEventListener("click",()=>{
  const b=gatherBill();
  $("print-area").innerHTML=renderBillHTML(b);
  window.print();
});

function renderBillHTML(b){
  const s=settings, t=b.totals;
  const filled = b.items.filter(i=>i.amt||i.part||i.veh||i.hsn);
  let itemRows = filled.map((i,idx)=>`
    <tr>
      <td class="r-no">${idx+1}</td>
      <td>${i.date?fmtDate(i.date):""}</td>
      <td>${esc("9965")}</td>
      <td>${esc(i.veh)}</td>
      <td>${esc(i.part).replace(/\n/g,"<br>")}</td>
      <td class="r-amt">${i.amt?money(i.amt):""}</td>
    </tr>`).join("");
  const taxRows = (()=>{
    let r="";
    if(t.l1) r+=`<tr class="sum"><td colspan="5" style="text-align:right">${t.l1} ${t.r1}%</td><td class="r-amt">${money(t.t1)}</td></tr>`;
    if(t.l2) r+=`<tr class="sum"><td colspan="5" style="text-align:right">${t.l2} ${t.r2}%</td><td class="r-amt">${money(t.t2)}</td></tr>`;
    if(t.carrying) r+=`<tr class="sum"><td colspan="5" style="text-align:right">Coolie</td><td class="r-amt">${money(t.carrying)}</td></tr>`;
    if(t.round) r+=`<tr class="sum"><td colspan="5" style="text-align:right">Round off</td><td class="r-amt">${money(t.round)}</td></tr>`;
    return r;
  })();
  const logo = s.logo?`<img src="${s.logo}" class="b-logo">`:"";
  return `
  <div class="bill">
    <div class="b-title">${esc(s.title||"BILL")}</div>
    <div class="b-head">
      <div class="b-company">
        ${logo}
        <div class="b-company-text">
          <div class="cname">${esc(s.name)}</div>
          <div class="caddr">${esc(s.addr).replace(/\n/g,"<br>")}<br>GST NO : ${esc(s.gst)}</div>
        </div>
      </div>
      <div class="b-meta">
        <div><b>Invoice No :</b> ${esc(b.invNo)}</div>
        <div>${esc(b.fy)}</div>
      </div>
    </div>
    <div class="b-to">
      <b>To,</b> ${esc(b.cust.name)}<br>
      <span style="margin-left:40px">${esc(b.cust.addr).replace(/\n/g,"<br>")}</span><br>
      <b style="min-width:0">GSTIN :</b> ${esc(b.cust.gst)}
    </div>
    <table class="b-items">
      <thead><tr>
        <th style="width:34px">Sl.No</th><th style="width:78px">Date</th><th style="width:60px">HSN</th>
        <th style="width:96px">Veh No</th><th>Particulars</th><th style="width:90px;text-align:right">Amount</th>
      </tr></thead>
      <tbody>
        ${itemRows}
        <tr class="fill-space"><td colspan="6"></td></tr>
        ${taxRows}
        <tr class="grand"><td colspan="5" style="text-align:right">TOTAL</td>
            <td class="r-amt">₹ ${money(t.grand)}</td></tr>
      </tbody>
    </table>
    <div class="b-words">Rupees : ${numToWords(t.grand)}</div>
    <div class="b-foot">
      <div class="b-bank">
        <b>Bank details</b><br>
        NAME&nbsp;&nbsp;&nbsp;: ${esc(s.bankName)}<br>
        BANK&nbsp;&nbsp;&nbsp;: ${esc(s.bank)}<br>
        BRANCH : ${esc(s.branch)}<br>
        A/C No&nbsp;: ${esc(s.acc)}<br>
        IFSC&nbsp;&nbsp;&nbsp;&nbsp;: ${esc(s.ifsc)}
      </div>
      <div class="b-sign">
        <div>For ${esc(s.name)}</div>
        ${(s.seal||s.sign)
          ? `<div class="sign-row">${s.sign?`<img src="${s.sign}" class="sign-img">`:""}${s.seal?sealHTML(s,b.date?fmtDate(b.date):""):""}</div>`
          : `<div style="height:60px"></div>`}
        <div>Authorised signatory</div>
      </div>
    </div>
  </div>`;
}
/* Seal image with the invoice date centred on its dotted "Date" line (see .seal-date in styles.css). */
function sealHTML(s,dateText){
  const date = dateText ? `<span class="seal-date">${esc(dateText)}</span>` : "";
  return `<div class="seal-wrap"><img src="${s.seal}" class="seal">${date}</div>`;
}
function fmtDate(iso){const [y,m,d]=iso.split("-");return `${d}.${m}.${y}`;}

/* Hide the document title from the browser's print header (backup in case headers are
   forced on — @page margin:0 in styles.css normally suppresses header/footer entirely). */
let _savedTitle=document.title;
window.addEventListener("beforeprint",()=>{_savedTitle=document.title;document.title=" ";});
window.addEventListener("afterprint",()=>{document.title=_savedTitle;});
