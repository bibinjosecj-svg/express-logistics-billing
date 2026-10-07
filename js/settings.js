"use strict";
/* ============================================================
   SETTINGS
   ============================================================ */
function fillSettings(){
  $("setTitle").value=settings.title; $("setName").value=settings.name; $("setAddr").value=settings.addr;
  $("setGst").value=settings.gst; $("setBankName").value=settings.bankName; $("setBank").value=settings.bank;
  $("setBranch").value=settings.branch; $("setAcc").value=settings.acc; $("setIfsc").value=settings.ifsc;
  $("setFY").value=settings.fy;
  $("brandName").textContent=settings.name||"Billing";
  const bl=$("brandLogo");
  if(settings.logo){bl.src=settings.logo;bl.style.display="block";}
  else{bl.style.display="none";}
  if(settings.logo){$("setLogoPrev").src=settings.logo;$("setLogoPrev").style.display="inline-block";$("setLogoClear").style.display="inline-block";}
  else{$("setLogoPrev").style.display="none";$("setLogoClear").style.display="none";}
  if(settings.seal){$("setSealPrev").src=settings.seal;$("setSealPrev").style.display="inline-block";$("setSealClear").style.display="inline-block";}
  else{$("setSealPrev").style.display="none";$("setSealClear").style.display="none";}
}
$("saveSettingsBtn").addEventListener("click",()=>{
  Object.assign(settings,{
    title:$("setTitle").value,name:$("setName").value,addr:$("setAddr").value,gst:$("setGst").value,
    bankName:$("setBankName").value,bank:$("setBank").value,branch:$("setBranch").value,
    acc:$("setAcc").value,ifsc:$("setIfsc").value,fy:$("setFY").value
  });
  save(LS.settings,settings); fillSettings(); toast("Settings saved");
});
/* Images are stored as data URLs in localStorage (~5MB limit), so shrink large ones to max 600px. */
function readImageFile(f,done){
  const r=new FileReader();
  r.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      const k=Math.min(1,600/Math.max(img.width,img.height));
      if(k===1){done(r.result);return;}
      const c=document.createElement("canvas");
      c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      done(c.toDataURL("image/png"));
    };
    img.onerror=()=>done(r.result);
    img.src=r.result;
  };
  r.readAsDataURL(f);
}
function wireImageSetting(key,fileId,clearId,label){
  $(fileId).addEventListener("change",e=>{
    const f=e.target.files[0]; if(!f)return;
    readImageFile(f,url=>{
      settings[key]=url;
      try{save(LS.settings,settings);}catch(err){settings[key]="";toast(label+" image too large — try a smaller file");return;}
      fillSettings();toast(label+" added");
    });
    e.target.value="";
  });
  $(clearId).addEventListener("click",()=>{settings[key]="";save(LS.settings,settings);fillSettings();toast(label+" removed");});
}
wireImageSetting("logo","setLogoFile","setLogoClear","Logo");
wireImageSetting("seal","setSealFile","setSealClear","Seal");

/* ---------- Backup export / import ---------- */
$("exportBtn").addEventListener("click",()=>{
  const data=JSON.stringify({settings,customers,bills,_v:1},null,2);
  const blob=new Blob([data],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="billing-backup-"+todayISO()+".json";
  a.click(); URL.revokeObjectURL(a.href);
  if(bills.length) downloadBillsCsv();
  toast("Backup downloaded");
});

/* Bills as a table (CSV, opens in Excel) — one row per bill. */
function downloadBillsCsv(){
  const cell=v=>{const s=String(v==null?"":v);return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const num=v=>(Number(v)||0).toFixed(2);
  const taxAmt=(t,label)=>t.l1===label?t.t1:t.l2===label?t.t2:0;
  const head=["Invoice No","FY","Date","Customer","Address","GSTIN","Vehicle Nos","Particulars",
    "Subtotal","CGST","SGST","IGST","Coolie","Discount","Round Off","Grand Total"];
  const rows=bills.map(b=>{
    const t=b.totals||{}, items=b.items||[], c=b.cust||{};
    return [b.invNo,b.fy,b.date,c.name,c.addr,c.gst,
      items.map(i=>i.veh).filter(Boolean).join(" / "),
      items.map(i=>i.part).filter(Boolean).join(" / "),
      num(t.sub),num(taxAmt(t,"CGST")),num(taxAmt(t,"SGST")),num(taxAmt(t,"IGST")),
      num(t.carrying),num(t.discount),num(t.round),num(t.grand)];
  });
  const csv="﻿"+[head,...rows].map(r=>r.map(cell).join(",")).join("\r\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download="billing-bills-"+todayISO()+".csv";
  a.click(); URL.revokeObjectURL(a.href);
}

/* Danger zone: deletes data from Supabase first, then this browser (so auto-sync can't re-upload it).
   Settings and Supabase backups are kept. */
async function resetData(includeCustomers){
  const sup=getSupabaseClient();
  if(sup){
    const tables=includeCustomers?['bills','customers']:['bills'];
    for(const t of tables){
      try{
        const res=await sup.from(t).delete().neq('id','');
        if(res.error){toast('Supabase reset failed ('+t+'): '+res.error.message);console.error(res.error);return;}
      }catch(err){toast('Supabase reset error ('+t+'): '+(err.message||err));console.error(err);return;}
    }
  }
  bills=[]; save(LS.bills,bills);
  supabaseBillsPage=0; supabaseBillsHasMore=false;
  if(includeCustomers){
    customers=[]; save(LS.customers,customers);
    supabaseCustomersPage=0; supabaseCustomersHasMore=false;
    renderCustomers(); refreshCustPicker();
  }
  updateLoadMoreButtons(); renderBills(); newBill();
  const what=includeCustomers?"Bills and customers":"Bills";
  toast(what+" reset"+(sup?" (browser + Supabase)":" (browser only)"));
}
function confirmReset(message){
  if(!confirm(message+"\n\nThis cannot be undone. Export a backup first if you need the data."))return false;
  const typed=prompt('Type RESET to confirm');
  if((typed||"").trim().toUpperCase()!=="RESET"){toast("Reset cancelled");return false;}
  return true;
}
$("resetBillsBtn").addEventListener("click",()=>{
  if(confirmReset("Delete ALL "+bills.length+" bills from this browser and Supabase?\nCustomers will be kept.")) resetData(false);
});
$("resetAllBtn").addEventListener("click",()=>{
  if(confirmReset("Delete ALL "+bills.length+" bills and "+customers.length+" customers from this browser and Supabase?")) resetData(true);
});
$("importBtn").addEventListener("click",()=>$("importFile").click());
$("importFile").addEventListener("change",e=>{
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(!confirm("Importing will REPLACE current data with the backup. Continue?"))return;
      settings=Object.assign({},DEFAULT_SETTINGS,d.settings||{});
      customers=d.customers||[]; bills=d.bills||[];
      save(LS.settings,settings);save(LS.customers,customers);save(LS.bills,bills);
      fillSettings();refreshCustPicker();newBill();toast("Backup imported");
    }catch(err){alert("Could not read backup file: "+err.message);}
  };
  r.readAsText(f);
});

/* ---------------- Supabase sync helpers ---------------- */
