"use strict";
/* ============================================================
   CUSTOMERS
   ============================================================ */
function refreshCustPicker(){
  const sel=$("custPick"); const cur=sel.value;
  sel.innerHTML='<option value="">— Choose a saved customer —</option>';
  customers.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach((c)=>{
    const i=customers.indexOf(c);
    const o=document.createElement("option"); o.value=i; o.textContent=c.name+(c.gst?`  ·  ${c.gst}`:"");
    sel.appendChild(o);
  });
  sel.value=cur;
}
$("custPick").addEventListener("change",e=>{
  const c=customers[e.target.value];
  if(c){
    $("custName").value=c.name;$("custAddr").value=c.addr;$("custGst").value=c.gst;$("custPhone").value=c.phone||"";
    $("selectedFlag").classList.add("show");
    toast("Loaded “"+c.name+"”");
  }else{
    $("selectedFlag").classList.remove("show");
  }
});
// Typing in any customer field means it's no longer a clean pick — clear the flag/selection
["custName","custAddr","custGst","custPhone"].forEach(id=>$(id).addEventListener("input",()=>{
  $("selectedFlag").classList.remove("show");
  $("custPick").value="";
}));
let editingCustomerModalId = null;
function upsertCustomer(name,addr,gst,phone,id=null){
  name=name.trim(); if(!name){toast("Enter a customer name first");return false;}
  phone=(phone||"").trim();
  if(phone && !whatsappNumber(phone)){toast("Phone number doesn't look valid — enter 10 digits or include country code");return false;}
  const searchId = id || null;
  const i = searchId ? customers.findIndex(c=>(c._id||c.id)===searchId) : customers.findIndex(c=>c.name.toLowerCase()===name.toLowerCase());
  const rec={name,addr:addr.trim(),gst:gst.trim(),phone};
  if(i>=0){
    rec._id = customers[i]._id || customers[i].id || null;
    customers[i]=Object.assign({},customers[i],rec);
  } else {
    rec._id = uuidv4();
    customers.push(rec);
  }
  save(LS.customers,customers); refreshCustPicker();
  return true;
}
$("saveCustBtn").addEventListener("click",()=>{
  if(upsertCustomer($("custName").value,$("custAddr").value,$("custGst").value,$("custPhone").value)){
    toast("Customer saved");
    syncCustomersAndBillsToSupabase({quietSuccess:true});
  }
});

function renderCustomers(){
  const q=$("searchCustomers").value.toLowerCase();
  const body=$("custBody"); body.innerHTML="";
  const filtered = customers.filter(c=>!q || (c.name+" "+c.addr+" "+c.gst+" "+(c.phone||"")).toLowerCase().includes(q));
  $("custEmpty").style.display=filtered.length?"none":"block";
  const dash='<span style="color:#b6c0cc">—</span>';
  filtered.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach((c)=>{
    const i=customers.indexOf(c);
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td><input type="checkbox" class="row-check customer-row-check" data-id="${c._id || c.id || i}" aria-label="Select customer"></td>
      <td><div class="c-name">${esc(c.name)}</div></td>
      <td class="addr">${c.addr?esc(c.addr):dash}</td>
      <td>${c.gst?`<span class="gst-tag">${esc(c.gst)}</span>`:dash}</td>
      <td>${c.phone?esc(c.phone):dash}</td>
      <td><div class="tbl-actions">
        <button class="icon-btn" data-a="use" title="Use in a new bill">🧾 Use</button>
        <button class="icon-btn" data-a="edit" title="Edit details">✏️ Edit</button>
        <button class="icon-btn del" data-a="del" title="Delete">🗑️</button>
      </div></td>`;
    tr.querySelector('[data-a="use"]').addEventListener("click",()=>{
      $("custName").value=c.name;$("custAddr").value=c.addr;$("custGst").value=c.gst;$("custPhone").value=c.phone||"";
      $("custPick").value=i;$("selectedFlag").classList.add("show");
      document.querySelector('nav.tabs button[data-tab="create"]').click();
      toast('Using “'+c.name+'” in this bill');
    });
    tr.querySelector('[data-a="edit"]').addEventListener("click",()=>{
      editingCustomerModalId = c._id || c.id;
      $("modalCustName").value=c.name;$("modalCustAddr").value=c.addr;$("modalCustGst").value=c.gst;$("modalCustPhone").value=c.phone||"";
      $("createCustomerModal").querySelector('h3').textContent='Edit customer';
      $("modalAddCustBtn").textContent='Save';
      $("createCustomerModal").style.display='flex';
      toast("Edit customer in the modal then click Save");
    });
    tr.querySelector('[data-a="del"]').addEventListener("click",()=>{
      if(confirm("Delete customer “"+c.name+"”?")){customers.splice(i,1);save(LS.customers,customers);renderCustomers();refreshCustPicker();}
    });
    body.appendChild(tr);
  });
  const master = $("headerSelectCustomers");
  if(master){ master.checked = false; }
}
/* WhatsApp needs the number with country code, digits only. 10-digit numbers are treated as Indian (+91).
   Returns "" if the number doesn't look valid. */
function whatsappNumber(phone){
  let d=String(phone||"").replace(/\D/g,"");
  if(d.startsWith("00")) d=d.slice(2);
  if(d.length===11 && d.startsWith("0")) d=d.slice(1);
  if(d.length===10) d="91"+d;
  return d.length>=11 && d.length<=15 ? d : "";
}
const esc = s => String(s??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
