"use strict";
/* ============================================================
   SAVED BILLS LIST
   ============================================================ */
function renderBills(){
  bills = normalizeArray(bills);
  const q=($("searchBills")?.value || "").toLowerCase();
  const body=$("billsBody"); body.innerHTML="";
  const list=bills.filter(b=>{
    const custName = (b && b.cust && b.cust.name) ? b.cust.name : "";
    const billText = (b && (b.invNo || "")) + " " + custName;
    return !q || billText.toLowerCase().includes(q);
  });
  $("billsEmpty").style.display=list.length?"none":"block";
  list.forEach(b=>{
    const tr=document.createElement("tr");
    const billNo = b.invNo || "—";
    const customerName = (b.cust && b.cust.name) ? esc(b.cust.name) : '<span style="color:#b6c0cc">—</span>';
    const totalValue = (b && b.totals && b.totals.grand) ? money(b.totals.grand) : '0.00';
    tr.innerHTML=`<td><input type="checkbox" class="row-check bill-row-check" data-id="${b.id || billNo}" aria-label="Select bill"></td><td><span class="inv-tag">${esc(billNo)}</span></td>
      <td>${b.date?fmtDate(b.date):"—"}</td>
      <td class="c-name">${customerName}</td>
      <td class="num"><span class="amt-tag">₹ ${totalValue}</span></td>
      <td><div class="tbl-actions">
        <button class="icon-btn" data-a="open">📂 Open</button>
        <button class="icon-btn" data-a="print">🖨️ Print</button>
        <button class="icon-btn" data-a="share" title="Share PDF (pick WhatsApp or any app)">📤 Share</button>        <button class="icon-btn del" data-a="del">🗑️</button>
      </div></td>`;
    tr.querySelector('[data-a="open"]').addEventListener("click",()=>loadBill(b));
    tr.querySelector('[data-a="share"]').addEventListener("click",e=>shareBillPdf(b,e.currentTarget));    tr.querySelector('[data-a="print"]').addEventListener("click",()=>{
      $("print-area").innerHTML=renderBillHTML(b);window.print();
    });
    tr.querySelector('[data-a="del"]').addEventListener("click",()=>{
      if(confirm("Delete bill "+(b.invNo || "this bill")+"?")){bills=bills.filter(x=>x.id!==b.id);save(LS.bills,bills);renderBills();}
    });
    body.appendChild(tr);
  });
  const master = $("headerSelectBills");
  if(master){ master.checked = false; }
}
/* ---------- Share bill ----------
   Builds a PDF of the printed bill and opens the device share sheet (pick WhatsApp + contact).
   If file sharing isn't supported, downloads the PDF and opens WhatsApp with a summary. */
const HTML2PDF_URL="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
let html2pdfLoading=null;
function loadHtml2Pdf(){
  if(window.html2pdf) return Promise.resolve();
  if(!html2pdfLoading){
    html2pdfLoading=new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src=HTML2PDF_URL; s.onload=resolve;
      s.onerror=()=>{html2pdfLoading=null;reject(new Error("Could not load PDF library (check internet)"));};
      document.head.appendChild(s);
    });
  }
  return html2pdfLoading;
}
function billPdfWorker(b){
  // html2pdf clones the element into an A4-width frame; the "pdf" class makes the bill fit that width
  // and fill one page (see .bill.pdf in styles.css).
  const box=document.createElement("div");
  box.innerHTML=renderBillHTML(b);
  const el=box.firstElementChild; el.classList.add("pdf");
  return html2pdf().set({
    margin:8, image:{type:"jpeg",quality:1},
    html2canvas:{scale:3,backgroundColor:"#fff",scrollX:0,scrollY:0},
    jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},
    pagebreak:{mode:["avoid-all"]}
  }).from(el);
}
async function billToPdfBlob(b){
  await loadHtml2Pdf();
  return billPdfWorker(b).outputPdf("blob");
}
function billShareText(b){
  const t=b.totals||{};
  return "Invoice No: "+(b.invNo||"—")+(b.date?" dated "+fmtDate(b.date):"")+"\n"+
    "To: "+((b.cust&&b.cust.name)||"—")+"\n"+
    "Amount: ₹ "+money(t.grand)+"\n\n"+
    "— "+(settings.name||"");
}
function billPdfName(b){ return "Invoice-"+String(b.invNo||b.id).replace(/[^\w-]+/g,"_")+".pdf"; }
function downloadBlob(blob,fileName){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=fileName; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
/* Phone saved on the bill, else on the matching saved customer. Returns wa.me-ready digits or "". */
function billWhatsappNumber(b){
  const cust=b.cust||{};
  if(cust.phone) return whatsappNumber(cust.phone);
  const name=(cust.name||"").toLowerCase();
  const c=name && customers.find(x=>(x.name||"").toLowerCase()===name);
  return c ? whatsappNumber(c.phone) : "";
}
function waLink(number,text){ return "https://wa.me/"+(number||"")+"?text="+encodeURIComponent(text); }
async function withBusyButton(btn,fn){
  const label=btn?btn.textContent:"";
  if(btn){btn.disabled=true;btn.textContent="⏳ Preparing…";}
  try{ await fn(); } finally{ if(btn){btn.disabled=false;btn.textContent=label;} }
}

async function shareBillPdf(b,btn){
  const text=billShareText(b), fileName=billPdfName(b);
  await withBusyButton(btn,async()=>{
    try{
      const blob=await billToPdfBlob(b);
      const file=new File([blob],fileName,{type:"application/pdf"});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        try{ await navigator.share({files:[file],text}); return; }
        catch(err){ if(err.name==="AbortError") return; console.warn("Share sheet failed, falling back:",err); }
      }
      downloadBlob(blob,fileName);
      window.open(waLink(billWhatsappNumber(b),text),"_blank");
      toast("PDF downloaded — attach it in the WhatsApp chat");
    }catch(err){
      console.error(err);
      window.open(waLink(billWhatsappNumber(b),text),"_blank");
      toast("PDF failed ("+(err.message||err)+") — sharing text only");
    }
  });
}

bindSearchShell("searchBills", renderBills);
bindSearchShell("searchCustomers", renderCustomers);

function getSelectedRowIds(selector){
  return [...document.querySelectorAll(selector)].filter(input => input.checked).map(input => input.dataset.id).filter(Boolean);
}

function deleteSelectedBills(){
  const ids = getSelectedRowIds('.bill-row-check');
  if(!ids.length){toast('Select at least one bill to delete'); return;}
  if(!confirm('Delete '+ids.length+' selected bill(s)?')) return;
  bills = bills.filter(b => !ids.includes(b.id));
  save(LS.bills,bills);
  renderBills();
  toast(ids.length + ' bill(s) deleted');
}

function deleteSelectedCustomers(){
  const ids = getSelectedRowIds('.customer-row-check');
  if(!ids.length){toast('Select at least one customer to delete'); return;}
  if(!confirm('Delete '+ids.length+' selected customer(s)?')) return;
  customers = customers.filter(c => !ids.includes(c._id || c.id));
  save(LS.customers,customers);
  refreshCustPicker();
  renderCustomers();
  toast(ids.length + ' customer(s) deleted');
}

$("deleteSelectedBillsBtn").addEventListener("click",deleteSelectedBills);
$("deleteSelectedCustomersBtn").addEventListener("click",deleteSelectedCustomers);
$("headerSelectBills").addEventListener("change", e => {
  document.querySelectorAll('.bill-row-check').forEach(input => input.checked = e.target.checked);
});
$("headerSelectCustomers").addEventListener("change", e => {
  document.querySelectorAll('.customer-row-check').forEach(input => input.checked = e.target.checked);
});
$("selectAllBills").addEventListener("change", e => {
  document.querySelectorAll('.bill-row-check').forEach(input => input.checked = e.target.checked);
  $("headerSelectBills").checked = e.target.checked;
});
$("selectAllCustomers").addEventListener("change", e => {
  document.querySelectorAll('.customer-row-check').forEach(input => input.checked = e.target.checked);
  $("headerSelectCustomers").checked = e.target.checked;
});
$("openCreateCustomerBtn").addEventListener("click",()=>{
  editingCustomerModalId = null;
  $("modalCustName").value=$("modalCustAddr").value=$("modalCustGst").value=$("modalCustPhone").value="";
  $("createCustomerModal").querySelector('h3').textContent='Create customer';
  $("modalAddCustBtn").textContent='＋ Create';
  $("createCustomerModal").style.display='flex';
});
$("closeCreateCustomerModal").addEventListener("click",()=>{
  editingCustomerModalId = null;
  $("createCustomerModal").style.display='none';
});
$("cancelCreateCustomer").addEventListener("click",()=>{
  editingCustomerModalId = null;
  $("createCustomerModal").style.display='none';
});
$("modalAddCustBtn").addEventListener("click",()=>{
  const name=$("modalCustName").value.trim();
  const addr=$("modalCustAddr").value.trim();
  const gst=$("modalCustGst").value.trim();
  const phone=$("modalCustPhone").value.trim();
  const wasEdit = Boolean(editingCustomerModalId);
  if(upsertCustomer(name,addr,gst,phone,editingCustomerModalId)){
    editingCustomerModalId = null;
    $("modalCustName").value=$("modalCustAddr").value=$("modalCustGst").value=$("modalCustPhone").value="";
    $("createCustomerModal").style.display='none';
    $("createCustomerModal").querySelector('h3').textContent='Create customer';
    $("modalAddCustBtn").textContent='＋ Create';
    renderCustomers(); toast(wasEdit ? 'Customer saved' : 'Customer created');
    syncCustomersAndBillsToSupabase({quietSuccess:true});
  }
});
